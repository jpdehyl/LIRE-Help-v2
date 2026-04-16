import { Settings2, Workflow } from "lucide-react";
import { WorkspaceShell } from "../components/workspace/workspace-shell";

const settingsGroups = [
  {
    title: "Inboxes",
    description: "Queue definitions, team routing, ownership defaults, and saved views will live here.",
  },
  {
    title: "Workflows",
    description: "SLA policy scaffolding, macros, automation hooks, and escalation rules come later.",
  },
  {
    title: "Team settings",
    description: "Roles, permissions, and collaboration controls will align to the new workspace model.",
  },
] as const;

export default function SettingsPage() {
  return (
    <WorkspaceShell
      title="Settings"
      eyebrow="Support workspace / Settings"
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <Settings2 className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Settings scaffold</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-950">Configuration surfaces coming in later tranches</h2>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {settingsGroups.map((group) => (
              <article key={group.title} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-sm font-semibold text-slate-900">{group.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{group.description}</p>
              </article>
            ))}
          </div>
        </section>

        <aside className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-6 shadow-sm">
          <div className="flex items-center gap-2 text-slate-700">
            <Workflow className="h-4 w-4" />
            <p className="text-sm font-semibold">Why this exists now</p>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            The app shell should feel coherent before the settings modules are production-ready. This route keeps the information architecture stable while later phases add actual forms and persistence.
          </p>
        </aside>
      </div>
    </WorkspaceShell>
  );
}
