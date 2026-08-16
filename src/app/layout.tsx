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
    "MedSpark connects you to verified local pharmacies for fast, hyperlocal medicine delivery, with pharmacist verification for prescription medicines.",
  applicationName: BRAND.name,
};

export const viewport: Viewport = {
  themeColor: "#0d8c6f",
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
