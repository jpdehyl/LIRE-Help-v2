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
  solid: "bg-surface border border-border",
  soft: "bg-surface-2 border border-border",
  dashed: "bg-transparent border border-dashed border-border",
  inverted: "bg-fg text-[#FAFAFA] border border-fg",
};

const paddings: Record<CardPadding, string> = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-5",
};

const interactiveClass = "cursor-pointer transition-colors ease-ds duration-fast hover:bg-surface-2";

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, variant = "solid", padding = "md", interactive, as: _as = "div", children, ...rest },
  ref,
) {
  const Tag: any = _as;
  return (
    <Tag
      ref={ref as any}
      className={cn("rounded-sm", variants[variant], paddings[padding], interactive ? interactiveClass : null, className)}
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
      <div className="min-w-0">
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        {title ? (
          <Heading level={2} size="h4" className="mt-1">
            {title}
          </Heading>
        ) : null}
      </div>
      {children}
    </div>
  );
}
