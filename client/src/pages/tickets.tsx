import { ArrowRight, Ticket } from "lucide-react";
import { WorkspaceShell } from "../components/workspace/workspace-shell";
import { Badge, Card } from "../components/ui";

const placeholderTickets = [
  { id: "T-3021", summary: "Renewal pricing approval", owner: "Avery Kim", state: "Open", next: "Needs finance confirmation" },
  { id: "T-3018", summary: "Dock scheduling API regression", owner: "Platform Support", state: "Pending", next: "Engineering handoff queued" },
  { id: "T-3013", summary: "April billing documents", owner: "Unassigned", state: "Waiting on tenant", next: "Send W-9 + invoice PDF" },
] as const;

export default function TicketsPage() {
  return (
    <WorkspaceShell title="Tickets" eyebrow="Operations">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card padding="md">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-xs bg-surface-2 text-fg-muted">
              <Ticket className="h-4 w-4" />
            </span>
            <div>
              <div className="eyebrow">Tickets</div>
              <div className="mt-0.5 font-display text-[18px] font-semibold tracking-tight text-fg">
                Linked work objects
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {placeholderTickets.map((ticket) => (
              <article
                key={ticket.id}
                className="rounded-sm border border-border bg-surface-2 px-3.5 py-3 transition-colors ease-ds duration-fast hover:bg-border"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-body text-[13px] font-semibold text-fg">
                      <span className="font-mono text-[12px] text-fg-subtle">{ticket.id}</span> · {ticket.summary}
                    </p>
                    <p className="mt-0.5 font-body text-[12px] text-fg-muted">Owner: {ticket.owner}</p>
                    <Badge tone="muted" size="sm" className="mt-1.5">
                      {ticket.state}
                    </Badge>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-fg-subtle" />
                </div>
                <p className="mt-2 font-body text-[12px] text-fg-muted">{ticket.next}</p>
              </article>
            ))}
          </div>
        </Card>

        <Card variant="dashed" padding="md" as="aside">
          <div className="eyebrow">Planned later</div>
          <ul className="mt-3 space-y-2 font-body text-[13px] leading-[1.55] text-fg-muted">
            <li>· Ticket detail routes and dedicated ownership workflows</li>
            <li>· SLA policy displays and breach timelines</li>
            <li>· Resolution notes, tags, and linked artifacts</li>
          </ul>
        </Card>
      </div>
    </WorkspaceShell>
  );
}
