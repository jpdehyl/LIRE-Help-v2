export const inboxViewKeys = [
  // Default views
  "priority",
  "unassigned",
  "escalations",
  "all",
  // Channel views
  "email",
  "whatsapp",
  "sms",
  "zoom",
  "slack",
  "messenger",
  // Team views
  "maintenance",
  "lease_compliance",
  "after_hours",
  // Saved views
  "resolved_today",
] as const;

export type InboxViewKey = (typeof inboxViewKeys)[number];
export const DEFAULT_INBOX_VIEW_KEY: InboxViewKey = "all";

export type InboxSectionKey = "default_views" | "channels" | "team_inboxes" | "saved_views";

export type InboxChannelKey = "email" | "whatsapp" | "sms" | "zoom" | "slack" | "messenger";

export const inboxChannelKeys: readonly InboxChannelKey[] = [
  "email",
  "whatsapp",
  "sms",
  "zoom",
  "slack",
  "messenger",
];
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
  channel: InboxChannelKey | string;
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
  slaCountdownLabel?: string | null;
  tags: string[];
  ticket: TicketSummary;
  customer: CustomerSummary;
  propertyId: string | null;
  propertyCode: string | null;
  aiHandling: boolean;
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

export interface HelpdeskAssigneeOption {
  id: string;
  name: string;
  role: string;
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
  availableAssignees?: HelpdeskAssigneeOption[];
}

export interface HelpdeskStatusCount {
  status: ConversationStatus;
  count: number;
}

export interface HelpdeskInboxMetric {
  inboxLabel: string;
  count: number;
  unassignedCount: number;
  atRiskCount: number;
}

export interface HelpdeskRecentActivityItem {
  id: string;
  type: TimelineItemType;
  conversationId: string;
  title: string;
  author: string;
  createdAtLabel: string;
}

export interface ChannelMetric {
  channel: string;
  label: string;
  status: "live" | "offline";
  count24h: number;
  hourlyBuckets: number[];
}

export interface HelpdeskDashboardMetrics {
  summary: {
    openConversations: number;
    unassigned: number;
    slaAtRisk: number;
    slaBreached: number;
    resolvedToday: number;
    waitingOnCustomer: number;
  };
  afterHoursHandled: number;
  tenantCount: number;
  channels: ChannelMetric[];
  byStatus: HelpdeskStatusCount[];
  byInbox: HelpdeskInboxMetric[];
  recentActivity: HelpdeskRecentActivityItem[];
  openTickets: ConversationRow[];
}

