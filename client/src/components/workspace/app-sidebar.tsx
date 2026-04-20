import {
  BookOpen,
  Briefcase,
  Building2,
  Hash,
  LayoutDashboard,
  Inbox as InboxIcon,
  Settings,
  Shield,
  ShieldCheck,
  Sparkles,
  LogOut,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../lib/auth";
import { helpdeskApi } from "../../lib/helpdesk";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badgeKey?: "openConversations" | "slaAtRisk" | "resolvedToday";
  disabled?: boolean;
};

const primaryItems: readonly NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/inbox", label: "Inbox", icon: InboxIcon, badgeKey: "openConversations" },
  { href: "/settings/inboxes", label: "Channels", icon: Hash },
  { href: "/concierge", label: "Concierge", icon: Sparkles },
  { href: "/tenants", label: "Tenants", icon: Building2 },
  { href: "/credit-review", label: "Compliance", icon: ShieldCheck, badgeKey: "slaAtRisk" },
  { href: "/vendors", label: "Vendors", icon: Wrench, disabled: true },
  { href: "/library", label: "Library", icon: BookOpen, disabled: true },
];

const pilotItems: readonly NavItem[] = [
  { href: "/leasing", label: "Leasing", icon: Briefcase },
];

const adminItems: readonly NavItem[] = [
  { href: "/platform-dashboard", label: "Platform admin", icon: Shield },
];

function isItemActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

interface AppSidebarProps {
  embedded?: boolean;
  onNavigate?: () => void;
}

export function AppSidebar({ embedded = false, onNavigate }: AppSidebarProps = {}) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const propertiesQuery = useQuery({
    queryKey: ["helpdesk", "properties-summary"],
    queryFn: helpdeskApi.getPropertiesSummary,
    staleTime: 60_000,
  });
  const metricsQuery = useQuery({
    queryKey: ["helpdesk", "dashboard", "metrics"],
    queryFn: helpdeskApi.getDashboardMetrics,
    staleTime: 60_000,
  });
  const properties = propertiesQuery.data?.properties ?? [];
  const badges = {
    openConversations: metricsQuery.data?.summary.openConversations ?? 0,
    slaAtRisk: metricsQuery.data?.summary.slaAtRisk ?? 0,
    resolvedToday: metricsQuery.data?.summary.resolvedToday ?? 0,
  };

  const asideClass = embedded
    ? "flex h-full w-full flex-col bg-surface"
    : "hidden w-[220px] shrink-0 border-r border-border bg-surface lg:flex lg:flex-col";

  const initials = (user?.name || user?.email || "·")
    .split(/[\s@]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "·";

  return (
    <aside className={asideClass}>
      {/* Logo block */}
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-[14px]">
        <div className="flex h-[26px] w-[26px] items-center justify-center rounded-xs bg-fg text-accent font-display text-[14px] font-bold leading-none">
          L
        </div>
        <div className="min-w-0">
          <div className="font-display text-[17px] font-bold tracking-tight text-fg">LIRE Help</div>
          <div className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-subtle">
            DEHYL · OPERATIONS
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
        <SectionItems items={primaryItems} location={location} badges={badges} onNavigate={onNavigate} />

        <Divider />
        <SectionLabel>Pilots</SectionLabel>
        <SectionItems items={pilotItems} location={location} badges={badges} onNavigate={onNavigate} />

        <Divider />
        <SectionLabel>Admin</SectionLabel>
        <SectionItems items={adminItems} location={location} badges={badges} onNavigate={onNavigate} />

        {properties.length > 0 ? (
          <>
            <Divider />
            <SectionLabel>Portfolio</SectionLabel>
            <div className="space-y-0.5">
              {properties.map((p) => (
                <Link key={p.id} href={`/inbox/all?propertyId=${p.id}`}>
                  <a
                    onClick={() => onNavigate?.()}
                    className="flex items-center gap-2.5 rounded-sm px-2.5 py-1.5 font-body text-[12px] text-fg-muted transition-colors ease-ds duration-fast hover:bg-surface-2 hover:text-fg"
                    title={p.name}
                  >
                    <span className="font-mono text-[10px] text-fg-subtle shrink-0">{p.code}</span>
                    <span className="flex-1 truncate">{p.name}</span>
                  </a>
                </Link>
              ))}
            </div>
          </>
        ) : null}
      </nav>

      {/* Footer: user */}
      <div className="flex items-center gap-2.5 border-t border-border px-3 py-2.5">
        <div className="grid h-7 w-7 place-items-center rounded-full border border-border bg-surface-2 font-display text-[11px] font-bold text-fg">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-body text-[12px] font-semibold text-fg">
            {user?.name ?? "Guest"}
          </div>
          <div className="truncate font-body text-[11px] text-fg-muted">
            {user?.email ?? "Not signed in"}
          </div>
        </div>
        <Link href="/settings">
          <a
            onClick={() => onNavigate?.()}
            title="Settings"
            aria-label="Settings"
            className="grid h-7 w-7 place-items-center rounded-sm text-fg-muted transition-colors ease-ds duration-fast hover:bg-surface-2 hover:text-fg"
          >
            <Settings className="h-3.5 w-3.5" />
          </a>
        </Link>
        <button
          type="button"
          onClick={() => logout()}
          title="Sign out"
          aria-label="Sign out"
          className="grid h-7 w-7 place-items-center rounded-sm text-fg-muted transition-colors ease-ds duration-fast hover:bg-surface-2 hover:text-fg"
        >
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </div>
    </aside>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="eyebrow px-2.5 pb-1.5 pt-0.5 text-fg-subtle">{children}</div>;
}

function Divider() {
  return <div className="mx-2.5 my-3 h-px bg-border" />;
}

function SectionItems({
  items,
  location,
  badges,
  onNavigate,
}: {
  items: readonly NavItem[];
  location: string;
  badges: { openConversations: number; slaAtRisk: number; resolvedToday: number };
  onNavigate?: () => void;
}) {
  return (
    <div className="space-y-0.5">
      {items.map((item) => {
        const active = !item.disabled && isItemActive(location, item.href);
        const Icon = item.icon;
        const badgeValue = item.badgeKey ? badges[item.badgeKey] : 0;
        const showBadge = !item.disabled && item.badgeKey && badgeValue > 0;

        const row = (
          <div
            className={[
              "flex items-center gap-2.5 rounded-sm px-2.5 py-2 font-body text-[13px] font-medium transition-colors ease-ds duration-fast",
              item.disabled
                ? "cursor-not-allowed text-fg-subtle"
                : active
                  ? "bg-fg text-surface"
                  : "text-fg-muted hover:bg-surface-2 hover:text-fg",
            ].join(" ")}
          >
            <Icon className={["h-4 w-4 shrink-0", active ? "text-accent" : ""].join(" ")} />
            <span className="flex-1 truncate">{item.label}</span>
            {showBadge ? (
              <span className="rounded-xs bg-surface-2 px-1.5 py-[1px] font-mono text-[10px] font-semibold text-fg-muted">
                {badgeValue}
              </span>
            ) : item.disabled ? (
              <span className="rounded-xs border border-border px-1.5 py-[1px] font-mono text-[9px] font-semibold uppercase tracking-eyebrow text-fg-subtle">
                soon
              </span>
            ) : null}
          </div>
        );

        return item.disabled ? (
          <div key={item.href} aria-disabled="true" title={`${item.label} — coming soon`}>
            {row}
          </div>
        ) : (
          <Link key={item.href} href={item.href}>
            <a onClick={() => onNavigate?.()}>{row}</a>
          </Link>
        );
      })}
    </div>
  );
}
