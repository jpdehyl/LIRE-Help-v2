import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes } from "react";
import { cn } from "./cn";

const fieldBase =
  "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white focus:ring-4 focus:ring-slate-200/60 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-500 dark:focus:bg-slate-900 dark:focus:ring-slate-700/60";

const fieldCompact =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-500";

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
      <select ref={ref} className={cn(compact ? fieldCompact : fieldBase, className)} {...rest}>
        {children}
      </select>
    );
  },
);

export function FieldLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <label className={cn("mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300", className)}>{children}</label>;
}
