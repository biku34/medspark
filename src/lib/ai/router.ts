/**
 * Key pool and failover for the AI providers.
 *
 * Several free-tier keys per vendor is not redundancy for its own sake: these
 * quotas are small and a rate limit mid-consultation is a pharmacist staring at
 * an empty form. So a call walks the pool — next key, then next provider — and
 * a key that returns 429 is put on a short cooldown rather than retried into
 * the same wall.
 *
 * Nothing here is exposed to the browser. Every caller is a route handler.
 */

export type ProviderName = "groq" | "gemini";

interface KeyState {
  key: string;
  /** Epoch ms until which this key is skipped. */
  cooldownUntil: number;
}

const pools: Record<ProviderName, KeyState[]> = { groq: [], gemini: [] };
const cursors: Record<ProviderName, number> = { groq: 0, gemini: 0 };

function load(name: ProviderName, raw: string | undefined): KeyState[] {
  return (raw ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean)
    .map((key) => ({ key, cooldownUntil: 0 }));
}

function pool(name: ProviderName): KeyState[] {
  if (pools[name].length === 0) {
    pools[name] = load(
      name,
      name === "groq" ? process.env.GROQ_API_KEYS : process.env.GEMINI_API_KEYS,
    );
  }
  return pools[name];
}

export function hasProvider(name: ProviderName): boolean {
  return pool(name).length > 0;
}

/** True when at least one provider is configured. */
export function aiEnabled(): boolean {
  return hasProvider("groq") || hasProvider("gemini");
}

/** Rate limits are usually per-minute, so a minute is the honest cooldown. */
const COOLDOWN_MS = 60_000;

export class AiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "AiError";
  }
}

/**
 * Runs `attempt` against each usable key in turn.
 *
 * The callback is handed a key and must throw an AiError with retryable=true
 * for anything worth trying the next key on. A non-retryable error (a bad
 * request, a schema violation) aborts immediately — walking the pool would just
 * make the same mistake five times.
 */
export async function withKey<T>(
  name: ProviderName,
  attempt: (key: string) => Promise<T>,
): Promise<T> {
  const keys = pool(name);
  if (keys.length === 0) throw new AiError(`No ${name} keys configured`, undefined, false);

  const now = Date.now();
  const usable = keys.filter((k) => k.cooldownUntil <= now);
  const order = usable.length > 0 ? usable : keys; // all cooling: try anyway

  let lastError: unknown;
  for (let i = 0; i < order.length; i++) {
    const state = order[(cursors[name] + i) % order.length];
    try {
      const out = await attempt(state.key);
      cursors[name] = (cursors[name] + i + 1) % order.length;
      state.cooldownUntil = 0;
      return out;
    } catch (err) {
      lastError = err;
      if (err instanceof AiError && !err.retryable) throw err;
      state.cooldownUntil = Date.now() + COOLDOWN_MS;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new AiError(`All ${name} keys failed`, undefined, true);
}

/** Aborts a fetch that hangs, so a slow provider cannot stall a request. */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  ms = 45_000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new AiError("Provider timed out", 504, true);
    }
    throw new AiError(err instanceof Error ? err.message : String(err), undefined, true);
  } finally {
    clearTimeout(timer);
  }
}

/** 429 and 5xx are worth another key; 4xx generally is not. */
export function classify(status: number, body: string): AiError {
  const retryable = status === 429 || status === 408 || status >= 500;
  return new AiError(`HTTP ${status}: ${body.slice(0, 300)}`, status, retryable);
}
