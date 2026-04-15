export type InboxViewKey =
  | "all"
  | "assigned"
  | "unassigned"
  | "awaiting_reply"
  | "sla_at_risk"
  | "closed_recently"
  | "support"
  | "escalations"
  | "billing"
  | "vip"
  | "high_priority"
  | "bugs"
  | "renewals";

export type InboxSectionKey = "default_views" | "team_inboxes" | "saved_views";
export type ConversationStatus = "open" | "pending" | "waiting_on_customer" | "resolved";
export type PriorityLevel = "low" | "medium" | "high" | "urgent";
export type SlaState = "healthy" | "at_risk" | "breached";
export type AssignmentState = "assigned" | "unassigned" | "team";
export type TimelineItemType = "customer" | "teammate" | "internal_note" | "system";
export type ComposerMode = "reply" | "note";

export interface InboxViewDefinition {
  key: InboxViewKey;
  label: string;
  section: InboxSectionKey;
  count: number;
  description: string;
}

export interface InboxFilterState {
  channel: "email" | "chat" | "phone" | "all";
  priorities: PriorityLevel[];
  statuses: ConversationStatus[];
  tags: string[];
  assignedOnly: boolean;
}

export interface TicketSummary {
  id: string;
  status: ConversationStatus;
  priority: PriorityLevel;
  assignee: string | null;
  team: string;
  tags: string[];
  slaState: SlaState;
  nextMilestone: string;
}

export interface CustomerSummary {
  id: string;
  name: string;
  company: string;
  tier: "standard" | "priority" | "strategic";
  health: "stable" | "watch" | "at_risk";
  lastSeenLabel: string;
}

export interface ConversationRow {
  id: string;
  subject: string;
  requesterName: string;
  requesterEmail: string;
  company: string;
  inboxLabel: string;
  preview: string;
  status: ConversationStatus;
  priority: PriorityLevel;
  unread: boolean;
  assignmentState: AssignmentState;
  assignee: string | null;
  lastActivityLabel: string;
  waitingSinceLabel: string;
  messageCount: number;
  slaState: SlaState;
  tags: string[];
  ticket: TicketSummary;
  customer: CustomerSummary;
}

export interface ConversationTimelineItem {
  id: string;
  type: TimelineItemType;
  author: string;
  body: string;
  createdAtLabel: string;
}

export interface SuggestionItem {
  id: string;
  label: string;
  detail: string;
}

export interface ConversationDetail {
  conversationId: string;
  title: string;
  summary: string;
  composerMode: ComposerMode;
  ticket: TicketSummary;
  customer: CustomerSummary;
  suggestedActions: SuggestionItem[];
  timeline: ConversationTimelineItem[];
}

export interface InboxScaffoldData {
  views: InboxViewDefinition[];
  filters: InboxFilterState;
  conversations: ConversationRow[];
  details: Record<string, ConversationDetail>;
}
