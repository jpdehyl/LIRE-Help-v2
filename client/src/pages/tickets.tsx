import { ArrowRight, Ticket } from "lucide-react";
import { WorkspaceShell } from "../components/workspace/workspace-shell";

const placeholderTickets = [
  { id: "T-3021", summary: "Renewal pricing approval", owner: "Avery Kim", state: "Open", next: "Needs finance confirmation" },
  { id: "T-3018", summary: "Dock scheduling API regression", owner: "Platform Support", state: "Pending", next: "Engineering handoff queued" },
  { id: "T-3013", summary: "April billing documents", owner: "Unassigned", state: "Waiting on customer", next: "Send W-9 + invoice PDF" },
] as const;

export default function TicketsPage() {
  return (
    <WorkspaceShell
      title="Tickets"
      eyebrow="LIRE Help workspace / Tickets"
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <Ticket className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Ticket workspace scaffold</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-950">Linked work objects will land here</h2>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {placeholderTickets.map((ticket) => (
              <article key={ticket.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{ticket.id} · {ticket.summary}</p>
                    <p className="mt-1 text-sm text-slate-500">Owner: {ticket.owner}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-400">{ticket.state}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-400" />
                </div>
                <p className="mt-3 text-sm text-slate-600">{ticket.next}</p>
              </article>
            ))}
          </div>
        </section>

        <aside className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Planned later</p>
          <ul className="mt-4 space-y-3 text-sm leading-relaxed text-slate-600">
            <li>• Ticket detail routes and dedicated ownership workflows</li>
            <li>• SLA policy displays and breach timelines</li>
            <li>• Resolution notes, tags, and linked artifacts</li>
          </ul>
        </aside>
      </div>
    </WorkspaceShell>
  );
}
