import type { InboxViewKey } from "./types";
import { inboxScaffoldData } from "./mock-data";
import { InboxSidebar } from "./inbox-sidebar";
import { ConversationList } from "./conversation-list";
import { ConversationDetailPane } from "./conversation-detail";

interface InboxShellProps {
  selectedView: InboxViewKey;
  selectedConversationId: string | null;
  onSelectView: (view: InboxViewKey) => void;
  onSelectConversation: (conversationId: string) => void;
}

export function InboxShell({
  selectedView,
  selectedConversationId,
  onSelectView,
  onSelectConversation,
}: InboxShellProps) {
  const fallbackView = inboxScaffoldData.views.find((view) => view.key === selectedView) ?? inboxScaffoldData.views[0];
  const conversations = inboxScaffoldData.conversations.filter((conversation) => {
    switch (fallbackView.key) {
      case "assigned":
        return conversation.assignmentState === "assigned";
      case "unassigned":
        return conversation.assignmentState === "unassigned";
      case "awaiting_reply":
        return conversation.status === "open" || conversation.status === "pending";
      case "sla_at_risk":
        return conversation.slaState === "at_risk" || conversation.slaState === "breached";
      case "closed_recently":
        return conversation.status === "resolved";
      case "support":
      case "escalations":
      case "billing":
      case "vip":
        return conversation.inboxLabel.toLowerCase() === fallbackView.label.toLowerCase().replace(" / strategic", "");
      case "high_priority":
        return conversation.priority === "high" || conversation.priority === "urgent";
      case "bugs":
        return conversation.tags.includes("bug");
      case "renewals":
        return conversation.tags.includes("renewal") || conversation.tags.includes("pricing");
      default:
        return true;
    }
  });
  const activeConversation = conversations.find((conversation) => conversation.id === selectedConversationId) ?? conversations[0];
  const activeDetail = activeConversation ? inboxScaffoldData.details[activeConversation.id] : undefined;

  return (
    <div className="flex h-[calc(100vh-11rem)] min-h-[720px] min-w-0 overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
      <div className="hidden xl:block">
        <InboxSidebar views={inboxScaffoldData.views} selectedView={fallbackView.key} onSelectView={onSelectView} />
      </div>

      <div className="grid min-w-0 flex-1 grid-cols-1 xl:grid-cols-[420px_minmax(0,1fr)]">
        <ConversationList
          conversations={conversations}
          selectedConversationId={activeConversation?.id ?? null}
          onSelectConversation={onSelectConversation}
        />
        <ConversationDetailPane conversation={activeConversation} detail={activeDetail} />
      </div>
    </div>
  );
}
