import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppProvider } from "@/components/providers";
import { ToastHost } from "@/components/toast-host";
import { BRAND } from "@/components/brand";

export const metadata: Metadata = {
  title: {
    default: `${BRAND.name} — ${BRAND.tagline}`,
    template: `%s · ${BRAND.name}`,
  },
  description:
    "DawaQuick connects you to verified local pharmacies for fast, hyperlocal medicine delivery, with pharmacist verification for prescription medicines.",
  applicationName: BRAND.name,
};

export const viewport: Viewport = {
  // Tints the browser chrome on a phone, so it has to be the same colour as
  // the header it sits directly above — brand-700. A stale value here leaves a
  // green bar over a blue app, which is the one place a hardcoded hex is
  // unavoidable: metadata cannot read a CSS custom property.
  themeColor: "#0a439d",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">
        <AppProvider>
          {children}
          <ToastHost />
        </AppProvider>
      </body>
    </html>
  );
}
