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
  const bg = tone === "muted" ? "bg-bg" : "bg-surface";
  return (
    <div className={cn("flex h-full items-center justify-center p-8 text-center", bg, className)}>
      <div className="max-w-sm">
        {Icon ? (
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-sm bg-surface-2 text-fg-muted">
            <Icon className="h-4 w-4" />
          </div>
        ) : null}
        <p className="font-display text-[15px] font-semibold text-fg">{title}</p>
        {description ? <p className="mt-1 font-body text-[13px] leading-[1.5] text-fg-muted">{description}</p> : null}
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
    <div className={cn("flex h-full items-center justify-center bg-bg p-8 text-center", className)}>
      <div className="max-w-md">
        <p className="font-display text-[15px] font-semibold text-fg">{title}</p>
        {description ? <p className="mt-1 font-body text-[13px] text-fg-muted">{description}</p> : null}
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 inline-flex items-center justify-center rounded-sm bg-fg px-3 py-1.5 font-body text-[12px] font-medium text-surface transition-opacity ease-ds duration-fast hover:opacity-90"
          >
            {retryLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
