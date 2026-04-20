import { AlertTriangle, ArrowRight, CheckCircle2, Inbox, Sparkles, TimerReset } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { WorkspaceShell } from "../components/workspace/workspace-shell";
import { helpdeskApi } from "../lib/helpdesk";
import { Badge, Card, ErrorState, PriorityBadge, Skeleton, SkeletonCard } from "../components/ui";
import type {
  ChannelMetric,
  HelpdeskDashboardMetrics,
  HelpdeskRecentActivityItem,
} from "../../../shared/helpdesk";
import type { PropertySummaryItem } from "../lib/helpdesk";

const topKpiMeta = [
  {
    key: "openConversations",
    label: "Open work",
    icon: Inbox,
    href: "/inbox/all",
    emptyHint: "Nothing in queue.",
    tone: "neutral" as const,
  },
  {
    key: "slaBreached",
    label: "SLA breached",
    icon: AlertTriangle,
    href: "/inbox/sla_at_risk",
    emptyHint: "Clean board.",
    tone: "danger" as const,
  },
  {
    key: "slaAtRisk",
    label: "SLA at risk",
    icon: TimerReset,
    href: "/inbox/sla_at_risk",
    emptyHint: "Nothing slipping.",
    tone: "warning" as const,
  },
  {
    key: "resolvedToday",
    label: "Resolved today",
    icon: CheckCircle2,
    href: "/inbox/all",
    emptyHint: "Day just started.",
    tone: "success" as const,
  },
] as const;

function deriveHero(metrics: HelpdeskDashboardMetrics): { headline: string; subtitle: string } {
  const { openConversations, slaAtRisk, slaBreached, unassigned, resolvedToday } = metrics.summary;
  const after = metrics.afterHoursHandled;
  if (slaBreached === 0 && slaAtRisk === 0 && unassigned === 0 && openConversations === 0) {
    return {
      headline: "All clear.",
      subtitle: "Nothing open, nothing waiting. Queue is at zero.",
    };
  }
  if (slaBreached === 0 && slaAtRisk === 0 && unassigned === 0) {
    return {
      headline: "Overnight was clean.",
      subtitle: `${after} after-hours ticket${after === 1 ? "" : "s"} handled · no SLAs breached · ${resolvedToday} resolved today.`,
    };
  }
  if (slaBreached > 0) {
    return {
      headline: `${slaBreached} SLA breach${slaBreached === 1 ? "" : "es"} to clear.`,
      subtitle: `${openConversations} open · ${slaAtRisk} at risk · ${unassigned} unassigned.`,
    };
  }
  if (slaAtRisk > 0) {
    return {
      headline: `${slaAtRisk} need${slaAtRisk === 1 ? "s" : ""} eyes now.`,
      subtitle: `${openConversations} open · ${unassigned} unassigned · ${resolvedToday} resolved today.`,
    };
  }
  return {
    headline: `${unassigned} waiting on triage.`,
    subtitle: `${openConversations} open · ${unassigned} unassigned · no SLAs at risk.`,
  };
}

