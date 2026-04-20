import { useEffect, useState, type ReactNode } from "react";
import {
  Bell,
  ChevronRight,
  Command,
  Inbox as InboxIcon,
  LayoutDashboard,
  LogOut,
  Maximize,
  Menu,
  Monitor,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  Shield,
  Sun,
  Users,
} from "lucide-react";
import { useAuth } from "../../lib/auth";
import { useTheme } from "../../lib/theme";
import { AppSidebar } from "./app-sidebar";
import { CommandPalette, Sheet, type CommandItem } from "../ui";

interface WorkspaceShellProps {
  title: string;
  children: ReactNode;
  eyebrow?: string;
  actions?: ReactNode;
}

const navigationCommands: CommandItem[] = [
  { id: "go-dashboard", label: "Go to Dashboard", href: "/dashboard", icon: LayoutDashboard, group: "Navigation", keywords: "home overview metrics" },
  { id: "go-inbox", label: "Go to Inbox", href: "/inbox/all", icon: InboxIcon, group: "Navigation", keywords: "queue conversations support" },
  { id: "go-inbox-unassigned", label: "Unassigned inbox", href: "/inbox/unassigned", icon: InboxIcon, group: "Navigation", keywords: "unassigned triage" },
  { id: "go-inbox-sla", label: "SLA at risk", href: "/inbox/escalations", icon: InboxIcon, group: "Navigation", keywords: "sla breached at risk escalations" },
  { id: "go-tenants", label: "Go to Tenants", href: "/tenants", icon: Users, group: "Navigation", keywords: "tenants companies occupants" },
  { id: "go-settings", label: "Go to Settings", href: "/settings", icon: Settings, group: "Navigation", keywords: "preferences config admin" },
  { id: "go-platform", label: "Platform admin", href: "/platform-dashboard", icon: Shield, group: "Navigation", keywords: "admin platform internal" },
];

const FOCUS_STORAGE_KEY = "workspace:focus";
const NAV_COLLAPSED_STORAGE_KEY = "workspace:nav-collapsed";

