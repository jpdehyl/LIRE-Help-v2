import type { InboxViewDefinition, InboxViewKey } from "./types";

interface InboxSidebarProps {
  views: InboxViewDefinition[];
  selectedView: InboxViewKey;
  onSelectView: (view: InboxViewKey) => void;
}

const sectionLabels = {
  default_views: "Default views",
  team_inboxes: "Team inboxes",
  saved_views: "Saved views",
} as const;

export function InboxSidebar({ views, selectedView, onSelectView }: InboxSidebarProps) {
  const sections = Object.entries(sectionLabels).map(([section, label]) => ({
    section,
    label,
    views: views.filter((view) => view.section === section),
  }));

  return (
    <aside className="flex h-full min-h-0 w-full max-w-xs flex-col border-r border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Inbox IA</p>
        <h2 className="mt-1 text-sm font-semibold text-slate-900">Queues and saved views</h2>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          This is route-driven scaffolding for view selection. Counts and grouping are mocked for phase 1.
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {sections.map(({ section, label, views: sectionViews }) => (
          <section key={section}>
            <div className="px-2 pb-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
            </div>
            <div className="space-y-1">
              {sectionViews.map((view) => {
                const active = view.key === selectedView;

                return (
                  <button
                    key={view.key}
                    type="button"
                    onClick={() => onSelectView(view.key)}
                    className={[
                      "flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left transition-colors",
                      active ? "bg-slate-900 text-white" : "hover:bg-slate-100 text-slate-700",
                    ].join(" ")}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium">{view.label}</span>
                        <span
                          className={[
                            "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                            active ? "bg-white/15 text-white" : "bg-slate-100 text-slate-600",
                          ].join(" ")}
                        >
                          {view.count}
                        </span>
                      </div>
                      <p className={[
                        "mt-1 text-xs leading-relaxed",
                        active ? "text-slate-300" : "text-slate-500",
                      ].join(" ")}>
                        {view.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </aside>
  );
}
