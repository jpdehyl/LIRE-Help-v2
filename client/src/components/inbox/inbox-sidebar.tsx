import type { InboxViewDefinition, InboxViewKey } from "./types";

interface InboxSidebarProps {
  views: InboxViewDefinition[];
  selectedView: InboxViewKey;
  onSelectView: (view: InboxViewKey) => void;
}

const sectionLabels = {
  default_views: "Default",
  team_inboxes: "Teams",
  saved_views: "Saved",
} as const;

export function InboxSidebar({ views, selectedView, onSelectView }: InboxSidebarProps) {
  const sections = Object.entries(sectionLabels).map(([section, label]) => ({
    section,
    label,
    views: views.filter((view) => view.section === section),
  }));

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
                      <span className="flex-1 truncate">{view.label}</span>
                      {view.count > 0 ? (
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
          <span className="font-mono text-[22px] font-medium leading-none text-fg">82</span>
          <span className="font-body text-[11px] text-fg-muted">% without human</span>
        </div>
      </div>
    </aside>
  );
}
