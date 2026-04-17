import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "./cn";
import { Eyebrow, Heading } from "./heading";

type CardVariant = "solid" | "soft" | "dashed" | "inverted";
type CardPadding = "none" | "sm" | "md" | "lg";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: CardPadding;
  interactive?: boolean;
  as?: "div" | "article" | "section" | "aside";
  children?: ReactNode;
}

const variants: Record<CardVariant, string> = {
  solid: "border border-slate-200 bg-white shadow-card",
  soft: "border border-slate-200 bg-slate-50",
  dashed: "border border-dashed border-slate-300 bg-slate-50",
  inverted: "border border-slate-800 bg-slate-950 text-slate-50 shadow-card",
};

const paddings: Record<CardPadding, string> = {
  none: "",
  sm: "p-4",
  md: "p-5",
  lg: "p-6",
};

const interactiveClass =
  "cursor-pointer transition hover:border-slate-300 hover:bg-slate-50 hover:shadow-raised";

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, variant = "solid", padding = "md", interactive, as: _as = "div", children, ...rest },
  ref,
) {
  const Tag: any = _as;
  return (
    <Tag
      ref={ref as any}
      className={cn(
        "rounded-card",
        variants[variant],
        paddings[padding],
        interactive ? interactiveClass : null,
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
});

export function CardHeader({ eyebrow, title, children, className }: {
  eyebrow?: ReactNode;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3", className)}>
      <div>
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        {title ? <Heading level={2} className="mt-1">{title}</Heading> : null}
      </div>
      {children}
    </div>
  );
}
