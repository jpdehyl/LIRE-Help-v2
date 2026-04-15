import type { ConversationRow } from "./types";

interface ConversationListProps {
  conversations: ConversationRow[];
  selectedConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
}

const priorityClasses = {
  low: "bg-slate-100 text-slate-600",
  medium: "bg-amber-50 text-amber-700",
  high: "bg-orange-50 text-orange-700",
  urgent: "bg-red-50 text-red-700",
} as const;

const statusClasses = {
  open: "bg-emerald-50 text-emerald-700",
  pending: "bg-blue-50 text-blue-700",
  waiting_on_customer: "bg-violet-50 text-violet-700",
  resolved: "bg-slate-100 text-slate-600",
} as const;

const slaClasses = {
  healthy: "bg-emerald-50 text-emerald-700",
  at_risk: "bg-amber-50 text-amber-700",
  breached: "bg-red-50 text-red-700",
} as const;

export function ConversationList({ conversations, selectedConversationId, onSelectConversation }: ConversationListProps) {
  if (conversations.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-white p-6 text-center">
        <div>
          <p className="text-sm font-medium text-slate-900">No conversations in this queue</p>
          <p className="mt-1 text-sm text-slate-500">Phase 1 ships the list scaffold, empty state, and row anatomy before real data wiring.</p>
        </div>
      </div>
    );
  }

  return (
    <section className="flex h-full min-h-0 flex-col bg-white">
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Conversation list</p>
            <h2 className="mt-1 text-sm font-semibold text-slate-900">Scan, triage, and pick the next item</h2>
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
            {conversations.length} in view
          </span>
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-slate-200 bg-slate-50 px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        <span>Requester, company, snippet</span>
        <span>State</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {conversations.map((conversation) => {
          const active = conversation.id === selectedConversationId;

          return (
            <button
              key={conversation.id}
              type="button"
              onClick={() => onSelectConversation(conversation.id)}
              className={[
                "grid w-full grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-slate-200 px-5 py-4 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                active ? "bg-blue-50" : "bg-white hover:bg-slate-50",
              ].join(" ")}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold text-slate-900">{conversation.requesterName}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">{conversation.company}</span>
                  {conversation.unread && <span className="h-2.5 w-2.5 rounded-full bg-blue-500" aria-label="Unread conversation" />}
                </div>
                <p className="mt-1 text-sm font-medium text-slate-800">{conversation.subject}</p>
                <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-slate-500">{conversation.preview}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span>{conversation.requesterEmail}</span>
                  <span>•</span>
                  <span>{conversation.inboxLabel}</span>
                  <span>•</span>
                  <span>{conversation.messageCount} messages</span>
                  <span>•</span>
                  <span>{conversation.waitingSinceLabel}</span>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2 text-right">
                <span className="text-xs font-medium text-slate-500">{conversation.lastActivityLabel}</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${priorityClasses[conversation.priority]}`}>
                  {conversation.priority}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusClasses[conversation.status]}`}>
                  {conversation.status.replaceAll("_", " ")}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${slaClasses[conversation.slaState]}`}>
                  SLA {conversation.slaState.replaceAll("_", " ")}
                </span>
                <span className="max-w-[180px] text-xs text-slate-500">
                  {conversation.assignee ? `Owner: ${conversation.assignee}` : "Unassigned"}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
