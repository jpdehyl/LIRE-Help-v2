export const inboxViewKeys = [
  "all",
  "assigned",
  "unassigned",
  "awaiting_reply",
  "sla_at_risk",
  "closed_recently",
  "support",
  "escalations",
  "billing",
  "vip",
  "high_priority",
  "bugs",
  "renewals",
] as const;

export type InboxViewKey = (typeof inboxViewKeys)[number];
export const DEFAULT_INBOX_VIEW_KEY: InboxViewKey = "all";

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

export interface HelpdeskDashboardMetrics {
  summary: {
    openConversations: number;
    unassigned: number;
    slaAtRisk: number;
    waitingOnCustomer: number;
  };
  byStatus: HelpdeskStatusCount[];
  byInbox: HelpdeskInboxMetric[];
  recentActivity: HelpdeskRecentActivityItem[];
  openTickets: ConversationRow[];
}

export interface InboxScaffoldData {
  views: InboxViewDefinition[];
  filters: InboxFilterState;
  conversations: ConversationRow[];
  details: Record<string, ConversationDetail>;
}

export const helpdeskMockData: InboxScaffoldData = {
  views: [
    { key: "all", label: "All conversations", section: "default_views", count: 48, description: "Every open thread across inboxes" },
    { key: "assigned", label: "Assigned to me", section: "default_views", count: 12, description: "Work currently owned by you" },
    { key: "unassigned", label: "Unassigned", section: "default_views", count: 9, description: "Needs triage and ownership" },
    { key: "awaiting_reply", label: "Awaiting reply", section: "default_views", count: 15, description: "Customer needs a response" },
    { key: "sla_at_risk", label: "SLA at risk", section: "default_views", count: 4, description: "Response or resolution target is slipping" },
    { key: "closed_recently", label: "Closed recently", section: "default_views", count: 7, description: "Recently resolved conversations" },
    { key: "support", label: "Support", section: "team_inboxes", count: 19, description: "Core support queue" },
    { key: "escalations", label: "Escalations", section: "team_inboxes", count: 5, description: "Manager or specialist attention" },
    { key: "billing", label: "Billing", section: "team_inboxes", count: 6, description: "Invoices, credits, renewals" },
    { key: "vip", label: "VIP / strategic", section: "team_inboxes", count: 3, description: "High-touch accounts and renewals" },
    { key: "high_priority", label: "High priority", section: "saved_views", count: 8, description: "Urgent or high-impact issues" },
    { key: "bugs", label: "Bugs / product issues", section: "saved_views", count: 11, description: "Product-linked incidents" },
    { key: "renewals", label: "Renewal / pricing", section: "saved_views", count: 4, description: "Commercial coordination" },
  ],
  filters: {
    channel: "email",
    priorities: ["high", "urgent"],
    statuses: ["open", "pending", "waiting_on_customer"],
    tags: ["renewal", "escalation", "bug"],
    assignedOnly: false,
  },
  conversations: [
    {
      id: "c-101",
      subject: "Renewal pricing needs approval before Friday",
      requesterName: "Maya Chen",
      requesterEmail: "maya@northstarlogistics.com",
      company: "Northstar Logistics",
      inboxLabel: "VIP",
      preview: "Procurement needs the revised pricing grid and confirmation of implementation support before they sign.",
      status: "open",
      priority: "urgent",
      unread: true,
      assignmentState: "assigned",
      assignee: "Avery Kim",
      lastActivityLabel: "2m ago",
      waitingSinceLabel: "14m in queue",
      messageCount: 11,
      slaState: "at_risk",
      tags: ["renewal", "pricing", "exec"],
      ticket: {
        id: "T-3021",
        status: "open",
        priority: "urgent",
        assignee: "Avery Kim",
        team: "Commercial Ops",
        tags: ["renewal", "pricing", "vip"],
        slaState: "at_risk",
        nextMilestone: "First response due in 18m",
      },
      customer: {
        id: "cust-001",
        name: "Maya Chen",
        company: "Northstar Logistics",
        tier: "strategic",
        health: "watch",
        lastSeenLabel: "Today · 3:12 PM",
      },
    },
    {
      id: "c-102",
      subject: "Dock scheduling API returning duplicate slots",
      requesterName: "Luis Romero",
      requesterEmail: "luis@freightgrid.io",
      company: "FreightGrid",
      inboxLabel: "Escalations",
      preview: "Their dispatcher attached logs showing duplicate availability windows after last night's deploy.",
      status: "pending",
      priority: "high",
      unread: false,
      assignmentState: "team",
      assignee: "Platform Support",
      lastActivityLabel: "18m ago",
      waitingSinceLabel: "Opened 3h ago",
      messageCount: 7,
      slaState: "healthy",
      tags: ["bug", "api"],
      ticket: {
        id: "T-3018",
        status: "pending",
        priority: "high",
        assignee: "Platform Support",
        team: "Escalations",
        tags: ["bug", "integration"],
        slaState: "healthy",
        nextMilestone: "Engineering handoff queued",
      },
      customer: {
        id: "cust-002",
        name: "Luis Romero",
        company: "FreightGrid",
        tier: "priority",
        health: "stable",
        lastSeenLabel: "Today · 2:56 PM",
      },
    },
    {
      id: "c-103",
      subject: "Need W-9 and invoice copy for April billing",
      requesterName: "Priya Nair",
      requesterEmail: "priya@atlaswhse.com",
      company: "Atlas Warehouse Group",
      inboxLabel: "Billing",
      preview: "AP is missing the latest invoice PDF and vendor paperwork for the new billing entity.",
      status: "waiting_on_customer",
      priority: "medium",
      unread: true,
      assignmentState: "unassigned",
      assignee: null,
      lastActivityLabel: "41m ago",
      waitingSinceLabel: "Unowned for 41m",
      messageCount: 4,
      slaState: "healthy",
      tags: ["billing", "documents"],
      ticket: {
        id: "T-3013",
        status: "waiting_on_customer",
        priority: "medium",
        assignee: null,
        team: "Billing",
        tags: ["billing", "finance"],
        slaState: "healthy",
        nextMilestone: "Waiting on customer confirmation",
      },
      customer: {
        id: "cust-003",
        name: "Priya Nair",
        company: "Atlas Warehouse Group",
        tier: "standard",
        health: "stable",
        lastSeenLabel: "Today · 1:48 PM",
      },
    },
    {
      id: "c-104",
      subject: "How should we route after-hours escalation calls?",
      requesterName: "Noah Patel",
      requesterEmail: "noah@peakyard.com",
      company: "Peak Yard",
      inboxLabel: "Support",
      preview: "Operations wants a documented after-hours process for loading emergencies and manager escalation.",
      status: "open",
      priority: "low",
      unread: false,
      assignmentState: "assigned",
      assignee: "Jordan Lee",
      lastActivityLabel: "1h ago",
      waitingSinceLabel: "Opened today",
      messageCount: 5,
      slaState: "healthy",
      tags: ["process", "ops"],
      ticket: {
        id: "T-3009",
        status: "open",
        priority: "low",
        assignee: "Jordan Lee",
        team: "Support",
        tags: ["process"],
        slaState: "healthy",
        nextMilestone: "Reply drafted",
      },
      customer: {
        id: "cust-004",
        name: "Noah Patel",
        company: "Peak Yard",
        tier: "standard",
        health: "stable",
        lastSeenLabel: "Today · 12:37 PM",
      },
    },
  ],
  details: {
    "c-101": {
      conversationId: "c-101",
      title: "Renewal pricing needs approval before Friday",
      summary: "Strategic renewal is blocked on revised pricing, implementation assurances, and executive approval timing.",
      composerMode: "reply",
      ticket: {
        id: "T-3021",
        status: "open",
        priority: "urgent",
        assignee: "Avery Kim",
        team: "Commercial Ops",
        tags: ["renewal", "pricing", "vip"],
        slaState: "at_risk",
        nextMilestone: "First response due in 18m",
      },
      customer: {
        id: "cust-001",
        name: "Maya Chen",
        company: "Northstar Logistics",
        tier: "strategic",
        health: "watch",
        lastSeenLabel: "Today · 3:12 PM",
      },
      suggestedActions: [
        { id: "sa-1", label: "Send pricing confirmation", detail: "Use the approved enterprise renewal template and include implementation coverage." },
        { id: "sa-2", label: "Loop in account executive", detail: "Executive approval request should be visible in the internal note before reply." },
        { id: "sa-3", label: "Add renewal risk tag", detail: "Keeps this conversation visible in the strategic accounts saved view." },
      ],
      timeline: [
        { id: "tl-1", type: "customer", author: "Maya Chen", body: "We need the updated pricing grid and confirmation that onboarding support is included before Friday.", createdAtLabel: "Today · 3:10 PM" },
        { id: "tl-2", type: "internal_note", author: "Avery Kim", body: "AE already approved discount band. Need finance to confirm multi-site implementation coverage.", createdAtLabel: "Today · 3:14 PM" },
        { id: "tl-3", type: "system", author: "Workflow", body: "Priority raised to urgent because renewal closes within 72 hours and account tier is strategic.", createdAtLabel: "Today · 3:15 PM" },
      ],
    },
    "c-102": {
      conversationId: "c-102",
      title: "Dock scheduling API returning duplicate slots",
      summary: "Customer supplied logs pointing to a post-deploy regression impacting scheduling integrations.",
      composerMode: "note",
      ticket: {
        id: "T-3018",
        status: "pending",
        priority: "high",
        assignee: "Platform Support",
        team: "Escalations",
        tags: ["bug", "integration"],
        slaState: "healthy",
        nextMilestone: "Engineering handoff queued",
      },
      customer: {
        id: "cust-002",
        name: "Luis Romero",
        company: "FreightGrid",
        tier: "priority",
        health: "stable",
        lastSeenLabel: "Today · 2:56 PM",
      },
      suggestedActions: [
        { id: "sa-4", label: "Escalate to engineering", detail: "Attach API payload samples and recent deploy ID before handoff." },
        { id: "sa-5", label: "Draft status update", detail: "Acknowledge impact and set expectation for engineering review." },
      ],
      timeline: [
        { id: "tl-4", type: "customer", author: "Luis Romero", body: "Attached are three examples from this morning where the same dock slot appears twice in our dispatcher feed.", createdAtLabel: "Today · 2:41 PM" },
        { id: "tl-5", type: "teammate", author: "Jordan Lee", body: "Thanks — we reproduced the issue in staging and are preparing an engineering handoff.", createdAtLabel: "Today · 2:52 PM" },
      ],
    },
    "c-103": {
      conversationId: "c-103",
      title: "Need W-9 and invoice copy for April billing",
      summary: "Billing ops request waiting for customer confirmation on entity name after documents are sent.",
      composerMode: "reply",
      ticket: {
        id: "T-3013",
        status: "waiting_on_customer",
        priority: "medium",
        assignee: null,
        team: "Billing",
        tags: ["billing", "finance"],
        slaState: "healthy",
        nextMilestone: "Waiting on customer confirmation",
      },
      customer: {
        id: "cust-003",
        name: "Priya Nair",
        company: "Atlas Warehouse Group",
        tier: "standard",
        health: "stable",
        lastSeenLabel: "Today · 1:48 PM",
      },
      suggestedActions: [
        { id: "sa-6", label: "Attach vendor paperwork", detail: "Provide W-9 plus April invoice PDF in the same reply." },
      ],
      timeline: [
        { id: "tl-6", type: "customer", author: "Priya Nair", body: "Can you resend the April invoice and the W-9 for our AP team?", createdAtLabel: "Today · 1:48 PM" },
      ],
    },
    "c-104": {
      conversationId: "c-104",
      title: "How should we route after-hours escalation calls?",
      summary: "Process clarification request that should turn into a documented macro or playbook later.",
      composerMode: "reply",
      ticket: {
        id: "T-3009",
        status: "open",
        priority: "low",
        assignee: "Jordan Lee",
        team: "Support",
        tags: ["process"],
        slaState: "healthy",
        nextMilestone: "Reply drafted",
      },
      customer: {
        id: "cust-004",
        name: "Noah Patel",
        company: "Peak Yard",
        tier: "standard",
        health: "stable",
        lastSeenLabel: "Today · 12:37 PM",
      },
      suggestedActions: [
        { id: "sa-7", label: "Create knowledge draft", detail: "Turn the approved answer into a reusable playbook later." },
      ],
      timeline: [
        { id: "tl-7", type: "customer", author: "Noah Patel", body: "Our managers want a clear after-hours path for loading emergencies and escalations.", createdAtLabel: "Today · 12:37 PM" },
      ],
    },
  },
};
