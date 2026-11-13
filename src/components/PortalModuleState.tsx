import { AlertCircle, Inbox, LoaderCircle, RefreshCw } from "lucide-react";

type StateKind = "loading" | "error" | "empty";

export function PortalModuleState({
  kind,
  title,
  description,
  onRetry,
}: {
  kind: StateKind;
  title: string;
  description: string;
  onRetry?: () => void;
}) {
  const Icon = kind === "loading" ? LoaderCircle : kind === "error" ? AlertCircle : Inbox;
  const iconColor = kind === "error" ? "text-rose-600" : kind === "empty" ? "text-slate-400" : "text-emerald-700";

  return (
    <section
      role={kind === "error" ? "alert" : "status"}
      aria-live={kind === "error" ? "assertive" : "polite"}
      className="portal-module-state rounded-2xl border border-slate-200 bg-white/75 px-6 py-10 text-center shadow-sm"
    >
      <Icon className={`mx-auto h-7 w-7 ${iconColor} ${kind === "loading" ? "animate-spin" : ""}`} aria-hidden="true" />
      <h2 className="mt-3 text-sm font-semibold text-slate-800">{title}</h2>
      <p className="mx-auto mt-1 max-w-lg text-sm text-slate-500">{description}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw size={14} aria-hidden="true" />
          Try again
        </button>
      )}
    </section>
  );
}
