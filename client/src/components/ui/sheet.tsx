import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "./cn";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  side?: "left" | "right";
  children: ReactNode;
  ariaLabel?: string;
  className?: string;
}

export function Sheet({ open, onClose, side = "left", children, ariaLabel, className }: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = overflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const sideClasses = side === "left" ? "left-0 border-r" : "right-0 border-l";

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-[rgba(10,10,10,0.6)] backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={cn("absolute top-0 bottom-0 flex w-full max-w-[280px] flex-col bg-surface border-border shadow-menu", sideClasses, className)}>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close navigation"
          className="absolute right-2 top-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-sm border border-border bg-surface text-fg-muted transition-colors ease-ds duration-fast hover:bg-surface-2"
        >
          <X className="h-3.5 w-3.5" />
        </button>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
