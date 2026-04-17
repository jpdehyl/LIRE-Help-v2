import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "./cn";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  tone?: "neutral" | "muted";
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  tone = "neutral",
}: EmptyStateProps) {
  const bg = tone === "muted" ? "bg-[#f6f8fa] dark:bg-slate-950" : "bg-white dark:bg-slate-900";
  return (
    <div className={cn("flex h-full items-center justify-center p-8 text-center", bg, className)}>
      <div className="max-w-sm">
        {Icon ? (
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            <Icon className="h-5 w-5" />
          </div>
        ) : null}
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</p>
        {description ? (
          <p className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{description}</p>
        ) : null}
        {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
      </div>
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  description?: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

export function ErrorState({
  title = "Something went wrong",
  description,
  onRetry,
  retryLabel = "Retry",
  className,
}: ErrorStateProps) {
  return (
    <div className={cn("flex h-full items-center justify-center bg-[#f6f8fa] p-8 text-center dark:bg-slate-950", className)}>
      <div className="max-w-md">
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</p>
        {description ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p> : null}
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 inline-flex items-center justify-center rounded-pill bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
          >
            {retryLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
