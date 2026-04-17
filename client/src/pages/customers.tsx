import { Building2, Users } from "lucide-react";
import { WorkspaceShell } from "../components/workspace/workspace-shell";
import { Badge, Card, CardHeader } from "../components/ui";

const customerCards = [
  { name: "Northstar Logistics", contact: "Maya Chen", tier: "Strategic", state: "Watch", note: "Renewal timing this week" },
  { name: "FreightGrid", contact: "Luis Romero", tier: "Priority", state: "Stable", note: "Escalated API investigation" },
  { name: "Atlas Warehouse Group", contact: "Priya Nair", tier: "Standard", state: "Stable", note: "Billing documents requested" },
] as const;

export default function CustomersPage() {
  return (
    <WorkspaceShell
      title="Customers"
      eyebrow="Support workspace / Customers"
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card padding="lg">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
              <Users className="h-5 w-5" />
            </span>
            <CardHeader
              eyebrow="Customer context scaffold"
              title="Companies, contacts, and health signals"
            />
          </div>

          <div className="mt-6 grid gap-3 lg:grid-cols-2">
            {customerCards.map((customer) => (
              <Card key={customer.name} variant="soft" padding="sm" as="article">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-500 ring-1 ring-inset ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700">
                    <Building2 className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{customer.name}</p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Primary contact: {customer.contact}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge tone="slate">{customer.tier}</Badge>
                      <Badge tone="slate">{customer.state}</Badge>
                    </div>
                    <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{customer.note}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </Card>

        <Card variant="dashed" padding="lg" as="aside">
          <p className="eyebrow">Planned later</p>
          <ul className="mt-4 space-y-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            <li>• Per-customer timelines and linked conversation history</li>
            <li>• Organization metadata, tags, ownership, and lifecycle state</li>
            <li>• Customer detail routes with account health and relationship context</li>
          </ul>
        </Card>
      </div>
    </WorkspaceShell>
  );
}
