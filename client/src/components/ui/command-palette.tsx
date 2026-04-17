import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, CornerDownLeft, Search } from "lucide-react";
import { useLocation } from "wouter";
import type { LucideIcon } from "lucide-react";
import { Dialog } from "./dialog";
import { cn } from "./cn";

export interface CommandItem {
  id: string;
  label: string;
  description?: string;
  href?: string;
  keywords?: string;
  group?: string;
  icon?: LucideIcon;
  onRun?: () => void;
  shortcut?: string;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  commands: CommandItem[];
  placeholder?: string;
}

function score(item: CommandItem, query: string): number {
  if (!query) return 1;
  const haystack = `${item.label} ${item.description ?? ""} ${item.keywords ?? ""}`.toLowerCase();
  const needle = query.toLowerCase();
  if (haystack.includes(needle)) return 2;
  const terms = needle.split(/\s+/).filter(Boolean);
  if (terms.every((term) => haystack.includes(term))) return 1;
  return 0;
}

export function CommandPalette({ open, onClose, commands, placeholder = "Jump to page, search conversations, or run a command" }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [, navigate] = useLocation();

  const filtered = useMemo(() => {
    return commands
      .map((cmd) => ({ cmd, s: score(cmd, query) }))
      .filter((entry) => entry.s > 0)
      .sort((a, b) => b.s - a.s)
      .map((entry) => entry.cmd);
  }, [commands, query]);

  const grouped = useMemo(() => {
    const groups = new Map<string, CommandItem[]>();
    filtered.forEach((cmd) => {
      const key = cmd.group ?? "Actions";
      const existing = groups.get(key) ?? [];
      existing.push(cmd);
      groups.set(key, existing);
    });
    return Array.from(groups.entries());
  }, [filtered]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setActiveIndex(0);
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLButtonElement>(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const runCommand = (cmd: CommandItem) => {
    onClose();
    if (cmd.onRun) {
      cmd.onRun();
    } else if (cmd.href) {
      navigate(cmd.href);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const cmd = filtered[activeIndex];
      if (cmd) runCommand(cmd);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} placement="top" ariaLabel="Command palette" initialFocusRef={inputRef}>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-float dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <Search className="h-4 w-4 text-slate-400 dark:text-slate-500" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
            aria-label="Search commands"
          />
          <kbd className="hidden items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-500 sm:inline-flex dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            ESC
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[55vh] overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
              No matching commands.
            </div>
          ) : (
            grouped.map(([group, items]) => (
              <div key={group} className="mb-1 last:mb-0">
                <p className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">{group}</p>
                {items.map((cmd) => {
                  const index = filtered.indexOf(cmd);
                  const active = index === activeIndex;
                  const Icon = cmd.icon ?? ArrowRight;
                  return (
                    <button
                      key={cmd.id}
                      data-index={index}
                      type="button"
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => runCommand(cmd)}
                      className={cn(
                        "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors",
                        active
                          ? "bg-slate-100 text-slate-950 dark:bg-slate-800 dark:text-slate-100"
                          : "text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/60",
                      )}
                    >
                      <span className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
                        active
                          ? "bg-white text-slate-800 shadow-sm dark:bg-slate-900 dark:text-slate-200"
                          : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
                      )}>
                        <Icon className="h-4 w-4" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{cmd.label}</span>
                        {cmd.description ? (
                          <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{cmd.description}</span>
                        ) : null}
                      </span>
                      {active ? (
                        <CornerDownLeft className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" aria-hidden />
                      ) : cmd.shortcut ? (
                        <kbd className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">{cmd.shortcut}</kbd>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-2 text-[11px] text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <kbd className="rounded-md border border-slate-200 bg-white px-1 font-mono text-[10px] font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">↑</kbd>
              <kbd className="rounded-md border border-slate-200 bg-white px-1 font-mono text-[10px] font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">↓</kbd>
              to navigate
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="rounded-md border border-slate-200 bg-white px-1 font-mono text-[10px] font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">↵</kbd>
              to select
            </span>
          </div>
          <span>{filtered.length} result{filtered.length === 1 ? "" : "s"}</span>
        </div>
      </div>
    </Dialog>
  );
}
