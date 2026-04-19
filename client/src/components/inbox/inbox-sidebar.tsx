import {
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  Flame,
  Hash,
  Mail,
  MessageCircle,
  MessageSquare,
  Phone,
  Send,
  UserMinus,
  Video,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { InboxSectionKey, InboxViewDefinition, InboxViewKey } from "./types";

interface InboxSidebarProps {
  views: InboxViewDefinition[];
  selectedView: InboxViewKey;
  onSelectView: (view: InboxViewKey) => void;
  autonomyPct?: number | null;
}

const sectionMeta: Record<InboxSectionKey, { label: string; order: number }> = {
  default_views: { label: "Default", order: 0 },
  channels: { label: "Channels", order: 1 },
  team_inboxes: { label: "Teams", order: 2 },
  saved_views: { label: "Saved", order: 3 },
};

const viewIcons: Partial<Record<InboxViewKey, LucideIcon>> = {
  priority: Flame,
  unassigned: UserMinus,
  escalations: AlertTriangle,
  all: CircleDot,
  email: Mail,
  whatsapp: MessageCircle,
  sms: Phone,
  zoom: Video,
  slack: Hash,
  messenger: Send,
  maintenance: Wrench,
  lease_compliance: MessageSquare,
  after_hours: MessageSquare,
  resolved_today: CheckCircle2,
};

// Channels where "live" (green dot) means the integration is connected. Until
// per-channel health telemetry exists this is a display-only hint.
const liveChannels: ReadonlySet<InboxViewKey> = new Set(["zoom"]);

export function InboxSidebar({ views, selectedView, onSelectView, autonomyPct }: InboxSidebarProps) {
  const sections = Object.entries(sectionMeta)
    .sort((a, b) => a[1].order - b[1].order)
    .map(([section, meta]) => ({
      section: section as InboxSectionKey,
      label: meta.label,
      views: views.filter((view) => view.section === (section as InboxSectionKey)),
    }));

  const autonomyDisplay =
    typeof autonomyPct === "number" && Number.isFinite(autonomyPct) ? Math.round(autonomyPct) : null;

  return (
    <aside className="flex h-full min-h-0 w-[224px] shrink-0 flex-col border-r border-border bg-surface">
      <div className="border-b border-border px-4 py-3">
        <div className="eyebrow text-fg-subtle">Views</div>
        <div className="mt-1 font-display text-[18px] font-bold tracking-tight text-fg">Inbox</div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-2.5 py-3">
        {sections.map(({ section, label, views: sectionViews }) =>
          sectionViews.length === 0 ? null : (
            <section key={section}>
              <div className="eyebrow px-2 pb-1.5 text-fg-subtle">{label}</div>
              <div className="space-y-0.5">
                {sectionViews.map((view) => {
                  const active = view.key === selectedView;
                  const Icon = viewIcons[view.key] ?? CircleDot;
                  const showLive = section === "channels" && liveChannels.has(view.key);

                  return (
                    <button
                      key={view.key}
                      type="button"
                      onClick={() => onSelectView(view.key)}
                      className={[
                        "flex w-full items-center gap-2 rounded-sm border-l-2 px-2 py-[7px] text-left font-body text-[13px] transition-colors ease-ds duration-fast",
                        active
                          ? "border-accent bg-surface-2 font-semibold text-fg"
                          : "border-transparent text-fg-muted hover:bg-surface-2 hover:text-fg",
                      ].join(" ")}
                    >
                      <Icon
                        className={["h-3.5 w-3.5 shrink-0", active ? "text-accent" : "text-fg-subtle"].join(" ")}
                      />
                      <span className="flex-1 truncate">{view.label}</span>
                      {showLive ? (
                        <span
                          className="h-[6px] w-[6px] rounded-full bg-success"
                          aria-label="Channel online"
                          title="Channel online"
                        />
                      ) : view.count > 0 ? (
                        <span className="font-mono text-[11px] text-fg-muted">{view.count}</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </section>
          ),
        )}
      </div>

      <div className="border-t border-border bg-surface-2 px-3.5 py-2.5">
        <div className="eyebrow text-[10px] text-fg-subtle">24h autonomy</div>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="font-mono text-[22px] font-medium leading-none text-fg">
            {autonomyDisplay ?? "—"}
          </span>
          <span className="font-body text-[11px] text-fg-muted">% without human</span>
        </div>
      </div>
    </aside>
  );
}
