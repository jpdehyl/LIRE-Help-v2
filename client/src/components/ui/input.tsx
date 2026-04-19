import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes } from "react";
import { cn } from "./cn";

const fieldBase =
  "w-full rounded-sm border border-border bg-surface px-3 py-2 text-[13px] text-fg font-body outline-none transition-colors ease-ds duration-fast placeholder:text-fg-subtle focus:border-fg focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-40";

const fieldCompact =
  "w-full rounded-sm border border-border bg-surface px-2.5 py-1.5 text-[13px] text-fg font-body outline-none transition-colors ease-ds duration-fast placeholder:text-fg-subtle focus:border-fg focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-40";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { compact?: boolean }>(
  function Input({ className, compact, ...rest }, ref) {
    return <input ref={ref} className={cn(compact ? fieldCompact : fieldBase, className)} {...rest} />;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { compact?: boolean }>(
  function Textarea({ className, compact, ...rest }, ref) {
    return <textarea ref={ref} className={cn(compact ? fieldCompact : fieldBase, "resize-y", className)} {...rest} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { compact?: boolean }>(
  function Select({ className, compact, children, ...rest }, ref) {
    return (
      <select ref={ref} className={cn(compact ? fieldCompact : fieldBase, "pr-7 appearance-none", className)} {...rest}>
        {children}
      </select>
    );
  },
);

export function FieldLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("mb-1.5 block font-body text-[12px] font-medium text-fg-muted uppercase tracking-eyebrow", className)}>
      {children}
    </label>
  );
}
