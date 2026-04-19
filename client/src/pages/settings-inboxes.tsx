import { Inbox as InboxIcon } from "lucide-react";
import { WorkspaceShell } from "../components/workspace/workspace-shell";
import { Card } from "../components/ui";

export default function SettingsInboxesPage() {
  return (
    <WorkspaceShell title="Inboxes" eyebrow="Operations / Settings">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card padding="md">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-xs bg-surface-2 text-fg-muted">
              <InboxIcon className="h-4 w-4" />
            </span>
            <div>
              <div className="eyebrow">Inbox settings</div>
              <div className="mt-0.5 font-display text-[18px] font-semibold tracking-tight text-fg">
                Queue definitions and team routing
              </div>
            </div>
          </div>
          <p className="mt-4 font-body text-[13px] leading-[1.55] text-fg-muted">
            This is the home for creating, renaming, and routing team inboxes (Support, Escalations, Billing, VIP, or
            custom). In the current phase, inbox definitions come from the helpdesk seed and are visible on the left
            inbox sidebar. Creation and edit UI lands in the next tranche; the route exists now so the workspace
            information architecture stays stable while downstream features are wired in.
          </p>
        </Card>

        <Card variant="dashed" padding="md" as="aside">
          <div className="eyebrow">Why this route exists now</div>
          <p className="mt-2 font-body text-[13px] leading-[1.55] text-fg-muted">
            Operators land on /settings/inboxes when they click the inbox configuration entry in the sidebar. Shipping
            the route early prevents dead-end clicks during dogfooding; the detailed admin UI fills in later.
          </p>
        </Card>
      </div>
    </WorkspaceShell>
  );
}
