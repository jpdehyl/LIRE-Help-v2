import { Settings2, Workflow } from "lucide-react";
import { WorkspaceShell } from "../components/workspace/workspace-shell";
import { Card } from "../components/ui";

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
    title: "Team",
    description: "Roles, permissions, and collaboration controls will align to the new workspace model.",
  },
] as const;

export default function SettingsPage() {
  return (
    <WorkspaceShell title="Settings" eyebrow="Workspace">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card padding="md">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-xs bg-surface-2 text-fg-muted">
              <Settings2 className="h-4 w-4" />
            </span>
            <div>
              <div className="eyebrow">Settings</div>
              <div className="mt-0.5 font-display text-[18px] font-semibold tracking-tight text-fg">
                Configuration surfaces
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {settingsGroups.map((group) => (
              <article
                key={group.title}
                className="rounded-sm border border-border bg-surface-2 px-3.5 py-3"
              >
                <p className="font-body text-[13px] font-semibold text-fg">{group.title}</p>
                <p className="mt-1 font-body text-[12.5px] leading-[1.55] text-fg-muted">{group.description}</p>
              </article>
            ))}
          </div>
        </Card>

        <Card variant="dashed" padding="md" as="aside">
          <div className="flex items-center gap-1.5 text-fg">
            <Workflow className="h-3.5 w-3.5" />
            <p className="font-body text-[13px] font-semibold">Why this exists now</p>
          </div>
          <p className="mt-2 font-body text-[12.5px] leading-[1.55] text-fg-muted">
            The app shell should feel coherent before settings modules are production-ready. This route keeps the
            information architecture stable while later phases add actual forms and persistence.
          </p>
        </Card>
      </div>
    </WorkspaceShell>
  );
}
