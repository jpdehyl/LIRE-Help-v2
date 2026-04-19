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

export function CommandPalette({
  open,
  onClose,
  commands,
  placeholder = "Search tickets, properties, commands…",
}: CommandPaletteProps) {
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
      <div className="overflow-hidden rounded-md border border-border bg-surface shadow-menu">
        <div className="flex items-center gap-2.5 border-b border-border px-3.5 py-3">
          <Search className="h-4 w-4 text-fg-muted" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full bg-transparent font-body text-[14px] text-fg outline-none placeholder:text-fg-subtle"
            aria-label="Search commands"
          />
          <Kbd>ESC</Kbd>
        </div>

        <div ref={listRef} className="max-h-[50vh] overflow-y-auto py-1.5">
          {filtered.length === 0 ? (
            <div className="px-4 py-10 text-center font-body text-[13px] text-fg-muted">No matching commands.</div>
          ) : (
            grouped.map(([group, items]) => (
              <div key={group} className="mb-1 last:mb-0">
                <p className="eyebrow px-4 pb-1 pt-2.5 text-fg-subtle">{group}</p>
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
                        "flex w-full items-center gap-2.5 px-4 py-2 text-left font-body text-[13px] transition-colors ease-ds duration-fast",
                        active ? "bg-surface-2 text-fg" : "text-fg hover:bg-surface-2",
                      )}
                    >
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center text-fg-muted">
                        <Icon className="h-3.5 w-3.5" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{cmd.label}</span>
                        {cmd.description ? (
                          <span className="block truncate text-[11px] text-fg-subtle">{cmd.description}</span>
                        ) : null}
                      </span>
                      {active ? (
                        <CornerDownLeft className="h-3.5 w-3.5 text-fg-subtle" aria-hidden />
                      ) : cmd.shortcut ? (
                        <Kbd>{cmd.shortcut}</Kbd>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border bg-surface-2 px-4 py-2 font-body text-[11px] text-fg-muted">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd>
              to navigate
            </span>
            <span className="inline-flex items-center gap-1">
              <Kbd>↵</Kbd>
              to select
            </span>
          </div>
          <span>
            {filtered.length} result{filtered.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>
    </Dialog>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center rounded-xs border border-border bg-surface-2 px-1.5 py-[2px] font-mono text-[10px] font-medium leading-none text-fg-muted">
      {children}
    </kbd>
  );
}
