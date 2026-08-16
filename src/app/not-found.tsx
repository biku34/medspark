import Link from "next/link";
import { Logo } from "@/components/brand";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <Logo size="lg" />
      <h1 className="text-2xl font-bold text-ink-900">This page doesn&apos;t exist</h1>
      <p className="max-w-sm text-sm text-ink-500">
        The page you were looking for has moved or never existed. Let&apos;s get you back to
        finding medicines near you.
      </p>
      <Link
        href="/"
        className="rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-700"
      >
        Back to DawaQuick
      </Link>
    </div>
  );
}
