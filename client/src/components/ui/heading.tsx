import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

type HeadingLevel = 1 | 2 | 3 | 4;

interface HeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  level?: HeadingLevel;
  size?: "display" | "h1" | "h2" | "h3" | "h4";
  children: ReactNode;
}

const sizeClasses: Record<NonNullable<HeadingProps["size"]>, string> = {
  display: "text-[clamp(1.8rem,3vw,2.4rem)] font-semibold tracking-[-0.045em] text-slate-950 dark:text-slate-50",
  h1: "text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-50",
  h2: "text-lg font-semibold text-slate-950 dark:text-slate-50",
  h3: "text-sm font-semibold text-slate-950 dark:text-slate-100",
  h4: "text-sm font-semibold text-slate-900 dark:text-slate-200",
};

export function Heading({ level = 2, size, className, children, ...rest }: HeadingProps) {
  const Tag = `h${level}` as "h1" | "h2" | "h3" | "h4";
  const resolved = size ?? (`h${level}` as NonNullable<HeadingProps["size"]>);
  return (
    <Tag className={cn(sizeClasses[resolved], className)} {...rest}>
      {children}
    </Tag>
  );
}

export function Eyebrow({
  children,
  className,
  ...rest
}: HTMLAttributes<HTMLParagraphElement> & { children: ReactNode }) {
  return (
    <p className={cn("text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400", className)} {...rest}>
      {children}
    </p>
  );
}

export function Caption({
  children,
  className,
  ...rest
}: HTMLAttributes<HTMLParagraphElement> & { children: ReactNode }) {
  return (
    <p className={cn("text-xs leading-relaxed text-slate-500 dark:text-slate-400", className)} {...rest}>
      {children}
    </p>
  );
}
