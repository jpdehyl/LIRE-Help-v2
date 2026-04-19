import { cn } from "./cn";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("shimmer rounded-xs", className)} aria-hidden />;
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)} aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn("h-3", i === lines - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-sm border border-border bg-surface p-4", className)} aria-hidden>
      <div className="flex items-start justify-between gap-3">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-7 w-7 rounded-sm" />
      </div>
      <Skeleton className="mt-3 h-6 w-20" />
      <Skeleton className="mt-2 h-3 w-48" />
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div
      className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-border px-4 py-3"
      aria-hidden
    >
      <div className="min-w-0 space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-14 rounded-xs" />
        </div>
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-3 w-2/3" />
      </div>
      <div className="flex flex-col items-end gap-1.5">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-14 rounded-xs" />
      </div>
    </div>
  );
}
