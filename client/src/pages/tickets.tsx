import { ArrowRight, Ticket } from "lucide-react";
import { WorkspaceShell } from "../components/workspace/workspace-shell";
import { Badge, Card, CardHeader } from "../components/ui";

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
        <Card padding="lg">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
              <Ticket className="h-5 w-5" />
            </span>
            <CardHeader
              eyebrow="Ticket workspace scaffold"
              title="Linked work objects will land here"
            />
          </div>

          <div className="mt-6 space-y-3">
            {placeholderTickets.map((ticket) => (
              <Card key={ticket.id} variant="soft" padding="sm" as="article">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{ticket.id} · {ticket.summary}</p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Owner: {ticket.owner}</p>
                    <Badge tone="slate" className="mt-2 uppercase tracking-[0.12em]">{ticket.state}</Badge>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                </div>
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{ticket.next}</p>
              </Card>
            ))}
          </div>
        </Card>

        <Card variant="dashed" padding="lg" as="aside">
          <p className="eyebrow">Planned later</p>
          <ul className="mt-4 space-y-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            <li>• Ticket detail routes and dedicated ownership workflows</li>
            <li>• SLA policy displays and breach timelines</li>
            <li>• Resolution notes, tags, and linked artifacts</li>
          </ul>
        </Card>
      </div>
    </WorkspaceShell>
  );
}
