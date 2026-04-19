import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export type BadgeTone =
  | "neutral"
  | "slate"
  | "muted"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "violet"
  | "orange"
  | "accent"
  | "inverted"
  | "ai"
  | "active";

type BadgeSize = "sm" | "md";
type BadgeShape = "pill" | "tag";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  size?: BadgeSize;
  shape?: BadgeShape;
  dot?: boolean;
  children: ReactNode;
}

// Map to design Chip tones (public/design/Primitives.jsx:22-50).
const tones: Record<BadgeTone, string> = {
  neutral: "bg-surface-2 text-fg",
  slate: "bg-surface-2 text-fg border border-border",
  muted: "bg-transparent text-fg-muted border border-border",
  success: "text-success bg-[rgba(0,135,90,0.10)]",
  warning: "text-warning bg-[rgba(245,158,11,0.14)]",
  danger: "text-error bg-[rgba(220,38,38,0.10)]",
  info: "text-fg bg-[rgba(59,130,246,0.10)]",
  violet: "text-fg bg-[rgba(139,92,246,0.10)]",
  orange: "text-accent bg-[rgba(255,77,0,0.12)]",
  accent: "text-accent bg-[rgba(255,77,0,0.12)]",
  ai: "text-fg bg-[rgba(17,17,17,0.06)] dark:bg-[rgba(255,255,255,0.06)]",
  active: "bg-fg text-surface",
  inverted: "bg-white/10 text-[#FAFAFA]",
};

const dotTones: Record<BadgeTone, string> = {
  neutral: "bg-fg-subtle",
  slate: "bg-fg-subtle",
  muted: "bg-fg-subtle",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-error",
  info: "bg-[#3B82F6]",
  violet: "bg-[#8B5CF6]",
  orange: "bg-accent",
  accent: "bg-accent",
  ai: "bg-fg",
  active: "bg-surface",
  inverted: "bg-white",
};

const sizes: Record<BadgeSize, string> = {
  sm: "px-1.5 py-[2px] text-[10px]",
  md: "px-2 py-[4px] text-[11px]",
};

const shapes: Record<BadgeShape, string> = {
  pill: "rounded-xs",
  tag: "rounded-xs",
};

export function Badge({
  tone = "neutral",
  size = "sm",
  shape = "tag",
  dot = false,
  className,
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-semibold uppercase tracking-eyebrow font-body",
        tones[tone],
        sizes[size],
        shapes[shape],
        className,
      )}
      {...rest}
    >
      {dot ? <span className={cn("inline-block h-[6px] w-[6px] rounded-full", dotTones[tone])} /> : null}
      {children}
    </span>
  );
}
