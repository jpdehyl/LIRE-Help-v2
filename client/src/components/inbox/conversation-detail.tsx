import type { ConversationDetail, ConversationRow } from "./types";

interface ConversationDetailProps {
  conversation: ConversationRow | undefined;
  detail: ConversationDetail | undefined;
}

const statusClasses = {
  open: "bg-emerald-50 text-emerald-700",
  pending: "bg-blue-50 text-blue-700",
  waiting_on_customer: "bg-violet-50 text-violet-700",
  resolved: "bg-slate-100 text-slate-600",
} as const;

const priorityClasses = {
  low: "bg-slate-100 text-slate-600",
  medium: "bg-amber-50 text-amber-700",
  high: "bg-orange-50 text-orange-700",
  urgent: "bg-red-50 text-red-700",
} as const;

const slaClasses = {
  healthy: "bg-emerald-50 text-emerald-700",
  at_risk: "bg-amber-50 text-amber-700",
  breached: "bg-red-50 text-red-700",
} as const;

const timelineClasses = {
  customer: "border-blue-200 bg-blue-50",
  teammate: "border-slate-200 bg-white",
  internal_note: "border-amber-200 bg-amber-50",
  system: "border-violet-200 bg-violet-50",
} as const;

export function ConversationDetailPane({ conversation, detail }: ConversationDetailProps) {
  if (!conversation || !detail) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50 p-8 text-center">
        <div className="max-w-sm">
          <p className="text-sm font-semibold text-slate-900">Select a conversation</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-500">
            The right pane is reserved for the active work surface: conversation record, ticket state, notes, and action rail.
          </p>
        </div>
      </div>
    );
  }

  return (
    <section className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_280px] bg-slate-50">
      <div className="flex min-h-0 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Active conversation</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-950">{detail.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">{detail.summary}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClasses[detail.ticket.status]}`}>
                {detail.ticket.status.replaceAll("_", " ")}
              </span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${priorityClasses[detail.ticket.priority]}`}>
                {detail.ticket.priority}
              </span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${slaClasses[detail.ticket.slaState]}`}>
                SLA {detail.ticket.slaState.replaceAll("_", " ")}
              </span>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Assignee</p>
              <p className="mt-1 text-sm font-medium text-slate-900">{detail.ticket.assignee ?? "Unassigned"}</p>
              <p className="mt-1 text-xs text-slate-500">Team: {detail.ticket.team}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Ticket</p>
              <p className="mt-1 text-sm font-medium text-slate-900">{detail.ticket.id}</p>
              <p className="mt-1 text-xs text-slate-500">{detail.ticket.nextMilestone}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Tags</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {detail.ticket.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-5">
          {detail.timeline.map((item) => (
            <article key={item.id} className={`rounded-2xl border p-4 ${timelineClasses[item.type]}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{item.type.replaceAll("_", " ")}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{item.author}</p>
                </div>
                <span className="text-xs text-slate-500">{item.createdAtLabel}</span>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{item.body}</p>
            </article>
          ))}
        </div>

        <div className="border-t border-slate-200 bg-slate-50 px-5 py-4">
          <div className="flex items-center gap-2">
            {(["reply", "note"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                className={[
                  "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                  detail.composerMode === mode ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-inset ring-slate-200",
                ].join(" ")}
              >
                {mode === "reply" ? "Reply" : "Internal note"}
              </button>
            ))}
          </div>
          <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">
              Composer placeholder: future phases will wire drafts, macros, notes, and assistive AI suggestions into this area.
            </p>
          </div>
        </div>
      </div>

      <aside className="min-h-0 overflow-y-auto bg-slate-50 px-4 py-4">
        <div className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Customer context</p>
            <h3 className="mt-2 text-sm font-semibold text-slate-900">{detail.customer.name}</h3>
            <p className="text-sm text-slate-500">{detail.customer.company}</p>
            <div className="mt-3 grid gap-2 text-xs text-slate-500">
              <p>Tier: <span className="font-medium capitalize text-slate-700">{detail.customer.tier}</span></p>
              <p>Health: <span className="font-medium capitalize text-slate-700">{detail.customer.health.replaceAll("_", " ")}</span></p>
              <p>Last seen: <span className="font-medium text-slate-700">{detail.customer.lastSeenLabel}</span></p>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Suggested next actions</p>
            <div className="mt-3 space-y-3">
              {detail.suggestedActions.map((action) => (
                <div key={action.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <p className="text-sm font-medium text-slate-900">{action.label}</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">{action.detail}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Action rail placeholder</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              Future modules: assignment changes, SLA controls, merge/split, linked records, and audit activity.
            </p>
          </section>
        </div>
      </aside>
    </section>
  );
}
