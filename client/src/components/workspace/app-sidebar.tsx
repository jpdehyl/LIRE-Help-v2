import { BarChart3, Inbox, LayoutDashboard, Settings, Shield, Ticket, Users } from "lucide-react";
import { Link, useLocation } from "wouter";

const primaryItems = [
  { href: "/dashboard", label: "Dashboard", description: "Overview and queue pressure", icon: LayoutDashboard },
  { href: "/inbox", label: "Inbox", description: "Conversations and triage", icon: Inbox },
  { href: "/tickets", label: "Tickets", description: "Track active work", icon: Ticket },
  { href: "/customers", label: "Customers", description: "Accounts and context", icon: Users },
  { href: "/settings", label: "Settings", description: "Team and workflow setup", icon: Settings },
] as const;

const secondaryItems = [
  { href: "/platform-dashboard", label: "Platform admin", icon: Shield },
] as const;

function isItemActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <aside className="hidden w-[292px] shrink-0 border-r border-slate-200 bg-[#f7f9fb] lg:flex lg:flex-col">
      <div className="border-b border-slate-200 px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-sm">
            <svg style={{ width: 22, height: 22, stroke: "currentColor", fill: "none", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }} viewBox="0 0 24 24">
              <path d="M3 21V9l5-4v16H3zm6 0V7l6-5v19H9zm8 0V5l4-3v19h-4z" />
            </svg>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Support workspace</p>
            <h1 className="text-base font-semibold tracking-tight text-slate-950">LIRE Help</h1>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div className="mb-6 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Today</p>
          <p className="mt-2 text-sm font-semibold text-slate-950">Operator workspace</p>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Cleaner shell, calmer navigation, and the same underlying helpdesk behavior.
          </p>
        </div>

        <div className="mb-3 px-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Core views</p>
        </div>
        <nav className="space-y-1.5">
          {primaryItems.map((item) => {
            const active = isItemActive(location, item.href);
            const Icon = item.icon;

            return (
              <Link key={item.href} href={item.href}>
                <a
                  className={[
                    "group flex items-start gap-3 rounded-[22px] border px-3 py-3 transition-all",
                    active
                      ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                      : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-white hover:text-slate-950 hover:shadow-sm",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl border transition-colors",
                      active
                        ? "border-white/10 bg-white/10 text-white"
                        : "border-slate-200 bg-slate-100 text-slate-500 group-hover:bg-slate-50 group-hover:text-slate-700",
                    ].join(" ")}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold tracking-tight">{item.label}</span>
                    <span className={[
                      "mt-1 block text-xs leading-5",
                      active ? "text-slate-300" : "text-slate-500",
                    ].join(" ")}>
                      {item.description}
                    </span>
                  </span>
                </a>
              </Link>
            );
          })}
        </nav>

        <div className="mt-8 mb-3 px-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Administration</p>
        </div>
        <nav className="space-y-1.5">
          {secondaryItems.map((item) => {
            const active = isItemActive(location, item.href);
            const Icon = item.icon;

            return (
              <Link key={item.href} href={item.href}>
                <a
                  className={[
                    "flex items-center gap-3 rounded-2xl border px-3 py-3 text-sm font-medium transition-all",
                    active
                      ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                      : "border-transparent text-slate-500 hover:border-slate-200 hover:bg-white hover:text-slate-900 hover:shadow-sm",
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

      <div className="border-t border-slate-200 px-6 py-5">
        <div className="rounded-[24px] border border-slate-200 bg-white p-4 text-xs text-slate-500 shadow-sm">
          <div className="flex items-center gap-2 text-slate-900">
            <BarChart3 className="h-4 w-4" />
            <span className="font-semibold">Ops pulse</span>
          </div>
          <p className="mt-2 leading-6">
            Visible surfaces now bias toward an Intercom-style support shell while preserving current routes and workflows.
          </p>
        </div>
      </div>
    </aside>
  );
}
