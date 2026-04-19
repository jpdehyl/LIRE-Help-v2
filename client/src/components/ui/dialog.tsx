import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "./cn";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
  initialFocusRef?: React.RefObject<HTMLElement>;
  placement?: "center" | "top" | "left";
}

export function Dialog({ open, onClose, children, className, ariaLabel, initialFocusRef, placement = "center" }: DialogProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const timeout = window.setTimeout(() => initialFocusRef?.current?.focus(), 0);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      window.clearTimeout(timeout);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus?.();
    };
  }, [open, initialFocusRef]);

  if (!open) return null;

  const alignment =
    placement === "top"
      ? "items-start justify-center pt-[10vh]"
      : placement === "left"
        ? "items-stretch justify-start"
        : "items-center justify-center";

  return createPortal(
    <div
      className={cn("fixed inset-0 z-50 flex bg-[rgba(10,10,10,0.6)] backdrop-blur-sm", alignment)}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={cn("mx-4 w-full max-w-xl", className)}>{children}</div>
    </div>,
    document.body,
  );
}
