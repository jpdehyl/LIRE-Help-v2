import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export type BadgeTone =
  | "neutral"
  | "slate"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "violet"
  | "orange"
  | "inverted";

type BadgeSize = "sm" | "md";
type BadgeShape = "pill" | "tag";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  size?: BadgeSize;
  shape?: BadgeShape;
  children: ReactNode;
}

const tones: Record<BadgeTone, string> = {
  neutral: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  slate:
    "bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700",
  success: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  warning: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
  danger: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300",
  info: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300",
  violet: "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300",
  orange: "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300",
  inverted: "bg-white/10 text-slate-100",
};

const sizes: Record<BadgeSize, string> = {
  sm: "px-2 py-0.5 text-[11px]",
  md: "px-2.5 py-1 text-xs",
};

const shapes: Record<BadgeShape, string> = {
  pill: "rounded-full",
  tag: "rounded-md",
};

export function Badge({
  tone = "neutral",
  size = "sm",
  shape = "pill",
  className,
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 font-semibold", tones[tone], sizes[size], shapes[shape], className)}
      {...rest}
    >
      {children}
    </span>
  );
}
