import { api } from "./api";
import type {
  ConversationDetail,
  ConversationRow,
  HelpdeskDashboardMetrics,
  InboxViewDefinition,
  InboxViewKey,
  PriorityLevel,
  ConversationStatus,
} from "../components/inbox/types";

export interface InboxNavigationResponse {
  views: InboxViewDefinition[];
  defaultViewKey: InboxViewKey;
}

export interface InboxConversationListResponse {
  view: InboxViewKey;
  conversations: ConversationRow[];
}

export const helpdeskApi = {
  getNavigation: (propertyId?: string | null) => {
    const params = new URLSearchParams();
    if (propertyId) params.set("propertyId", propertyId);
    const query = params.toString();
    return api.get<InboxNavigationResponse>(`/api/helpdesk/inbox/navigation${query ? `?${query}` : ""}`);
  },
  getConversations: (view: InboxViewKey, propertyId?: string | null) => {
    const params = new URLSearchParams({ view });
    if (propertyId) params.set("propertyId", propertyId);
    return api.get<InboxConversationListResponse>(`/api/helpdesk/inbox/conversations?${params.toString()}`);
  },
  getConversationDetail: (conversationId: string) => api.get<ConversationDetail>(`/api/helpdesk/inbox/conversations/${conversationId}`),
  updateAssignee: (conversationId: string, assigneeStaffId: string | null) =>
    api.patch<ConversationDetail>(`/api/helpdesk/inbox/conversations/${conversationId}/assignee`, { assigneeStaffId }),
  updateStatus: (conversationId: string, status: ConversationStatus) =>
    api.patch<ConversationDetail>(`/api/helpdesk/inbox/conversations/${conversationId}/status`, { status }),
  updatePriority: (conversationId: string, priority: PriorityLevel) =>
    api.patch<ConversationDetail>(`/api/helpdesk/inbox/conversations/${conversationId}/priority`, { priority }),
  addTag: (conversationId: string, tagId: string) =>
    api.post<ConversationDetail>(`/api/helpdesk/inbox/conversations/${conversationId}/tags`, { tagId }),
  removeTag: (conversationId: string, tagId: string) =>
    api.delete<ConversationDetail>(`/api/helpdesk/inbox/conversations/${conversationId}/tags/${tagId}`),
  updateSnooze: (conversationId: string, snoozedUntil: string | null) =>
    api.patch<ConversationDetail>(`/api/helpdesk/inbox/conversations/${conversationId}/snooze`, { snoozedUntil }),
  updateArchiveState: (conversationId: string, archived: boolean) =>
    api.patch<ConversationDetail>(`/api/helpdesk/inbox/conversations/${conversationId}/archive`, { archived }),
  updateSpamState: (conversationId: string, spam: boolean) =>
    api.patch<ConversationDetail>(`/api/helpdesk/inbox/conversations/${conversationId}/spam`, { spam }),
  updateSoftDeleteState: (conversationId: string, deleted: boolean, deleteReason?: string | null) =>
    api.patch<ConversationDetail>(`/api/helpdesk/inbox/conversations/${conversationId}/soft-delete`, { deleted, deleteReason: deleteReason ?? null }),
  addInternalNote: (conversationId: string, body: string) =>
    api.post<ConversationDetail>(`/api/helpdesk/inbox/conversations/${conversationId}/notes`, { body }),
  replyToConversation: (conversationId: string, body: string, status?: ConversationStatus) =>
    api.post<ConversationDetail>(`/api/helpdesk/inbox/conversations/${conversationId}/replies`, {
      body,
      ...(status ? { status } : {}),
    }),
  getDashboardMetrics: () => api.get<HelpdeskDashboardMetrics>("/api/helpdesk/dashboard/metrics"),
  getPropertiesSummary: () => api.get<{ properties: PropertySummaryItem[] }>("/api/helpdesk/properties-summary"),
};

export interface ConciergeAgentSummary {
  id: string;
  name: string;
  model: string;
  version: string;
  systemPromptPreview: string;
  systemPromptFull: string;
  toolsCount: number;
  skillsCount: number;
  consoleUrl: string | null;
  lastUpdatedLabel: string | null;
  configured: boolean;
}

export interface ConciergeTryToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  result: string;
}

export interface ConciergeTryResponse {
  sessionId: string;
  reply: string | null;
  confidence: "high" | "medium" | "low" | null;
  escalated: boolean;
  escalationReason: string | null;
  stopReason: string;
  toolCalls: ConciergeTryToolCall[];
}

export interface ConciergeActivityRun {
  id: string;
  source: "try" | "draft";
  createdAt: string;
  conversationId: string | null;
  userMessage: string;
  reply: string | null;
  confidence: "high" | "medium" | "low" | null;
  escalated: boolean;
  escalationReason: string | null;
  stopReason: string;
  toolCalls: ConciergeTryToolCall[];
}

export interface ConciergeKnowledgeEntry {
  id: string;
  title: string;
  content: string;
  contentChars: number;
  updatedAtLabel: string;
}

export interface ConciergeKnowledgeSection {
  section: string;
  entryCount: number;
  totalCharCount: number;
  entries: ConciergeKnowledgeEntry[];
}

export interface ConciergeKnowledgeSummary {
  totalEntries: number;
  totalCharCount: number;
  sectionCount: number;
  sections: ConciergeKnowledgeSection[];
  editUrl: string;
}

export type ConciergeRunState = "live" | "shadow" | "paused";

export interface ConciergeSettings {
  runState: ConciergeRunState;
  autonomyCeilingPct: number;
  channels: {
    email: boolean;
    whatsapp: boolean;
    sms: boolean;
    zoom: boolean;
    slack: boolean;
    messenger: boolean;
  };
}

export type ConciergeSettingsPatch = {
  runState?: ConciergeRunState;
  autonomyCeilingPct?: number;
  channels?: Partial<ConciergeSettings["channels"]>;
};

export const conciergeApi = {
  getAgent: () => api.get<ConciergeAgentSummary>("/api/concierge/agent"),
  tryMessage: (body: { message: string; sessionId?: string }) =>
    api.post<ConciergeTryResponse>("/api/concierge/try", body),
  draftReply: (conversationId: string) =>
    api.post<ConciergeTryResponse>("/api/concierge/draft", { conversationId }),
  getKnowledge: () => api.get<ConciergeKnowledgeSummary>("/api/concierge/knowledge"),
  getActivity: () => api.get<{ runs: ConciergeActivityRun[] }>("/api/concierge/activity"),
  getSettings: () => api.get<ConciergeSettings>("/api/concierge/settings"),
  updateSettings: (patch: ConciergeSettingsPatch) =>
    api.patch<ConciergeSettings>("/api/concierge/settings", patch),
};

export interface PropertySummaryItem {
  id: string;
  code: string;
  name: string;
  location: string | null;
  unitCount: number;
  openTicketCount: number;
}
