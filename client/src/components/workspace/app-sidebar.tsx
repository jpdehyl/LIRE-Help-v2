import {
  BookOpen,
  Bot,
  Briefcase,
  Building2,
  ChevronRight,
  Inbox,
  Radio,
  Settings,
  Shield,
  ShieldAlert,
  Sparkles,
  UserCircle2,
  BarChart3,
  type LucideIcon,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { Eyebrow, Heading } from "../ui";

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

const pilotItems: readonly NavItem[] = [
  { href: "/leasing", label: "Leasing", icon: Briefcase, badge: "Pilot A" },
  { href: "/credit-review", label: "Credit review", icon: ShieldAlert, badge: "Pilot B" },
];

const secondaryItems: readonly NavItem[] = [{ href: "/platform-dashboard", label: "Platform admin", icon: Shield }];

function isItemActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

interface AppSidebarProps {
  embedded?: boolean;
  onNavigate?: () => void;
}

export function AppSidebar({ embedded = false, onNavigate }: AppSidebarProps = {}) {
  const [location] = useLocation();
  const asideClass = embedded
    ? "flex h-full w-full flex-col bg-[#f5f7f8] dark:bg-slate-950"
    : "hidden w-[304px] shrink-0 border-r border-slate-200 bg-[#f5f7f8] lg:flex lg:flex-col dark:border-slate-800 dark:bg-slate-950";

  return (
    <aside className={asideClass}>
      <div className="border-b border-slate-200 px-6 py-6 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-[1.35rem] bg-slate-950 text-white shadow-sm dark:bg-slate-100 dark:text-slate-900">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <Eyebrow>LIRE Help</Eyebrow>
            <Heading level={1} size="h3">Property ops workspace</Heading>
          </div>
        </div>
      </div>

      <div className="px-4 py-5">
        <div className="rounded-[28px] border border-slate-200 bg-[#111827] p-4 text-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <Eyebrow>Mission control</Eyebrow>
          <h2 className="mt-2 text-base font-semibold tracking-tight text-white">Inbox runs the floor.</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Agents handle routing, knowledge, follow-up, and reporting around the live conversation stream.
          </p>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-5">
        <div className="mb-3 px-2">
          <Eyebrow>Workspace</Eyebrow>
        </div>
        <nav className="space-y-1.5">
          {primaryItems.map((item) => {
            const active = isItemActive(location, item.href);
            const Icon = item.icon;

            return (
              <Link key={item.href} href={item.href}>
                <a
                  onClick={() => onNavigate?.()}
                  className={[
                    "group flex items-center gap-3 rounded-[22px] border px-3 py-3 transition-all",
                    active
                      ? "border-slate-900 bg-slate-900 text-white shadow-sm dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                      : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-white hover:text-slate-950 hover:shadow-sm dark:text-slate-300 dark:hover:border-slate-800 dark:hover:bg-slate-900 dark:hover:text-slate-100",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "flex h-10 w-10 items-center justify-center rounded-2xl border transition-colors",
                      active
                        ? "border-white/10 bg-white/10 text-white dark:border-slate-900/20 dark:bg-slate-900/10 dark:text-slate-900"
                        : "border-slate-200 bg-slate-100 text-slate-500 group-hover:bg-slate-50 group-hover:text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:group-hover:bg-slate-800 dark:group-hover:text-slate-200",
                    ].join(" ")}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="flex min-w-0 flex-1 items-center gap-2 text-sm font-semibold tracking-tight">
                    {item.label}
                    {item.badge ? (
                      <span className={[
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]",
                        active
                          ? "bg-white/10 text-slate-200 dark:bg-slate-900/10 dark:text-slate-700"
                          : "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
                      ].join(" ")}>
                        {item.badge}
                      </span>
                    ) : null}
                  </span>
                  <ChevronRight className={["h-4 w-4 shrink-0", active ? "text-slate-300 dark:text-slate-600" : "text-slate-300 group-hover:text-slate-500 dark:text-slate-600 dark:group-hover:text-slate-400"].join(" ")} />
                </a>
              </Link>
            );
          })}
        </nav>

        <div className="mt-8 mb-3 px-2">
          <Eyebrow>Pilots</Eyebrow>
        </div>
        <nav className="space-y-1.5">
          {pilotItems.map((item) => {
            const active = isItemActive(location, item.href);
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}>
                <a
                  onClick={() => onNavigate?.()}
                  className={[
                    "flex items-center gap-3 rounded-2xl border px-3 py-3 text-sm font-medium transition-all",
                    active
                      ? "border-slate-900 bg-slate-900 text-white shadow-sm dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                      : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-white hover:text-slate-900 hover:shadow-sm dark:text-slate-400 dark:hover:border-slate-800 dark:hover:bg-slate-900 dark:hover:text-slate-200",
                  ].join(" ")}
                >
                  <Icon className="h-4 w-4" />
                  <span className="flex-1">{item.label}</span>
                  {item.badge ? (
                    <span
                      className={[
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]",
                        active
                          ? "bg-white/10 text-slate-200 dark:bg-slate-900/10 dark:text-slate-700"
                          : "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300",
                      ].join(" ")}
                    >
                      {item.badge}
                    </span>
                  ) : null}
                </a>
              </Link>
            );
          })}
        </nav>

        <div className="mt-8 mb-3 px-2">
          <Eyebrow>Admin</Eyebrow>
        </div>
        <nav className="space-y-1.5">
          {secondaryItems.map((item) => {
            const active = isItemActive(location, item.href);
            const Icon = item.icon;

            return (
              <Link key={item.href} href={item.href}>
                <a
                  onClick={() => onNavigate?.()}
                  className={[
                    "flex items-center gap-3 rounded-2xl border px-3 py-3 text-sm font-medium transition-all",
                    active
                      ? "border-slate-900 bg-slate-900 text-white shadow-sm dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                      : "border-transparent text-slate-500 hover:border-slate-200 hover:bg-white hover:text-slate-900 hover:shadow-sm dark:text-slate-400 dark:hover:border-slate-800 dark:hover:bg-slate-900 dark:hover:text-slate-200",
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

      <div className="border-t border-slate-200 px-4 py-4 dark:border-slate-800">
        <Link href="/settings">
          <a
            onClick={() => onNavigate?.()}
            className="flex items-center gap-3 rounded-[22px] border border-slate-200 bg-white px-4 py-4 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700 dark:hover:bg-slate-800"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <UserCircle2 className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Jordan Parker</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Workspace owner · Settings and profile</p>
            </div>
            <Settings className="h-4 w-4 text-slate-400 dark:text-slate-500" />
          </a>
        </Link>
      </div>
    </aside>
  );
}
