import { useEffect, useState, type ReactNode } from "react";
import {
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  Building2,
  Command,
  Inbox as InboxIcon,
  LayoutDashboard,
  LogOut,
  Menu,
  Monitor,
  Moon,
  Plus,
  Radio,
  Search,
  Settings,
  Shield,
  Sun,
  Ticket,
  Users,
} from "lucide-react";
import { useAuth } from "../../lib/auth";
import { useTheme } from "../../lib/theme";
import { AppSidebar } from "./app-sidebar";
import { CommandPalette, Eyebrow, Heading, Sheet, type CommandItem } from "../ui";

interface WorkspaceShellProps {
  title: string;
  children: ReactNode;
  eyebrow?: string;
  actions?: ReactNode;
}

const navigationCommands: CommandItem[] = [
  { id: "go-dashboard", label: "Dashboard", description: "Operator metrics and property summary", href: "/dashboard", icon: LayoutDashboard, group: "Navigation", keywords: "home overview metrics" },
  { id: "go-inbox", label: "Inbox", description: "All open conversations", href: "/inbox/all", icon: InboxIcon, group: "Navigation", keywords: "queue conversations support" },
  { id: "go-inbox-unassigned", label: "Unassigned inbox", description: "Conversations with no owner", href: "/inbox/unassigned", icon: InboxIcon, group: "Navigation", keywords: "unassigned triage" },
  { id: "go-inbox-sla", label: "SLA at risk", description: "Queue filtered to SLA risk", href: "/inbox/sla_at_risk", icon: InboxIcon, group: "Navigation", keywords: "sla breached at risk" },
  { id: "go-tickets", label: "Tickets", description: "Linked work objects", href: "/tickets", icon: Ticket, group: "Navigation" },
  { id: "go-customers", label: "Customers", description: "Companies and contacts", href: "/customers", icon: Users, group: "Navigation", keywords: "companies accounts" },
  { id: "go-settings", label: "Settings", description: "Inboxes, workflows, and team config", href: "/settings", icon: Settings, group: "Navigation", keywords: "preferences config admin" },
  { id: "go-platform", label: "Platform admin", description: "Properties, agents, and knowledge base", href: "/platform-dashboard", icon: Shield, group: "Navigation", keywords: "admin platform internal" },
  { id: "go-agent", label: "Agent", href: "/agent", icon: Bot, group: "Workspace" },
  { id: "go-knowledge", label: "Knowledge", href: "/knowledge", icon: BookOpen, group: "Workspace" },
  { id: "go-reports", label: "Reports", href: "/reports", icon: BarChart3, group: "Workspace" },
  { id: "go-outbound", label: "Outbound", href: "/outbound", icon: Radio, group: "Workspace" },
  { id: "go-contacts", label: "Contacts", href: "/contacts", icon: Building2, group: "Workspace" },
];

export function WorkspaceShell({ title, children, eyebrow = "Support workspace", actions }: WorkspaceShellProps) {
  const { user, logout } = useAuth();
  const { mode, resolved, setMode, toggle } = useTheme();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target && (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      );
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
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

  return (
    <div className="flex min-h-screen bg-transparent text-slate-900 dark:text-slate-100">
      <AppSidebar />

      <Sheet open={navOpen} onClose={() => setNavOpen(false)} ariaLabel="Workspace navigation">
        <AppSidebar embedded onNavigate={() => setNavOpen(false)} />
      </Sheet>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} commands={commands} />

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-slate-200/90 bg-white/85 px-4 py-4 backdrop-blur-xl supports-[backdrop-filter]:bg-white/75 sm:px-6 lg:px-8 dark:border-slate-800/80 dark:bg-slate-950/70 dark:supports-[backdrop-filter]:bg-slate-950/60">
          <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => setNavOpen(true)}
                className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 lg:hidden dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                aria-label="Open workspace navigation"
              >
                <Menu className="h-4 w-4" />
              </button>

              <div>
                <Eyebrow>{eyebrow}</Eyebrow>
                <Heading level={1} size="display" className="mt-2">{title}</Heading>
              </div>
            </div>

            <div className="flex flex-col gap-3 xl:items-end">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPaletteOpen(true)}
                  className="flex min-h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-500 shadow-sm transition hover:border-slate-300 hover:bg-white min-[420px]:min-w-[300px] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:bg-slate-800"
                  aria-label="Open command palette"
                >
                  <Search className="h-4 w-4" />
                  <span className="flex-1 text-left">Search conversations, tickets, or customers</span>
                  <span className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-400 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                    <Command className="inline h-3 w-3" />K
                  </span>
                </button>
                <button className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">
                  <Plus className="h-4 w-4" />
                  Create
                </button>
                <button
                  type="button"
                  onClick={toggle}
                  onContextMenu={(event) => { event.preventDefault(); setMode("system"); }}
                  aria-label={themeLabel}
                  title={`${themeLabel} — click to toggle, right-click to follow system`}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <ThemeIcon className="h-4 w-4" />
                </button>
                <button className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800" aria-label="Notifications">
                  <Bell className="h-4 w-4" />
                </button>
                {actions}
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-medium capitalize text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  {user?.role ?? "staff"}
                </span>
                <div className="rounded-full border border-slate-200 bg-white px-3 py-1.5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                  {user?.name ?? user?.email}
                </div>
                <button onClick={logout} className="inline-flex items-center gap-1.5 font-medium text-slate-600 transition hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100">
                  <LogOut className="h-3.5 w-3.5" />
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-[1440px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
