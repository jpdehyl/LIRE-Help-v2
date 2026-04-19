import {
  Briefcase,
  LayoutDashboard,
  Inbox as InboxIcon,
  Settings,
  ShieldAlert,
  Ticket,
  Users,
  Shield,
  Settings2,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "../../lib/auth";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
};

const primaryItems: readonly NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/inbox", label: "Inbox", icon: InboxIcon },
  { href: "/tickets", label: "Tickets", icon: Ticket },
  { href: "/customers", label: "Customers", icon: Users },
];

const pilotItems: readonly NavItem[] = [
  { href: "/leasing", label: "Leasing", icon: Briefcase },
  { href: "/credit-review", label: "Credit review", icon: ShieldAlert },
];

const adminItems: readonly NavItem[] = [
  { href: "/settings", label: "Settings", icon: Settings2 },
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
        <SectionItems items={primaryItems} location={location} onNavigate={onNavigate} />

        <Divider />
        <SectionLabel>Pilots</SectionLabel>
        <SectionItems items={pilotItems} location={location} onNavigate={onNavigate} />

        <Divider />
        <SectionLabel>Admin</SectionLabel>
        <SectionItems items={adminItems} location={location} onNavigate={onNavigate} />
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
  onNavigate,
}: {
  items: readonly NavItem[];
  location: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="space-y-0.5">
      {items.map((item) => {
        const active = isItemActive(location, item.href);
        const Icon = item.icon;
        return (
          <Link key={item.href} href={item.href}>
            <a
              onClick={() => onNavigate?.()}
              className={[
                "flex items-center gap-2.5 rounded-sm px-2.5 py-2 font-body text-[13px] font-medium transition-colors ease-ds duration-fast",
                active
                  ? "bg-fg text-surface"
                  : "text-fg-muted hover:bg-surface-2 hover:text-fg",
              ].join(" ")}
            >
              <Icon className={["h-4 w-4 shrink-0", active ? "text-accent" : ""].join(" ")} />
              <span className="flex-1 truncate">{item.label}</span>
              {item.badge ? (
                <span className="rounded-xs bg-surface-2 px-1.5 py-[1px] font-body text-[10px] font-semibold uppercase tracking-eyebrow text-fg-muted">
                  {item.badge}
                </span>
              ) : null}
            </a>
          </Link>
        );
      })}
    </div>
  );
}