function readNavCollapsedPreference(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(NAV_COLLAPSED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function readFocusPreference(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(FOCUS_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function WorkspaceShell({ title, children, eyebrow = "Operations", actions }: WorkspaceShellProps) {
  const { logout } = useAuth();
  const { mode, resolved, setMode, toggle } = useTheme();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [focusMode, setFocusMode] = useState<boolean>(() => readFocusPreference());
  const [navCollapsed, setNavCollapsed] = useState<boolean>(() => readNavCollapsedPreference());

  useEffect(() => {
    try {
      window.localStorage.setItem(NAV_COLLAPSED_STORAGE_KEY, navCollapsed ? "1" : "0");
    } catch {
      // ignore quota / privacy-mode errors
    }
  }, [navCollapsed]);

  useEffect(() => {
    try {
      window.localStorage.setItem(FOCUS_STORAGE_KEY, focusMode ? "1" : "0");
    } catch {
      // ignore quota / privacy-mode errors
    }
  }, [focusMode]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      } else if ((event.metaKey || event.ctrlKey) && event.key === ".") {
        event.preventDefault();
        setFocusMode((value) => !value);
      } else if (event.key === "/" && !isTyping) {
        event.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const commands: CommandItem[] = [
    ...navigationCommands,
    {
      id: "theme-light",
      label: "Switch to light theme",
      icon: Sun,
      group: "Appearance",
      keywords: "theme light appearance",
      onRun: () => setMode("light"),
    },
    {
      id: "theme-dark",
      label: "Switch to dark theme",
      icon: Moon,
      group: "Appearance",
      keywords: "theme dark appearance",
      onRun: () => setMode("dark"),
    },
    {
      id: "theme-system",
      label: "Follow system theme",
      icon: Monitor,
      group: "Appearance",
      keywords: "theme system auto appearance",
      onRun: () => setMode("system"),
    },
    {
      id: "action-signout",
      label: "Sign out",
      description: "End your workspace session",
      icon: LogOut,
      group: "Account",
      onRun: () => logout(),
    },
  ];

  const ThemeIcon = mode === "system" ? Monitor : resolved === "dark" ? Moon : Sun;
  const themeLabel = mode === "system" ? "Theme: system" : resolved === "dark" ? "Theme: dark" : "Theme: light";

  // Parse breadcrumb trail from "eyebrow" format "A / B / C".
  const crumbs = eyebrow.split("/").map((s) => s.trim()).filter(Boolean);
  const allCrumbs = crumbs.length > 0 ? [...crumbs, title] : [title];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg text-fg">
      {focusMode || navCollapsed ? null : <AppSidebar />}

      <Sheet open={navOpen} onClose={() => setNavOpen(false)} ariaLabel="Workspace navigation">
        <AppSidebar embedded onNavigate={() => setNavOpen(false)} />
      </Sheet>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} commands={commands} />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-4 sm:px-5">
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            className="grid h-8 w-8 place-items-center rounded-sm text-fg-muted transition-colors ease-ds duration-fast hover:bg-surface-2 hover:text-fg lg:hidden"
            aria-label="Open workspace navigation"
          >
            <Menu className="h-4 w-4" />
          </button>
          {/* Desktop collapse toggle — hides/shows the left nav without
              the full Focus-mode take-over. Hidden on mobile (the hamburger
              above handles that size class). */}
          <button
            type="button"
            onClick={() => setNavCollapsed((value) => !value)}
            aria-pressed={navCollapsed}
            title={navCollapsed ? "Show navigation" : "Hide navigation"}
            className="hidden h-8 w-8 place-items-center rounded-sm text-fg-muted transition-colors ease-ds duration-fast hover:bg-surface-2 hover:text-fg lg:grid"
          >
            {navCollapsed ? <PanelLeftOpen className="h-3.5 w-3.5" /> : <PanelLeftClose className="h-3.5 w-3.5" />}
          </button>

          <nav
            aria-label="Breadcrumb"
            className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden font-body text-[13px]"
          >
            {allCrumbs.map((c, i) => (
              <span key={`${c}-${i}`} className="flex items-center gap-2 min-w-0">
                {i > 0 ? <ChevronRight className="h-3.5 w-3.5 shrink-0 text-fg-subtle" /> : null}
                <span
                  className={[
                    "truncate",
                    i === allCrumbs.length - 1 ? "font-semibold text-fg" : "text-fg-muted",
                  ].join(" ")}
                >
                  {c}
                </span>
              </span>
            ))}
          </nav>

          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            aria-label="Open command palette"
            className="hidden items-center gap-2 rounded-sm border border-border bg-surface-2 px-2.5 py-1.5 font-body text-[12px] text-fg-muted transition-colors ease-ds duration-fast hover:bg-surface sm:inline-flex min-[720px]:min-w-[220px]"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="flex-1 text-left">Jump to…</span>
            <span className="inline-flex items-center rounded-xs border border-border bg-surface px-1.5 py-[1px] font-mono text-[10px] font-medium text-fg-muted">
              <Command className="mr-0.5 h-2.5 w-2.5" />K
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFocusMode((value) => !value)}
            aria-pressed={focusMode}
            title={focusMode ? "Exit focus mode (⌘.)" : "Enter focus mode (⌘.)"}
            className={[
              "hidden h-7 items-center gap-1.5 rounded-sm px-2 font-body text-[12px] font-medium transition-colors ease-ds duration-fast sm:inline-flex",
              focusMode
                ? "bg-fg text-surface hover:opacity-90"
                : "text-fg-muted hover:bg-surface-2 hover:text-fg",
            ].join(" ")}
          >
            <Maximize className="h-3 w-3" />
            <span>{focusMode ? "Exit focus" : "Focus"}</span>
          </button>
          <button
            type="button"
            onClick={toggle}
            onContextMenu={(event) => {
              event.preventDefault();
              setMode("system");
            }}
            aria-label={themeLabel}
            title={`${themeLabel} — click to toggle, right-click to follow system`}
            className="grid h-8 w-8 place-items-center rounded-sm text-fg-muted transition-colors ease-ds duration-fast hover:bg-surface-2 hover:text-fg"
          >
            <ThemeIcon className="h-3.5 w-3.5" />
          </button>
          <button
            className="grid h-8 w-8 place-items-center rounded-sm text-fg-muted transition-colors ease-ds duration-fast hover:bg-surface-2 hover:text-fg"
            aria-label="Notifications"
          >
            <Bell className="h-3.5 w-3.5" />
          </button>
          {actions}
        </header>

        <main className="min-h-0 flex-1 overflow-auto bg-bg">
          <div className="mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-5 lg:px-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
