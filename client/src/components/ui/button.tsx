import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "./cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "subtle" | "danger" | "dark";
type ButtonSize = "xs" | "sm" | "md" | "lg" | "icon";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const base =
  "inline-flex items-center justify-center gap-1.5 font-medium font-body rounded-sm transition-[background-color,border-color,color] ease-ds duration-fast disabled:cursor-not-allowed disabled:opacity-40";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-ink hover:bg-accent-hover active:bg-accent-press",
  dark: "bg-fg text-surface hover:opacity-90",
  secondary: "bg-surface text-fg border border-border hover:bg-surface-2",
  ghost: "bg-transparent text-fg-muted hover:bg-surface-2 hover:text-fg",
  subtle: "bg-surface-2 text-fg hover:bg-border",
  danger: "bg-error text-white hover:opacity-90",
};

const sizes: Record<ButtonSize, string> = {
  xs: "h-6 px-2 text-[11px]",
  sm: "h-7 px-2.5 text-[12px]",
  md: "h-[34px] px-3 text-[13px]",
  lg: "h-10 px-4 text-[13px]",
  icon: "h-7 w-7 p-0 text-[12px]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", loading, disabled, leftIcon, rightIcon, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={rest.type ?? "button"}
      disabled={disabled || loading}
      className={cn(base, variants[variant], sizes[size], className)}
      {...rest}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : leftIcon}
      {children}
      {!loading && rightIcon ? rightIcon : null}
    </button>
  );
});
