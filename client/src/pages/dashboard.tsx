import { AlertTriangle, Building2, Inbox, MapPin, TimerReset, UserRoundMinus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { WorkspaceShell } from "../components/workspace/workspace-shell";
import { helpdeskApi } from "../lib/helpdesk";
import { Badge, Card, ErrorState, Skeleton, SkeletonCard } from "../components/ui";

const summaryMeta = [
  { key: "openConversations", label: "Open conversations", icon: Inbox, href: "/inbox/all" },
  { key: "unassigned", label: "Unassigned", icon: UserRoundMinus, href: "/inbox/unassigned" },
  { key: "slaAtRisk", label: "SLA at risk", icon: AlertTriangle, href: "/inbox/sla_at_risk" },
  { key: "waitingOnCustomer", label: "Waiting on tenant", icon: TimerReset, href: "/inbox/all" },
] as const;

function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </section>
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-sm border border-border bg-surface p-4 space-y-2.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-40" />
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

  return (
    <WorkspaceShell title="Dashboard" eyebrow="Workspace">
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
      ) : metricsQuery.data ? (
        <div className="space-y-5">
          {/* Primary KPI row */}
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {summaryMeta.map((card) => {
              const Icon = card.icon;
              const value = metricsQuery.data.summary[card.key];
              return (
                <Link key={card.key} href={card.href}>
                  <a className="block rounded-sm border border-border bg-surface p-4 transition-colors ease-ds duration-fast hover:bg-surface-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="eyebrow">{card.label}</p>
                      <Icon className="h-3.5 w-3.5 text-fg-subtle" />
                    </div>
                    <p className="mt-2 font-mono text-[28px] font-medium leading-none tracking-tight text-fg">
                      {value}
                    </p>
                    <p className="mt-2 font-body text-[12px] text-fg-muted">
                      {value === 0 ? "Nothing blocked here right now." : "Open queue to work this segment."}
                    </p>
                  </a>
                </Link>
              );
            })}
          </section>

          {/* Portfolio */}
          {propertiesQuery.data && propertiesQuery.data.properties.length > 0 ? (
            <section>
              <div className="mb-2.5 flex items-center justify-between gap-3">
                <div className="eyebrow">Portfolio</div>
                <Link href="/customers">
                  <a className="font-body text-[12px] font-medium text-fg-muted hover:text-fg">View all →</a>
                </Link>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {propertiesQuery.data.properties.map((property) => (
                  <Link key={property.id} href={`/inbox/all?propertyId=${property.id}`}>
                    <a className="block rounded-sm border border-border bg-surface p-4 transition-colors ease-ds duration-fast hover:bg-surface-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="grid h-8 w-8 place-items-center rounded-xs bg-surface-2 text-fg-muted">
                          <Building2 className="h-4 w-4" />
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
                      <div className="mt-2.5">
                        <p className="font-body text-[13px] font-semibold text-fg">{property.name}</p>
                        {property.location ? (
                          <p className="mt-0.5 flex items-center gap-1 font-body text-[11px] text-fg-muted">
                            <MapPin className="h-3 w-3" />
                            {property.location}
                          </p>
                        ) : null}
                        <p className="mt-2 font-body text-[12px] text-fg-muted">
                          {property.unitCount > 1 ? `${property.unitCount} units` : "Single-tenant"} ·{" "}
                          {property.openTicketCount === 0
                            ? "No open tickets"
                            : `${property.openTicketCount} ticket${property.openTicketCount === 1 ? "" : "s"}`}
                        </p>
                      </div>
                    </a>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {/* Triage + activity */}
          <section className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <article className="rounded-sm border border-border bg-surface p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="eyebrow">Triage by team</div>
                <Link href="/inbox/all">
                  <a className="font-body text-[12px] font-medium text-fg-muted hover:text-fg">Open inbox →</a>
                </Link>
              </div>
              <div className="mt-3 space-y-2">
                {metricsQuery.data.byInbox.map((inbox) => (
                  <div key={inbox.inboxLabel} className="rounded-xs bg-surface-2 px-3 py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-body text-[13px] font-semibold text-fg">{inbox.inboxLabel}</p>
                      <p className="font-mono text-[14px] text-fg">{inbox.count}</p>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <Badge tone="muted" size="sm">
                        {inbox.unassignedCount} unassigned
                      </Badge>
                      <Badge tone="warning" size="sm">
                        {inbox.atRiskCount} at risk
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-sm border border-border bg-surface p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="eyebrow">Recent activity</div>
                <Link href="/inbox/all">
                  <a className="font-body text-[12px] font-medium text-fg-muted hover:text-fg">See all →</a>
                </Link>
              </div>
              <div className="mt-3 space-y-2">
                {metricsQuery.data.recentActivity.length > 0 ? (
                  metricsQuery.data.recentActivity.map((item) => (
                    <Link key={item.id} href={`/inbox/all?conversation=${item.conversationId}`}>
                      <a className="block rounded-xs bg-surface-2 px-3 py-2.5 transition-colors ease-ds duration-fast hover:bg-border">
                        <div className="flex items-center justify-between gap-3">
                          <p className="truncate font-body text-[13px] font-semibold text-fg">{item.title}</p>
                          <span className="shrink-0 font-mono text-[10px] text-fg-subtle">{item.createdAtLabel}</span>
                        </div>
                        <p className="mt-1 font-body text-[12px] text-fg-muted">
                          {item.author} · {item.type.replaceAll("_", " ")}
                        </p>
                      </a>
                    </Link>
                  ))
                ) : (
                  <p className="font-body text-[12px] text-fg-muted">No recent activity yet.</p>
                )}
              </div>
            </article>
          </section>

          {/* Open tickets */}
          <section>
            <div className="mb-2.5 flex items-center justify-between gap-3">
              <div className="eyebrow">Open tickets</div>
              <Link href="/inbox/all">
                <a className="font-body text-[12px] font-medium text-fg-muted hover:text-fg">See all →</a>
              </Link>
            </div>
            <div className="grid gap-2">
              {metricsQuery.data.openTickets.map((ticket) => (
                <Link key={ticket.id} href={`/inbox/all?conversation=${ticket.id}`}>
                  <a className="block rounded-sm border border-border bg-surface px-3.5 py-2.5 transition-colors ease-ds duration-fast hover:bg-surface-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-body text-[13px] font-semibold text-fg">{ticket.subject}</p>
                        <p className="mt-0.5 font-body text-[12px] text-fg-muted">
                          {ticket.requesterName} · {ticket.company}
                        </p>
                      </div>
                      <Badge tone="muted" size="sm">
                        {ticket.priority}
                      </Badge>
                    </div>
                  </a>
                </Link>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </WorkspaceShell>
  );
}
