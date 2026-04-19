import { Building2, Users } from "lucide-react";
import { WorkspaceShell } from "../components/workspace/workspace-shell";
import { Badge, Card } from "../components/ui";

const customerCards = [
  { name: "Northstar Logistics", contact: "Maya Chen", tier: "Strategic", state: "Watch", note: "Renewal timing this week" },
  { name: "FreightGrid", contact: "Luis Romero", tier: "Priority", state: "Stable", note: "Escalated API investigation" },
  { name: "Atlas Warehouse Group", contact: "Priya Nair", tier: "Standard", state: "Stable", note: "Billing documents requested" },
] as const;

export default function CustomersPage() {
  return (
    <WorkspaceShell title="Customers" eyebrow="Operations">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card padding="md">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-xs bg-surface-2 text-fg-muted">
              <Users className="h-4 w-4" />
            </span>
            <div>
              <div className="eyebrow">Customers</div>
              <div className="mt-0.5 font-display text-[18px] font-semibold tracking-tight text-fg">
                Companies, contacts, health
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-2.5 lg:grid-cols-2">
            {customerCards.map((customer) => (
              <article
                key={customer.name}
                className="rounded-sm border border-border bg-surface-2 px-3.5 py-3"
              >
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 grid h-8 w-8 place-items-center rounded-xs bg-surface text-fg-muted border border-border">
                    <Building2 className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-body text-[13px] font-semibold text-fg">{customer.name}</p>
                    <p className="mt-0.5 font-body text-[12px] text-fg-muted">Primary contact: {customer.contact}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <Badge tone="muted" size="sm">
                        {customer.tier}
                      </Badge>
                      <Badge tone="muted" size="sm">
                        {customer.state}
                      </Badge>
                    </div>
                    <p className="mt-2 font-body text-[12px] text-fg-muted">{customer.note}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </Card>

        <Card variant="dashed" padding="md" as="aside">
          <div className="eyebrow">Planned later</div>
          <ul className="mt-3 space-y-2 font-body text-[13px] leading-[1.55] text-fg-muted">
            <li>· Per-customer timelines and linked conversation history</li>
            <li>· Organization metadata, tags, ownership, lifecycle state</li>
            <li>· Customer detail routes with account health + relationship context</li>
          </ul>
        </Card>
      </div>
    </WorkspaceShell>
  );
}
