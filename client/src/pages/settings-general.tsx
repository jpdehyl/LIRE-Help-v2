import { LayoutGrid } from "lucide-react";
import { SettingsLayout } from "../components/workspace/settings-layout";
import { Card } from "../components/ui";

export default function SettingsGeneralPage() {
  return (
    <SettingsLayout title="General" eyebrow="Workspace / Settings">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card padding="md">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-xs bg-surface-2 text-fg-muted">
              <LayoutGrid className="h-4 w-4" />
            </span>
            <div>
              <div className="eyebrow">Workspace identity</div>
              <div className="mt-0.5 font-display text-[18px] font-semibold tracking-tight text-fg">
                Workspace name, time zone, and languages
              </div>
            </div>
          </div>
          <p className="mt-4 font-body text-[13px] leading-[1.55] text-fg-muted">
            This surface will hold the core tenant identity — display name, default time zone, primary
            language, and the locales the workspace supports. Today these values are seeded per tenant
            on provisioning and read straight from the tenants table; editable forms land once the
            tenant settings API is in place. Pinning the route now keeps the workspace information
            architecture stable while the underlying persistence catches up.
          </p>
        </Card>

        <Card variant="dashed" padding="md" as="aside">
          <div className="eyebrow">Why this route exists now</div>
          <p className="mt-2 font-body text-[13px] leading-[1.55] text-fg-muted">
            Operators land on /settings/workspace/general from the Settings home tile. Shipping the
            route early prevents dead-end clicks during dogfooding; the editable admin UI fills in
            once the tenant settings API is wired up.
          </p>
        </Card>
      </div>
    </SettingsLayout>
  );
}
