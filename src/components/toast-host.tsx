"use client";

import clsx from "clsx";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { useApp } from "./providers";

const ICONS = {
  success: <CheckCircle2 size={18} className="text-emerald-600" />,
  error: <AlertCircle size={18} className="text-red-600" />,
  info: <Info size={18} className="text-sky-600" />,
};

export function ToastHost() {
  const { toasts, dismissToast } = useApp();
  if (!toasts.length) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-3 no-print">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={clsx(
            "toast-in pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border bg-white p-3.5 shadow-lg",
            t.kind === "error" ? "border-red-200" : "border-ink-200",
          )}
        >
          <span className="mt-0.5">{ICONS[t.kind]}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink-900">{t.title}</p>
            {t.body && <p className="mt-0.5 text-xs text-ink-600">{t.body}</p>}
          </div>
          <button
            onClick={() => dismissToast(t.id)}
            aria-label="Dismiss"
            className="rounded-md p-1 text-ink-400 hover:bg-ink-100"
          >
            <X size={15} />
          </button>
        </div>
      ))}
    </div>
  );
}
