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
    <aside className="flex h-full min-h-0 w-full max-w-xs flex-col border-r border-slate-200 bg-[#f8fafb]">
      <div className="border-b border-slate-200 px-5 py-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Inbox navigation</p>
        <h2 className="mt-2 text-sm font-semibold tracking-tight text-slate-950">Queues and saved views</h2>
        <p className="mt-2 text-xs leading-6 text-slate-500">
          Counts reflect the current helpdesk snapshot while the visible shell stays calmer and more product-like.
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-5">
        {sections.map(({ section, label, views: sectionViews }) => (
          <section key={section}>
            <div className="px-2 pb-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
            </div>
            <div className="space-y-1.5">
              {sectionViews.map((view) => {
                const active = view.key === selectedView;

                return (
                  <button
                    key={view.key}
                    type="button"
                    onClick={() => onSelectView(view.key)}
                    className={[
                      "flex w-full items-start gap-3 rounded-[22px] border px-3 py-3 text-left transition-all",
                      active
                        ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                        : "border-transparent bg-transparent text-slate-700 hover:border-slate-200 hover:bg-white hover:shadow-sm",
                    ].join(" ")}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold tracking-tight">{view.label}</span>
                        <span
                          className={[
                            "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                            active ? "bg-white/10 text-white" : "bg-slate-100 text-slate-600",
                          ].join(" ")}
                        >
                          {view.count}
                        </span>
                      </div>
                      <p
                        className={[
                          "mt-1 text-xs leading-5",
                          active ? "text-slate-300" : "text-slate-500",
                        ].join(" ")}
                      >
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
