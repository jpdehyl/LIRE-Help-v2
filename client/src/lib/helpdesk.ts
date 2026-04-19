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
  getNavigation: () => api.get<InboxNavigationResponse>("/api/helpdesk/inbox/navigation"),
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
  addInternalNote: (conversationId: string, body: string) =>
    api.post<ConversationDetail>(`/api/helpdesk/inbox/conversations/${conversationId}/notes`, { body }),
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

export const conciergeApi = {
  getAgent: () => api.get<ConciergeAgentSummary>("/api/concierge/agent"),
};

export interface PropertySummaryItem {
  id: string;
  code: string;
  name: string;
  location: string | null;
  unitCount: number;
  openTicketCount: number;
}
