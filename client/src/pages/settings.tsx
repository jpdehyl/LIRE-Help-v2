import { Settings2, Workflow } from "lucide-react";
import { WorkspaceShell } from "../components/workspace/workspace-shell";
import { Card, CardHeader } from "../components/ui";

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
        <Card padding="lg">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
              <Settings2 className="h-5 w-5" />
            </span>
            <CardHeader
              eyebrow="Settings scaffold"
              title="Configuration surfaces coming in later tranches"
            />
          </div>

          <div className="mt-6 space-y-3">
            {settingsGroups.map((group) => (
              <Card key={group.title} variant="soft" padding="sm" as="article">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{group.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{group.description}</p>
              </Card>
            ))}
          </div>
        </Card>

        <Card variant="dashed" padding="lg" as="aside">
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
            <Workflow className="h-4 w-4" />
            <p className="text-sm font-semibold">Why this exists now</p>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            The app shell should feel coherent before the settings modules are production-ready. This route keeps the information architecture stable while later phases add actual forms and persistence.
          </p>
        </Card>
      </div>
    </WorkspaceShell>
  );
}
