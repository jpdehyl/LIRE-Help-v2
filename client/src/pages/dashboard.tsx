import { AlertTriangle, Building2, Inbox, Loader2, MapPin, TimerReset, UserRoundMinus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { WorkspaceShell } from "../components/workspace/workspace-shell";
import { helpdeskApi } from "../lib/helpdesk";

const summaryMeta = [
  { key: "openConversations", label: "Open conversations", icon: Inbox, href: "/inbox/all" },
  { key: "unassigned", label: "Unassigned work", icon: UserRoundMinus, href: "/inbox/unassigned" },
  { key: "slaAtRisk", label: "SLA at risk", icon: AlertTriangle, href: "/inbox/sla_at_risk" },
  { key: "waitingOnCustomer", label: "Waiting on customer", icon: TimerReset, href: "/inbox/all" },
] as const;

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
    <WorkspaceShell
      title="Dashboard"
      eyebrow="Support workspace / Dashboard"
    >
      {metricsQuery.isLoading ? (
        <div className="flex min-h-[360px] items-center justify-center rounded-[24px] border border-slate-200 bg-white text-sm text-slate-500 shadow-sm">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading operator metrics…
        </div>
      ) : metricsQuery.error instanceof Error ? (
        <div className="rounded-[24px] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 shadow-sm">
          Unable to load dashboard metrics: {metricsQuery.error.message}
        </div>
      ) : metricsQuery.data ? (
        <div className="space-y-6">
          {propertiesQuery.data && propertiesQuery.data.properties.length > 0 ? (
            <section>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Portfolio</p>
                  <h2 className="mt-1 text-sm font-semibold text-slate-950">Properties at a glance</h2>
                </div>
                <Link href="/customers"><a className="text-sm font-medium text-blue-600">View all</a></Link>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {propertiesQuery.data.properties.map((property) => (
                  <Link key={property.id} href={`/inbox/all?propertyId=${property.id}`}>
                    <a className="block rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:bg-slate-50">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
                          <Building2 className="h-5 w-5" />
                        </div>
                        {property.openTicketCount > 0 ? (
                          <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-700">
                            {property.openTicketCount} open
                          </span>
                        ) : (
                          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                            All clear
                          </span>
                        )}
                      </div>
                      <div className="mt-3">
                        <p className="text-sm font-semibold text-slate-900">{property.name}</p>
                        {property.location ? (
                          <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                            <MapPin className="h-3 w-3" />
                            {property.location}
                          </p>
                        ) : null}
                        <p className="mt-2 text-xs text-slate-500">
                          {property.unitCount > 1 ? `${property.unitCount} units` : "Single-tenant"} ·{" "}
                          {property.openTicketCount === 0 ? "No open tickets" : `${property.openTicketCount} open ticket${property.openTicketCount === 1 ? "" : "s"}`}
                        </p>
                      </div>
                    </a>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {summaryMeta.map((card) => {
              const Icon = card.icon;
              const value = metricsQuery.data.summary[card.key];

              return (
                <Link key={card.key} href={card.href}>
                  <a className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:bg-slate-50">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-slate-500">{card.label}</p>
                        <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
                        <p className="mt-2 text-sm text-slate-500">{value === 0 ? "Nothing blocked here right now." : "Open the queue to work this segment."}</p>
                      </div>
                      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                        <Icon className="h-5 w-5" />
                      </span>
                    </div>
                  </a>
                </Link>
              );
            })}
          </section>

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <article className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Status mix</p>
                  <h2 className="mt-1 text-lg font-semibold text-slate-950">Current ticket distribution</h2>
                </div>
                <Link href="/inbox/all"><a className="text-sm font-medium text-blue-600">Open inbox</a></Link>
              </div>
              <div className="mt-5 space-y-3">
                {metricsQuery.data.byStatus.map((entry) => {
                  const totalTickets = Math.max(1, metricsQuery.data.byStatus.reduce((sum, item) => sum + item.count, 0));
                  const width = Math.max(8, (entry.count / totalTickets) * 100);

                  return (
                    <div key={entry.status} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium capitalize text-slate-900">{entry.status.replaceAll("_", " ")}</p>
                        <p className="text-sm font-semibold text-slate-700">{entry.count}</p>
                      </div>
                      <div className="mt-3 h-2 rounded-full bg-slate-200">
                        <div className="h-2 rounded-full bg-slate-900" style={{ width: `${width}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>

            <article className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">By inbox / team</p>
              <div className="mt-4 space-y-3">
                {metricsQuery.data.byInbox.map((inbox) => (
                  <div key={inbox.inboxLabel} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">{inbox.inboxLabel}</p>
                      <p className="text-sm font-semibold text-slate-700">{inbox.count}</p>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                      <span className="rounded-full bg-white px-2 py-1 ring-1 ring-slate-200">{inbox.unassignedCount} unassigned</span>
                      <span className="rounded-full bg-white px-2 py-1 ring-1 ring-slate-200">{inbox.atRiskCount} at risk</span>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <article className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Recent activity</p>
              <div className="mt-4 space-y-3">
                {metricsQuery.data.recentActivity.length > 0 ? metricsQuery.data.recentActivity.map((item) => (
                  <Link key={item.id} href={`/inbox/all?conversation=${item.conversationId}`}>
                    <a className="block rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 transition hover:bg-slate-100">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                        <span className="text-xs text-slate-500">{item.createdAtLabel}</span>
                      </div>
                      <p className="mt-2 text-sm text-slate-500">{item.author} · {item.type.replaceAll("_", " ")}</p>
                    </a>
                  </Link>
                )) : <p className="text-sm text-slate-500">No recent activity yet.</p>}
              </div>
            </article>

            <article className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Open tickets</p>
                <Link href="/inbox/all"><a className="text-sm font-medium text-blue-600">See all</a></Link>
              </div>
              <div className="mt-4 space-y-3">
                {metricsQuery.data.openTickets.map((ticket) => (
                  <Link key={ticket.id} href={`/inbox/all?conversation=${ticket.id}`}>
                    <a className="block rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 transition hover:bg-slate-100">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{ticket.subject}</p>
                          <p className="mt-1 text-sm text-slate-500">{ticket.requesterName} · {ticket.company}</p>
                        </div>
                        <span className="rounded-full bg-white px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                          {ticket.priority}
                        </span>
                      </div>
                    </a>
                  </Link>
                ))}
              </div>
            </article>
          </section>
        </div>
      ) : null}
    </WorkspaceShell>
  );
}
