import { Workflow } from "lucide-react";
import { WorkspaceShell } from "../components/workspace/workspace-shell";
import { Card } from "../components/ui";

export default function SettingsWorkflowsPage() {
  return (
    <WorkspaceShell title="Workflows" eyebrow="Workspace / Settings">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card padding="md">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-xs bg-surface-2 text-fg-muted">
              <Workflow className="h-4 w-4" />
            </span>
            <div>
              <div className="eyebrow">Workflow rules</div>
              <div className="mt-0.5 font-display text-[18px] font-semibold tracking-tight text-fg">
                Automation is coming in a later cycle
              </div>
            </div>
          </div>
          <p className="mt-4 font-body text-[13px] leading-[1.55] text-fg-muted">
            SLA policy rules, macros, and escalation automations will live here. For now, conversations route through
            inbox defaults and SLA state derives from the first-response / next-response / resolution timestamps written
            by the helpdesk service. When this surface ships, it will read from and write to the same help_slas and
            help_inboxes tables we already use — no parallel ticketing domain.
          </p>
        </Card>

        <Card variant="dashed" padding="md" as="aside">
          <div className="eyebrow">Placeholder on purpose</div>
          <p className="mt-2 font-body text-[13px] leading-[1.55] text-fg-muted">
            The sidebar links to /settings/workflows so operators who expect a workflow-rule surface don't hit a 404.
            Persisted rules and a rule builder follow once dogfooding proves the underlying primitives.
          </p>
        </Card>
      </div>
    </WorkspaceShell>
  );
}
