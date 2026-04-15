import { BarChart3, Inbox, LayoutDashboard, Settings, Shield, Ticket, Users } from "lucide-react";
import { Link, useLocation } from "wouter";

const primaryItems = [
  { href: "/dashboard", label: "Dashboard", description: "What needs attention now", icon: LayoutDashboard },
  { href: "/inbox", label: "Inbox", description: "Queue-driven conversation triage", icon: Inbox },
  { href: "/tickets", label: "Tickets", description: "Track active work objects", icon: Ticket },
  { href: "/customers", label: "Customers", description: "People, companies, and context", icon: Users },
  { href: "/settings", label: "Settings", description: "Inboxes, workflows, and team config", icon: Settings },
] as const;

const secondaryItems = [
  { href: "/platform-dashboard", label: "Legacy platform admin", icon: Shield },
] as const;

function isItemActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-slate-950 text-slate-50 lg:flex lg:flex-col">
      <div className="border-b border-slate-800 px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500/15 ring-1 ring-blue-400/20">
            <svg style={{ width: 24, height: 24, stroke: "#60A5FA", fill: "none", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }} viewBox="0 0 24 24">
              <path d="M3 21V9l5-4v16H3zm6 0V7l6-5v19H9zm8 0V5l4-3v19h-4z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">LIRE Help v2</p>
            <h1 className="text-base font-semibold text-white">Operations Workspace</h1>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <div className="mb-6 px-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Workflow</p>
        </div>
        <nav className="space-y-1">
          {primaryItems.map((item) => {
            const active = isItemActive(location, item.href);
            const Icon = item.icon;

            return (
              <Link key={item.href} href={item.href}>
                <a
                  className={[
                    "group flex items-start gap-3 rounded-2xl px-3 py-3 transition-colors",
                    active
                      ? "bg-slate-900 text-white ring-1 ring-slate-700"
                      : "text-slate-300 hover:bg-slate-900/70 hover:text-white",
                  ].join(" ")}
                >
                  <span className={[
                    "mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl border",
                    active
                      ? "border-blue-400/30 bg-blue-500/10 text-blue-300"
                      : "border-slate-800 bg-slate-900 text-slate-400 group-hover:text-slate-200",
                  ].join(" ")}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{item.label}</span>
                    <span className="mt-0.5 block text-xs text-slate-400">{item.description}</span>
                  </span>
                </a>
              </Link>
            );
          })}
        </nav>

        <div className="mt-8 px-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Temporary coexistence</p>
        </div>
        <nav className="mt-3 space-y-1">
          {secondaryItems.map((item) => {
            const active = isItemActive(location, item.href);
            const Icon = item.icon;

            return (
              <Link key={item.href} href={item.href}>
                <a
                  className={[
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                    active
                      ? "bg-slate-900 text-white ring-1 ring-slate-700"
                      : "text-slate-400 hover:bg-slate-900/70 hover:text-slate-200",
                  ].join(" ")}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </a>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-slate-800 px-5 py-4 text-xs text-slate-400">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 px-3 py-3">
          <div className="flex items-center gap-2 text-slate-200">
            <BarChart3 className="h-3.5 w-3.5 text-blue-300" />
            <span className="font-medium">Phase 1 scaffold</span>
          </div>
          <p className="mt-1 leading-relaxed text-slate-400">
            Route-driven shell, workflow-first nav, and inbox scaffolding are live here. Backend workflows stay unchanged.
          </p>
        </div>
      </div>
    </aside>
  );
}