function formatEyebrow(): string {
  const now = new Date();
  const datePart = now.toLocaleDateString(undefined, { day: "numeric", month: "long" }).toUpperCase();
  const timePart = now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return `PORTFOLIO · ${datePart}, ${timePart}`;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-3 w-48" />
        <Skeleton className="h-8 w-80" />
        <Skeleton className="h-4 w-96" />
      </div>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </section>
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-sm border border-border bg-surface p-4 space-y-2.5">
            <Skeleton className="h-3 w-24" />
            <div className="space-y-2 pt-1">
              {Array.from({ length: 4 }).map((__, j) => (
                <Skeleton key={j} className="h-12 w-full rounded-sm" />
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

function PriorityNow({
  metrics,
  propertyCodeById,
}: {
  metrics: HelpdeskDashboardMetrics;
  propertyCodeById: Map<string, string>;
}) {
  const tickets = metrics.openTickets.slice(0, 4);
  return (
    <article className="rounded-sm border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="eyebrow">Priority now</div>
          <p className="mt-1 font-body text-[13px] font-semibold text-fg">
            Work the system can't resolve alone
          </p>
        </div>
        <Link href="/inbox/all">
          <a className="font-body text-[12px] font-medium text-fg-muted hover:text-fg">Open inbox →</a>
        </Link>
      </div>
      <div className="mt-3 space-y-1.5">
        {tickets.length === 0 ? (
          <p className="font-body text-[12px] text-fg-muted">Priority queue is empty.</p>
        ) : (
          tickets.map((t) => {
            const code = t.propertyId ? propertyCodeById.get(t.propertyId) : null;
            return (
              <Link key={t.id} href={`/inbox/all?conversation=${t.id}`}>
                <a className="group block rounded-xs border border-border bg-surface-2 px-3 py-2.5 transition-colors ease-ds duration-fast hover:bg-border">
                  <div className="flex items-start gap-3">
                    <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-fg-subtle">
                      {code ?? "—"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-body text-[13px] font-semibold text-fg">{t.subject}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <PriorityBadge priority={t.priority} size="sm" />
                        {t.slaCountdownLabel ? (
                          <span
                            className={[
                              "font-mono text-[10px] font-semibold uppercase tracking-eyebrow",
                              t.slaState === "breached" ? "text-[var(--error)]" : "text-[var(--warning)]",
                            ].join(" ")}
                          >
                            {t.slaCountdownLabel}
                          </span>
                        ) : null}
                        <span className="font-body text-[11px] text-fg-muted">{t.lastActivityLabel}</span>
                      </div>
                    </div>
                    <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-fg-subtle transition-transform group-hover:translate-x-0.5" />
                  </div>
                </a>
              </Link>
            );
          })
        )}
      </div>
    </article>
  );
}

function AIConcierge({ activity }: { activity: HelpdeskRecentActivityItem[] }) {
  const items = activity.slice(0, 5);
  return (
    <article className="relative overflow-hidden rounded-sm border border-[var(--fg)] bg-[var(--fg)] p-4 text-[var(--bg)]">
      <div className="flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 opacity-80" />
        <p className="font-mono text-[10px] font-medium uppercase tracking-wider opacity-70">
          AI Concierge · last 24h
        </p>
      </div>
      <div className="mt-3 flex items-baseline gap-6">
        <div>
          <p className="font-mono text-[28px] font-medium leading-none tracking-tight">—</p>
          <p className="mt-1 font-body text-[11px] opacity-70">% autonomous</p>
        </div>
        <div>
          <p className="font-mono text-[20px] font-medium leading-none tracking-tight">—</p>
          <p className="mt-1 font-body text-[11px] opacity-70">avg response</p>
        </div>
      </div>
      <div className="mt-4 space-y-1.5">
        {items.length === 0 ? (
          <p className="font-body text-[12px] opacity-70">No activity in the last 24 hours.</p>
        ) : (
          items.map((item) => (
            <Link key={item.id} href={`/inbox/all?conversation=${item.conversationId}`}>
              <a className="flex items-start gap-3 rounded-xs px-2 py-1.5 transition-colors ease-ds duration-fast hover:bg-white/10">
                <span className="shrink-0 font-mono text-[10px] opacity-60">{item.createdAtLabel}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-body text-[12px] font-semibold">{item.title}</p>
                  <p className="truncate font-body text-[11px] opacity-70">
                    {item.author} · {item.type.replaceAll("_", " ")}
                  </p>
                </div>
              </a>
            </Link>
          ))
        )}
      </div>
    </article>
  );
}

function Sparkline({ buckets, width = 80, height = 24 }: { buckets: number[]; width?: number; height?: number }) {
  const max = Math.max(1, ...buckets);
  const step = width / Math.max(1, buckets.length - 1);
  const points = buckets
    .map((v, i) => `${(i * step).toFixed(1)},${(height - (v / max) * height).toFixed(1)}`)
    .join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="text-[var(--accent)]">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function Channels({ channels }: { channels: ChannelMetric[] }) {
  const live = channels.filter((c) => c.status === "live");
  const offline = channels.filter((c) => c.status === "offline");
  return (
    <section>
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <div>
          <div className="eyebrow">Channels</div>
          <p className="mt-1 font-body text-[13px] font-semibold text-fg">
            {live.length} live · {offline.length} offline
          </p>
        </div>
        <Link href="/settings/inboxes">
          <a className="font-body text-[12px] font-medium text-fg-muted hover:text-fg">Manage →</a>
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[...live, ...offline].map((c) => (
          <div key={c.channel} className="flex items-center justify-between rounded-sm border border-border bg-surface px-4 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={[
                  "h-1.5 w-1.5 rounded-full",
                  c.status === "live" ? "bg-[var(--success)]" : "bg-border",
                ].join(" ")} />
                <p className="font-body text-[13px] font-semibold text-fg">{c.label}</p>
              </div>
              <p className="mt-0.5 font-body text-[11px] text-fg-muted">
                {c.status === "live" ? `${c.count24h} open · 24h` : "Not connected"}
              </p>
            </div>
            {c.status === "live" ? (
              <Sparkline buckets={c.hourlyBuckets} />
            ) : (
              <div className="h-[24px] w-[80px] rounded-xs bg-surface-2" />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function SecondaryKpis({
  metrics,
  properties,
}: {
  metrics: HelpdeskDashboardMetrics;
  properties: PropertySummaryItem[];
}) {
  const totalUnits = properties.reduce((sum, p) => sum + (p.unitCount ?? 0), 0);

  const cards = [
    {
      label: "After-hours handled",
      value: metrics.afterHoursHandled,
      subtitle: "last 24h",
      href: null,
    },
    {
      label: "Vendors dispatched",
      value: "—",
      subtitle: "not yet tracked",
      href: null,
    },
    {
      label: "Portfolio",
      value: properties.length,
      subtitle: properties.length === 1 ? "property" : "properties",
      href: "/tenants",
    },
    {
      label: "Tenants · units",
      value: `${metrics.tenantCount} · ${totalUnits}`,
      subtitle: "under management",
      href: "/tenants",
    },
  ] as const;

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const body = (
          <div className="rounded-sm border border-border bg-surface p-4 transition-colors ease-ds duration-fast hover:bg-surface-2">
            <p className="eyebrow">{card.label}</p>
            <p className="mt-2 font-mono text-[22px] font-medium leading-none tracking-tight text-fg">
              {card.value}
            </p>
            <p className="mt-2 font-body text-[12px] text-fg-muted">{card.subtitle}</p>
          </div>
        );
        return card.href ? (
          <Link key={card.label} href={card.href}>
            <a className="block">{body}</a>
          </Link>
        ) : (
          <div key={card.label}>{body}</div>
        );
      })}
    </section>
  );
}

export default function DashboardPage() {
  const metricsQuery = useQuery({
    queryKey: ["helpdesk", "dashboard", "metrics"],
    queryFn: helpdeskApi.getDashboardMetrics,
    refetchInterval: 60_000,
  });

  const propertiesQuery = useQuery({
    queryKey: ["helpdesk", "properties-summary"],
    queryFn: helpdeskApi.getPropertiesSummary,
    refetchInterval: 60_000,
  });

  const metrics = metricsQuery.data;
  const properties = propertiesQuery.data?.properties ?? [];
  const propertyCodeById = new Map(properties.map((p) => [p.id, p.code] as const));

  return (
    <WorkspaceShell title="Dashboard" eyebrow="Portfolio">
      {metricsQuery.isLoading ? (
        <DashboardSkeleton />
      ) : metricsQuery.error instanceof Error ? (
        <Card variant="solid" className="p-0">
          <ErrorState
            title="Unable to load dashboard metrics"
            description={metricsQuery.error.message}
            onRetry={() => void metricsQuery.refetch()}
          />
        </Card>
      ) : metrics ? (
        <div className="space-y-6">
          {/* Hero */}
          <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <p className="font-mono text-[10px] font-medium uppercase tracking-wider text-fg-muted">
                {formatEyebrow()}
              </p>
              <h1 className="mt-2 font-display text-[32px] font-semibold leading-[1.1] tracking-tight text-fg">
                {deriveHero(metrics).headline}
              </h1>
              <p className="mt-2 max-w-2xl font-body text-[14px] text-fg-muted">
                {deriveHero(metrics).subtitle}
              </p>
            </div>
            <Link href="/inbox/all">
              <a className="inline-flex h-9 shrink-0 items-center gap-2 rounded-sm border border-border bg-surface px-3 font-body text-[13px] font-medium text-fg transition-colors ease-ds duration-fast hover:bg-surface-2">
                <Sparkles className="h-3.5 w-3.5" />
                Open live queue
              </a>
            </Link>
          </section>

          {/* Top KPIs */}
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {topKpiMeta.map((card) => {
              const value = metrics.summary[card.key] as number;
              const showAlert = value > 0 && (card.tone === "danger" || card.tone === "warning");
              return (
                <Link key={card.key} href={card.href}>
                  <a className="block rounded-sm border border-border bg-surface p-4 transition-colors ease-ds duration-fast hover:bg-surface-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="eyebrow">{card.label}</p>
                      <card.icon className="h-3.5 w-3.5 text-fg-subtle" />
                    </div>
                    <p
                      className={[
                        "mt-2 font-mono text-[28px] font-medium leading-none tracking-tight",
                        card.tone === "danger" && value > 0
                          ? "text-[var(--error)]"
                          : card.tone === "warning" && value > 0
                            ? "text-[var(--warning)]"
                            : card.tone === "success" && value > 0
                              ? "text-[var(--success)]"
                              : "text-fg",
                      ].join(" ")}
                    >
                      {value}
                    </p>
                    <p className="mt-2 font-body text-[12px] text-fg-muted">
                      {value === 0 ? card.emptyHint : showAlert ? "Open queue to work this segment." : "Open queue to review."}
                    </p>
                  </a>
                </Link>
              );
            })}
          </section>

          {/* Priority now + AI Concierge */}
          <section className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <PriorityNow metrics={metrics} propertyCodeById={propertyCodeById} />
            <AIConcierge activity={metrics.recentActivity} />
          </section>

          {/* Secondary KPIs */}
          <SecondaryKpis metrics={metrics} properties={properties} />

          {/* Channels */}
          {metrics.channels.length > 0 ? <Channels channels={metrics.channels} /> : null}

          {/* Portfolio list */}
          {properties.length > 0 ? (
            <section>
              <div className="mb-2.5 flex items-center justify-between gap-3">
                <div className="eyebrow">Portfolio</div>
                <Link href="/tenants">
                  <a className="font-body text-[12px] font-medium text-fg-muted hover:text-fg">View all →</a>
                </Link>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {properties.map((property) => (
                  <Link key={property.id} href={`/inbox/all?propertyId=${property.id}`}>
                    <a className="block rounded-sm border border-border bg-surface p-4 transition-colors ease-ds duration-fast hover:bg-surface-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-mono text-[10px] uppercase tracking-wider text-fg-muted">
                            {property.code}
                          </p>
                          <p className="mt-0.5 font-body text-[13px] font-semibold text-fg">{property.name}</p>
                        </div>
                        {property.openTicketCount > 0 ? (
                          <Badge tone="orange" size="sm">
                            {property.openTicketCount} open
                          </Badge>
                        ) : (
                          <Badge tone="success" size="sm">
                            All clear
                          </Badge>
                        )}
                      </div>
                      {property.location ? (
                        <p className="mt-1 font-body text-[11px] text-fg-muted">{property.location}</p>
                      ) : null}
                      <p className="mt-2 font-body text-[12px] text-fg-muted">
                        {property.unitCount > 1 ? `${property.unitCount} units` : "Single-tenant"} ·{" "}
                        {property.openTicketCount === 0
                          ? "No open tickets"
                          : `${property.openTicketCount} ticket${property.openTicketCount === 1 ? "" : "s"}`}
                      </p>
                    </a>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}
    </WorkspaceShell>
  );
}
