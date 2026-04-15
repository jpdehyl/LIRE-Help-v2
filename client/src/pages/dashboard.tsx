import { AlertTriangle, ArrowRight, Clock3, Inbox, TimerReset } from "lucide-react";
import { Link } from "wouter";
import { WorkspaceShell } from "../components/workspace/workspace-shell";

const summaryCards = [
  { label: "Open conversations", value: "48", note: "+6 since this morning", icon: Inbox },
  { label: "Unassigned work", value: "9", note: "Queue needs triage", icon: Clock3 },
  { label: "SLA at risk", value: "4", note: "Prioritize first-response coverage", icon: AlertTriangle },
  { label: "Waiting on customer", value: "15", note: "Monitor for follow-up windows", icon: TimerReset },
] as const;

const priorityQueues = [
  { title: "Unassigned", owner: "Support triage", note: "9 conversations without an owner", href: "/inbox/unassigned" },
  { title: "SLA at risk", owner: "Queue managers", note: "4 threads near breach thresholds", href: "/inbox/sla_at_risk" },
  { title: "VIP / strategic", owner: "Commercial ops", note: "3 conversations needing high-touch handling", href: "/inbox/vip" },
];

export default function DashboardPage() {
  return (
    <WorkspaceShell
      title="Dashboard"
      subtitle="Action-oriented workspace overview for support and revenue-adjacent operations."
    >
      <div className="space-y-6">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => {
            const Icon = card.icon;

            return (
              <article key={card.label} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-500">{card.label}</p>
                    <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{card.value}</p>
                    <p className="mt-2 text-sm text-slate-500">{card.note}</p>
                  </div>
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                    <Icon className="h-5 w-5" />
                  </span>
                </div>
              </article>
            );
          })}
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
          <article className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Needs attention now</p>
            <div className="mt-4 space-y-3">
              {priorityQueues.map((queue) => (
                <Link key={queue.title} href={queue.href}>
                  <a className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 transition-colors hover:bg-slate-100">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{queue.title}</p>
                      <p className="mt-1 text-sm text-slate-500">{queue.note}</p>
                      <p className="mt-2 text-xs font-medium uppercase tracking-[0.16em] text-slate-400">{queue.owner}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
                  </a>
                </Link>
              ))}
            </div>
          </article>

          <article className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Phase 1 scope</p>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed text-slate-600">
              <li>• Shared workspace shell and route grouping are in place.</li>
              <li>• Inbox route now carries the queue/view state in the URL.</li>
              <li>• Tickets, customers, and settings are intentionally placeholder surfaces for cohesion.</li>
              <li>• Existing platform admin remains available under the legacy route.</li>
            </ul>
          </article>
        </section>
      </div>
    </WorkspaceShell>
  );
}
