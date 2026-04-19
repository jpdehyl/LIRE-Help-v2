import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

type HeadingLevel = 1 | 2 | 3 | 4;

interface HeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  level?: HeadingLevel;
  size?: "display" | "h1" | "h2" | "h3" | "h4" | "h5";
  children: ReactNode;
}

const sizeClasses: Record<NonNullable<HeadingProps["size"]>, string> = {
  display: "font-display font-bold text-[clamp(2.5rem,4vw,4rem)] leading-[1.05] tracking-tight text-fg",
  h1: "font-display font-bold text-[clamp(1.75rem,3vw,3rem)] leading-[1.05] tracking-tight text-fg",
  h2: "font-display font-semibold text-[clamp(1.5rem,2.4vw,2.25rem)] leading-[1.05] tracking-tight text-fg",
  h3: "font-display font-semibold text-[clamp(1.25rem,1.8vw,1.75rem)] leading-[1.25] tracking-tight text-fg",
  h4: "font-display font-semibold text-[1.375rem] leading-[1.25] tracking-tight text-fg",
  h5: "font-display font-semibold text-[1.125rem] leading-[1.25] tracking-tight text-fg",
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
    <p
      className={cn("font-body text-[11px] font-semibold uppercase tracking-eyebrow text-fg-muted", className)}
      {...rest}
    >
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
    <p className={cn("font-body text-[12px] leading-[1.5] text-fg-muted", className)} {...rest}>
      {children}
    </p>
  );
}
