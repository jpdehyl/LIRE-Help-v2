import {
  BookOpen,
  Bot,
  Building2,
  ChevronRight,
  Inbox,
  Radio,
  Settings,
  Shield,
  Sparkles,
  UserCircle2,
  BarChart3,
  type LucideIcon,
} from "lucide-react";
import { Link, useLocation } from "wouter";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
};

const primaryItems: readonly NavItem[] = [
  { href: "/inbox", label: "Inbox", icon: Inbox, badge: "Live" },
  { href: "/agent", label: "Agent", icon: Bot },
  { href: "/knowledge", label: "Knowledge", icon: BookOpen },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/outbound", label: "Outbound", icon: Radio },
  { href: "/contacts", label: "Contacts", icon: Building2 },
];

const secondaryItems: readonly NavItem[] = [{ href: "/platform-dashboard", label: "Platform admin", icon: Shield }];

function isItemActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <aside className="hidden w-[304px] shrink-0 border-r border-slate-200 bg-[#f5f7f8] lg:flex lg:flex-col">
      <div className="border-b border-slate-200 px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-[1.35rem] bg-slate-950 text-white shadow-sm">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">LIRE Help</p>
            <h1 className="text-base font-semibold tracking-tight text-slate-950">Property ops workspace</h1>
          </div>
        </div>
      </div>

      <div className="px-4 py-5">
        <div className="rounded-[28px] border border-slate-200 bg-[#111827] p-4 text-white shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Mission control</p>
          <h2 className="mt-2 text-base font-semibold tracking-tight">Inbox runs the floor.</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Agents handle routing, knowledge, follow-up, and reporting around the live conversation stream.
          </p>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-5">
        <div className="mb-3 px-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Workspace</p>
        </div>
        <nav className="space-y-1.5">
          {primaryItems.map((item) => {
            const active = isItemActive(location, item.href);
            const Icon = item.icon;

            return (
              <Link key={item.href} href={item.href}>
                <a
                  className={[
                    "group flex items-center gap-3 rounded-[22px] border px-3 py-3 transition-all",
                    active
                      ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                      : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-white hover:text-slate-950 hover:shadow-sm",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "flex h-10 w-10 items-center justify-center rounded-2xl border transition-colors",
                      active
                        ? "border-white/10 bg-white/10 text-white"
                        : "border-slate-200 bg-slate-100 text-slate-500 group-hover:bg-slate-50 group-hover:text-slate-700",
                    ].join(" ")}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="flex min-w-0 flex-1 items-center gap-2 text-sm font-semibold tracking-tight">
                    {item.label}
                    {item.badge ? (
                      <span className={[
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]",
                        active ? "bg-white/10 text-slate-200" : "bg-emerald-50 text-emerald-700",
                      ].join(" ")}>
                        {item.badge}
                      </span>
                    ) : null}
                  </span>
                  <ChevronRight className={["h-4 w-4 shrink-0", active ? "text-slate-300" : "text-slate-300 group-hover:text-slate-500"].join(" ")} />
                </a>
              </Link>
            );
          })}
        </nav>

        <div className="mt-8 mb-3 px-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Admin</p>
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

      <div className="border-t border-slate-200 px-4 py-4">
        <Link href="/settings">
          <a className="flex items-center gap-3 rounded-[22px] border border-slate-200 bg-white px-4 py-4 shadow-sm transition hover:border-slate-300 hover:bg-slate-50">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
              <UserCircle2 className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">Jordan Parker</p>
              <p className="mt-1 text-xs text-slate-500">Workspace owner · Settings and profile</p>
            </div>
            <Settings className="h-4 w-4 text-slate-400" />
          </a>
        </Link>
      </div>
    </aside>
  );
}
