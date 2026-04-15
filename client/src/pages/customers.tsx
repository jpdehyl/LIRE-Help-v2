import { Building2, Users } from "lucide-react";
import { WorkspaceShell } from "../components/workspace/workspace-shell";

const customerCards = [
  { name: "Northstar Logistics", contact: "Maya Chen", tier: "Strategic", state: "Watch", note: "Renewal timing this week" },
  { name: "FreightGrid", contact: "Luis Romero", tier: "Priority", state: "Stable", note: "Escalated API investigation" },
  { name: "Atlas Warehouse Group", contact: "Priya Nair", tier: "Standard", state: "Stable", note: "Billing documents requested" },
] as const;

export default function CustomersPage() {
  return (
    <WorkspaceShell
      title="Customers"
      subtitle="People, companies, and account context tied to conversations and tickets."
      eyebrow="Support workspace / Customers"
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <Users className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Customer context scaffold</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-950">Companies, contacts, and health signals</h2>
            </div>
          </div>

          <div className="mt-6 grid gap-3 lg:grid-cols-2">
            {customerCards.map((customer) => (
              <article key={customer.name} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-500 ring-1 ring-inset ring-slate-200">
                    <Building2 className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{customer.name}</p>
                    <p className="mt-1 text-sm text-slate-500">Primary contact: {customer.contact}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium text-slate-500">
                      <span className="rounded-full bg-white px-2 py-0.5 ring-1 ring-inset ring-slate-200">{customer.tier}</span>
                      <span className="rounded-full bg-white px-2 py-0.5 ring-1 ring-inset ring-slate-200">{customer.state}</span>
                    </div>
                    <p className="mt-3 text-sm text-slate-600">{customer.note}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <aside className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Planned later</p>
          <ul className="mt-4 space-y-3 text-sm leading-relaxed text-slate-600">
            <li>• Per-customer timelines and linked conversation history</li>
            <li>• Organization metadata, tags, ownership, and lifecycle state</li>
            <li>• Customer detail routes with account health and relationship context</li>
          </ul>
        </aside>
      </div>
    </WorkspaceShell>
  );
}
