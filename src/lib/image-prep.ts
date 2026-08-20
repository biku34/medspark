/**
 * Preparing a document for a vision model, in the browser.
 *
 * Two problems solved in one pass:
 *
 *   1. Format. Vision models take PNG/JPEG. Our sample prescriptions are SVG
 *      data URLs, and a phone can hand us HEIC-ish oddities, so everything is
 *      redrawn onto a canvas and exported as PNG before it is ever uploaded.
 *
 *   2. Legibility. A photo of a prescription is a grey page under a warm bulb,
 *      shot at an angle. Flattening to greyscale and stretching contrast makes
 *      the ink separate from the paper, which is the single cheapest thing you
 *      can do for OCR accuracy — and it costs nothing at inference time.
 *
 * Runs entirely client-side, so the server never handles a raw camera file and
 * the upload is smaller.
 */

export interface PreparedImage {
  /** A data: URL, always PNG. */
  dataUrl: string;
  /** Just the base64 payload, for the provider APIs. */
  base64: string;
  mimeType: "image/png";
  width: number;
  height: number;
}

/** Longest edge. Big enough to read small print, small enough to upload fast. */
const MAX_EDGE = 1600;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Data URLs are same-origin, but this keeps the canvas untainted either way.
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not decode that image"));
    img.src = src;
  });
}

/**
 * SVG needs an explicit size before a browser will draw it to a canvas.
 *
 * Our generated prescriptions carry width/height, but a pasted SVG might not,
 * so fall back to a sensible page rather than rendering a 0×0 canvas.
 */
function svgSize(dataUrl: string): { width: number; height: number } {
  try {
    const decoded = decodeURIComponent(dataUrl.replace(/^data:image\/svg\+xml[^,]*,/, ""));
    const w = /width="(\d+(?:\.\d+)?)"/.exec(decoded)?.[1];
    const h = /height="(\d+(?:\.\d+)?)"/.exec(decoded)?.[1];
    if (w && h) return { width: Number(w), height: Number(h) };
    const box = /viewBox="[\d.]+ [\d.]+ ([\d.]+) ([\d.]+)"/.exec(decoded);
    if (box) return { width: Number(box[1]), height: Number(box[2]) };
  } catch {
    /* fall through to the default page */
  }
  return { width: 900, height: 1240 };
}

/**
 * Greyscale with a contrast stretch.
 *
 * Luminance weights rather than a flat average, because ink is usually blue or
 * black on off-white and the naive mean washes both towards the paper. The
 * stretch then pushes whatever is left of the midtones apart.
 */
function flatten(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const img = ctx.getImageData(0, 0, width, height);
  const d = img.data;

  let min = 255;
  let max = 0;
  const grey = new Uint8ClampedArray(d.length / 4);

  for (let i = 0, g = 0; i < d.length; i += 4, g++) {
    const v = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    grey[g] = v;
    if (v < min) min = v;
    if (v > max) max = v;
  }

  // A page that is already flat (a generated SVG, say) needs no stretching.
  const span = max - min;
  const stretch = span > 24 && span < 255;

  for (let i = 0, g = 0; i < d.length; i += 4, g++) {
    let v = grey[g];
    if (stretch) v = ((v - min) / span) * 255;
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = 255;
  }

  ctx.putImageData(img, 0, 0);
}

/**
 * Turns any image source into a greyscale PNG a vision model can read.
 *
 * `enhance` is off for documents we generated ourselves — they are already
 * clean, and stretching a synthetic page only adds artefacts.
 */
export async function prepareDocument(
  source: string,
  { enhance = true }: { enhance?: boolean } = {},
): Promise<PreparedImage> {
  const isSvg = source.startsWith("data:image/svg+xml");
  const natural = isSvg ? svgSize(source) : null;

  const img = await loadImage(source);

  const srcW = img.naturalWidth || natural?.width || 900;
  const srcH = img.naturalHeight || natural?.height || 1240;

  const scale = Math.min(1, MAX_EDGE / Math.max(srcW, srcH));
  const width = Math.max(1, Math.round(srcW * scale));
  const height = Math.max(1, Math.round(srcH * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas is unavailable in this browser");

  // Paper first: a transparent PNG would read as black to a vision model.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  if (enhance) flatten(ctx, width, height);

  const dataUrl = canvas.toDataURL("image/png");
  return {
    dataUrl,
    base64: dataUrl.slice(dataUrl.indexOf(",") + 1),
    mimeType: "image/png",
    width,
    height,
  };
}

/** Reads a File into a data URL, so it can go through prepareDocument. */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read that file"));
    reader.readAsDataURL(file);
  });
}
