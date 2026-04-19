import { db } from "./db.js";
import {
  tenants,
  properties,
  agents,
  platformKnowledge,
  platformSessions,
  helpInboxes,
  helpCustomers,
  helpSlas,
  helpTags,
  helpConversations,
  helpTickets,
  helpMessages,
  helpConversationTags,
  staffUsers,
} from "../shared/schema.js";
import { DEFAULT_INBOX_VIEW_KEY, inboxViewKeys } from "../shared/helpdesk.js";
import { and, asc, desc, eq } from "drizzle-orm";
import type {
  Tenant,
  InsertTenant,
  Property,
  InsertProperty,
  Agent,
  InsertAgent,
  PlatformKnowledgeEntry,
  PlatformSession,
  HelpConversation,
  HelpConversationTag,
  HelpCustomer,
  HelpInbox,
  HelpMessage,
  HelpTag,
  HelpTicket,
  StaffUser,
} from "../shared/schema.js";
import type {
  AssignmentState,
  ComposerMode,
  ConversationDetail,
  ConversationRow,
  ConversationStatus,
  ConversationTimelineItem,
  HelpdeskAssigneeOption,
  HelpdeskDashboardMetrics,
  HelpdeskInboxMetric,
  HelpdeskRecentActivityItem,
  InboxViewDefinition,
  InboxViewKey,
  PriorityLevel,
  SlaState,
  SuggestionItem,
  TimelineItemType,
} from "../shared/helpdesk.js";

interface HelpdeskScope {
  tenantId: string;
  propertyId: string | null;
  staffId: string | null;
}

interface HelpdeskContext {
  scope: HelpdeskScope;
  staff: StaffUser[];
  inboxes: HelpInbox[];
  customers: HelpCustomer[];
  tags: HelpTag[];
  conversations: HelpConversation[];
  tickets: HelpTicket[];
  messages: HelpMessage[];
  conversationTags: HelpConversationTag[];
}

const viewDefinitionsBase: Record<InboxViewKey, Omit<InboxViewDefinition, "count">> = {
  all: { key: "all", label: "All conversations", section: "default_views", description: "Every open thread across inboxes" },
  assigned: { key: "assigned", label: "Assigned to me", section: "default_views", description: "Work currently owned by you" },
  unassigned: { key: "unassigned", label: "Unassigned", section: "default_views", description: "Needs triage and ownership" },
  awaiting_reply: { key: "awaiting_reply", label: "Awaiting reply", section: "default_views", description: "Customer needs a response" },
  sla_at_risk: { key: "sla_at_risk", label: "SLA at risk", section: "default_views", description: "Response or resolution target is slipping" },
  closed_recently: { key: "closed_recently", label: "Closed recently", section: "default_views", description: "Recently resolved conversations" },
  support: { key: "support", label: "Support", section: "team_inboxes", description: "Core support queue" },
  escalations: { key: "escalations", label: "Escalations", section: "team_inboxes", description: "Manager or specialist attention" },
  billing: { key: "billing", label: "Billing", section: "team_inboxes", description: "Invoices, credits, renewals" },
  vip: { key: "vip", label: "VIP / strategic", section: "team_inboxes", description: "High-touch accounts and renewals" },
  high_priority: { key: "high_priority", label: "High priority", section: "saved_views", description: "Urgent or high-impact issues" },
  bugs: { key: "bugs", label: "Bugs / product issues", section: "saved_views", description: "Product-linked incidents" },
  renewals: { key: "renewals", label: "Renewal / pricing", section: "saved_views", description: "Commercial coordination" },
};

const priorityOrder: PriorityLevel[] = ["urgent", "high", "medium", "low"];
const statusOrder: ConversationStatus[] = ["open", "pending", "waiting_on_customer", "resolved"];

// ─── Tenants ─────────────────────────────────────────────────────────────────

export async function getTenants(): Promise<Tenant[]> {
  return db.select().from(tenants).orderBy(tenants.name);
}

export async function createTenant(data: InsertTenant): Promise<Tenant> {
  const [row] = await db.insert(tenants).values(data).returning();
  return row!;
}

// ─── Properties ──────────────────────────────────────────────────────────────

export async function getProperties(tenantId?: string | null): Promise<Property[]> {
  if (tenantId) {
    return db.select().from(properties).where(eq(properties.tenantId, tenantId)).orderBy(properties.name);
  }
  return db.select().from(properties).orderBy(properties.name);
}

export async function createProperty(data: InsertProperty): Promise<Property> {
  const [row] = await db.insert(properties).values(data).returning();
  return row!;
}

export async function tenantOwnsProperty(tenantId: string, propertyId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: properties.id })
    .from(properties)
    .where(and(eq(properties.tenantId, tenantId), eq(properties.id, propertyId)))
    .limit(1);
  return Boolean(row);
}

export async function updateProperty(id: string, data: Partial<InsertProperty>): Promise<Property | null> {
  const [row] = await db.update(properties).set({ ...data, updatedAt: new Date() }).where(eq(properties.id, id)).returning();
  return row ?? null;
}

// ─── Agents ──────────────────────────────────────────────────────────────────

export async function getAllAgents(): Promise<Agent[]> {
  return db.select().from(agents);
}

export async function getAgentByPropertyId(propertyId: string): Promise<Agent | null> {
  const [row] = await db.select().from(agents).where(eq(agents.propertyId, propertyId));
  return row ?? null;
}

export async function createAgent(data: InsertAgent): Promise<Agent> {
  const [row] = await db.insert(agents).values(data).returning();
  return row!;
}

export async function updateAgent(agentId: string, data: Partial<InsertAgent>): Promise<Agent | null> {
  const [row] = await db.update(agents)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(agents.id, agentId))
    .returning();
  return row ?? null;
}

export async function upsertAgent(propertyId: string, data: Partial<InsertAgent>): Promise<Agent> {
  const existing = await getAgentByPropertyId(propertyId);
  if (existing) {
    const [row] = await db.update(agents)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(agents.propertyId, propertyId))
      .returning();
    return row!;
  }
  const [row] = await db.insert(agents).values({ propertyId, ...data } as InsertAgent).returning();
  return row!;
}

// ─── Platform Knowledge ─────────────────────────────────────────────────────

export async function getPlatformKnowledge(tenantId: string): Promise<PlatformKnowledgeEntry[]> {
  return db
    .select()
    .from(platformKnowledge)
    .where(eq(platformKnowledge.tenantId, tenantId))
    .orderBy(platformKnowledge.sortOrder);
}

export async function createPlatformKnowledge(
  tenantId: string,
  data: { section: string; title: string; content: string },
): Promise<PlatformKnowledgeEntry> {
  const entries = await getPlatformKnowledge(tenantId);
  const maxOrder = entries.length > 0 ? Math.max(...entries.map((entry) => entry.sortOrder)) : -1;
  const [row] = await db
    .insert(platformKnowledge)
    .values({ ...data, tenantId, sortOrder: maxOrder + 1 })
    .returning();
  return row!;
}

export async function updatePlatformKnowledge(
  id: string,
  tenantId: string,
  data: Partial<{ section: string; title: string; content: string }>,
): Promise<PlatformKnowledgeEntry | null> {
  const [row] = await db
    .update(platformKnowledge)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(platformKnowledge.id, id), eq(platformKnowledge.tenantId, tenantId)))
    .returning();
  return row ?? null;
}

export async function deletePlatformKnowledge(id: string, tenantId: string): Promise<boolean> {
  const rows = await db
    .delete(platformKnowledge)
    .where(and(eq(platformKnowledge.id, id), eq(platformKnowledge.tenantId, tenantId)))
    .returning({ id: platformKnowledge.id });
  return rows.length > 0;
}

export async function reorderPlatformKnowledge(
  id: string,
  direction: "up" | "down",
  tenantId: string,
): Promise<PlatformKnowledgeEntry[]> {
  const entries = await getPlatformKnowledge(tenantId);
  const idx = entries.findIndex((entry) => entry.id === id);
  if (idx < 0) return entries;
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= entries.length) return entries;
  const a = entries[idx]!;
  const b = entries[swapIdx]!;
  await db
    .update(platformKnowledge)
    .set({ sortOrder: b.sortOrder })
    .where(and(eq(platformKnowledge.id, a.id), eq(platformKnowledge.tenantId, tenantId)));
  await db
    .update(platformKnowledge)
    .set({ sortOrder: a.sortOrder })
    .where(and(eq(platformKnowledge.id, b.id), eq(platformKnowledge.tenantId, tenantId)));
  return getPlatformKnowledge(tenantId);
}

// ─── Platform Sessions ──────────────────────────────────────────────────────

export async function upsertPlatformSession(sessionId: string, messages: { role: string; content: string }[], escalated: boolean): Promise<PlatformSession> {
  const [existing] = await db.select().from(platformSessions).where(eq(platformSessions.sessionId, sessionId));
  if (existing) {
    const [row] = await db.update(platformSessions).set({
      messages,
      messageCount: messages.length,
      escalatedToWa: escalated || existing.escalatedToWa,
      lastMessageAt: new Date(),
    }).where(eq(platformSessions.id, existing.id)).returning();
    return row!;
  }
  const [row] = await db.insert(platformSessions).values({
    sessionId,
    messages,
    messageCount: messages.length,
    escalatedToWa: escalated,
  }).returning();
  return row!;
}

export async function getPlatformSessions(limit = 100): Promise<PlatformSession[]> {
  return db.select().from(platformSessions).orderBy(desc(platformSessions.lastMessageAt)).limit(limit);
}

export async function getPlatformSession(id: string): Promise<PlatformSession | null> {
  const [row] = await db.select().from(platformSessions).where(eq(platformSessions.id, id));
  return row ?? null;
}

export async function updatePlatformSessionTags(id: string, tags: string[]): Promise<PlatformSession | null> {
  const [row] = await db.update(platformSessions).set({ tags }).where(eq(platformSessions.id, id)).returning();
  return row ?? null;
}

// ─── Helpdesk persistence / source of truth ─────────────────────────────────

async function resolveHelpdeskScope(tenantId?: string | null, propertyId?: string | null, staffId?: string | null): Promise<HelpdeskScope | null> {
  if (tenantId) {
    return { tenantId, propertyId: propertyId ?? null, staffId: staffId ?? null };
  }

  if (propertyId) {
    const [property] = await db.select().from(properties).where(eq(properties.id, propertyId)).limit(1);
    if (property?.tenantId) {
      return { tenantId: property.tenantId, propertyId: property.id, staffId: staffId ?? null };
    }
  }

  if (staffId) {
    const [staff] = await db.select().from(staffUsers).where(eq(staffUsers.id, staffId)).limit(1);
    if (staff?.tenantId) {
      return { tenantId: staff.tenantId, propertyId: staff.propertyId ?? null, staffId: staff.id };
    }
  }

  const [tenant] = await db.select().from(tenants).orderBy(asc(tenants.createdAt)).limit(1);
  if (!tenant) return null;

  const [property] = await db.select().from(properties).where(eq(properties.tenantId, tenant.id)).orderBy(asc(properties.createdAt)).limit(1);
  return { tenantId: tenant.id, propertyId: property?.id ?? null, staffId: staffId ?? null };
}

function withinScope<T extends { propertyId: string | null }>(items: T[], propertyId: string | null): T[] {
  if (!propertyId) return items;
  return items.filter((item) => item.propertyId === null || item.propertyId === propertyId);
}

function formatAbsolute(date: Date | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatRelative(date: Date | null | undefined): string {
  if (!date) return "—";
  const diffMs = date.getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / 60000);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  if (Math.abs(diffMinutes) < 60) return formatter.format(diffMinutes, "minute");
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return formatter.format(diffHours, "hour");
  const diffDays = Math.round(diffHours / 24);
  return formatter.format(diffDays, "day");
}

function deriveSlaState(conversation: HelpConversation): SlaState {
  if (conversation.status === "resolved") return "healthy";
  const checkpoints = [conversation.firstResponseDueAt, conversation.nextResponseDueAt, conversation.resolutionDueAt]
    .filter((value): value is Date => value instanceof Date)
    .sort((a, b) => a.getTime() - b.getTime());
  if (checkpoints.length === 0) return "healthy";

  const nextDue = checkpoints[0]!;
  const diffMinutes = (nextDue.getTime() - Date.now()) / 60000;
  if (diffMinutes <= 0) return "breached";
  if (diffMinutes <= 45) return "at_risk";
  return "healthy";
}

function deriveNextMilestone(ticket: HelpTicket | undefined, conversation: HelpConversation): string {
  if (ticket?.nextMilestone) return ticket.nextMilestone;
  if (conversation.status === "resolved") return "Resolved";
  if (conversation.status === "waiting_on_customer") return "Waiting on customer reply";
  if (conversation.firstResponseDueAt) return `First response ${formatRelative(conversation.firstResponseDueAt)}`;
  if (conversation.nextResponseDueAt) return `Next response ${formatRelative(conversation.nextResponseDueAt)}`;
  if (conversation.resolutionDueAt) return `Resolution ${formatRelative(conversation.resolutionDueAt)}`;
  return "Active conversation";
}

function deriveWaitingSinceLabel(conversation: HelpConversation): string {
  if (conversation.status === "resolved") {
    return conversation.closedAt ? `Closed ${formatRelative(conversation.closedAt)}` : "Resolved";
  }
  if (conversation.assignmentState === "unassigned") {
    return conversation.createdAt ? `Unowned since ${formatRelative(conversation.createdAt)}` : "Unassigned";
  }
  if (conversation.status === "waiting_on_customer") {
    return conversation.lastCustomerMessageAt ? `Waiting since ${formatRelative(conversation.lastCustomerMessageAt)}` : "Waiting on customer";
  }
  return conversation.createdAt ? `Opened ${formatRelative(conversation.createdAt)}` : "Open";
}

function deriveTimelineItemType(messageType: string): TimelineItemType {
  if (messageType === "internal_note") return "internal_note";
  if (messageType === "system") return "system";
  if (messageType === "teammate") return "teammate";
  return "customer";
}

function deriveComposerMode(messages: HelpMessage[]): ComposerMode {
  const latest = [...messages].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  return latest?.messageType === "internal_note" ? "note" : "reply";
}

function deriveSuggestedActions(row: ConversationRow): SuggestionItem[] {
  const items: SuggestionItem[] = [];
  if (!row.assignee) {
    items.push({ id: `${row.id}-assign`, label: "Assign an owner", detail: "Claim this conversation so it moves through triage with clear accountability." });
  }
  if (row.slaState !== "healthy") {
    items.push({ id: `${row.id}-sla`, label: "Protect SLA", detail: `Ticket is ${row.slaState.replaceAll("_", " ")} — adjust owner or respond before the due window closes.` });
  }
  if (row.priority === "urgent" || row.priority === "high") {
    items.push({ id: `${row.id}-priority`, label: "Confirm priority path", detail: "Use an internal note to record the handling plan before the next touch." });
  }
  if (row.tags.includes("renewal") || row.tags.includes("pricing")) {
    items.push({ id: `${row.id}-renewal`, label: "Loop in commercial owner", detail: "Keep renewal coordination visible to the account team." });
  }
  if (row.tags.includes("bug")) {
    items.push({ id: `${row.id}-bug`, label: "Capture reproduction details", detail: "Add an internal note with payloads, logs, or rollback context for engineering." });
  }
  return items.slice(0, 3);
}

function matchesInboxView(conversation: ConversationRow, viewKey: InboxViewKey, currentStaffName?: string | null): boolean {
  switch (viewKey) {
    case "assigned":
      return currentStaffName ? conversation.assignee === currentStaffName : conversation.assignmentState === "assigned";
    case "unassigned":
      return conversation.assignmentState === "unassigned";
    case "awaiting_reply":
      return conversation.status === "open" || conversation.status === "pending";
    case "sla_at_risk":
      return conversation.slaState === "at_risk" || conversation.slaState === "breached";
    case "closed_recently":
      return conversation.status === "resolved";
    case "support":
      return conversation.inboxLabel === "Support";
    case "escalations":
      return conversation.inboxLabel === "Escalations";
    case "billing":
      return conversation.inboxLabel === "Billing";
    case "vip":
      return conversation.inboxLabel === "VIP";
    case "high_priority":
      return conversation.priority === "high" || conversation.priority === "urgent";
    case "bugs":
      return conversation.tags.includes("bug");
    case "renewals":
      return conversation.tags.includes("renewal") || conversation.tags.includes("pricing");
    case "all":
    default:
      return true;
  }
}

async function loadHelpdeskContext(tenantId?: string | null, propertyId?: string | null, staffId?: string | null): Promise<HelpdeskContext | null> {
  const scope = await resolveHelpdeskScope(tenantId, propertyId, staffId);
  if (!scope) return null;

  const [staff, inboxes, customers, tags, conversations, tickets, messages, conversationTags] = await Promise.all([
    db.select().from(staffUsers).where(and(eq(staffUsers.tenantId, scope.tenantId), eq(staffUsers.isActive, true))).orderBy(asc(staffUsers.name)),
    db.select().from(helpInboxes).where(eq(helpInboxes.tenantId, scope.tenantId)).orderBy(asc(helpInboxes.name)),
    db.select().from(helpCustomers).where(eq(helpCustomers.tenantId, scope.tenantId)).orderBy(asc(helpCustomers.name)),
    db.select().from(helpTags).where(eq(helpTags.tenantId, scope.tenantId)).orderBy(asc(helpTags.name)),
    db.select().from(helpConversations).where(eq(helpConversations.tenantId, scope.tenantId)).orderBy(desc(helpConversations.lastMessageAt)),
    db.select().from(helpTickets).where(eq(helpTickets.tenantId, scope.tenantId)).orderBy(desc(helpTickets.updatedAt)),
    db.select().from(helpMessages).where(eq(helpMessages.tenantId, scope.tenantId)).orderBy(asc(helpMessages.createdAt)),
    db.select().from(helpConversationTags).where(eq(helpConversationTags.tenantId, scope.tenantId)),
  ]);

  return {
    scope,
    staff: withinScope(staff, scope.propertyId),
    inboxes: withinScope(inboxes, scope.propertyId),
    customers: withinScope(customers, scope.propertyId),
    tags: withinScope(tags, scope.propertyId),
    conversations: withinScope(conversations, scope.propertyId),
    tickets: withinScope(tickets, scope.propertyId),
    messages: withinScope(messages, scope.propertyId),
    conversationTags: withinScope(conversationTags, scope.propertyId),
  };
}

function buildAssigneeOptions(context: HelpdeskContext): HelpdeskAssigneeOption[] {
  return context.staff.map((member) => ({ id: member.id, name: member.name, role: member.role }));
}

function buildConversationRows(context: HelpdeskContext): ConversationRow[] {
  const inboxById = new Map(context.inboxes.map((inbox) => [inbox.id, inbox]));
  const customerById = new Map(context.customers.map((customer) => [customer.id, customer]));
  const ticketByConversationId = new Map(context.tickets.map((ticket) => [ticket.conversationId, ticket]));
  const staffById = new Map(context.staff.map((staffMember) => [staffMember.id, staffMember]));
  const tagById = new Map(context.tags.map((tag) => [tag.id, tag]));
  const tagsByConversationId = new Map<string, string[]>();

  for (const relation of context.conversationTags) {
    const tag = tagById.get(relation.tagId);
    if (!tag) continue;
    const existing = tagsByConversationId.get(relation.conversationId) ?? [];
    existing.push(tag.name);
    tagsByConversationId.set(relation.conversationId, existing);
  }

  return context.conversations.map((conversation) => {
    const inbox = conversation.inboxId ? inboxById.get(conversation.inboxId) : undefined;
    const customer = conversation.customerId ? customerById.get(conversation.customerId) : undefined;
    const ticket = ticketByConversationId.get(conversation.id);
    const assigneeStaff = (ticket?.assigneeStaffId ? staffById.get(ticket.assigneeStaffId) : undefined)
      ?? (conversation.assigneeStaffId ? staffById.get(conversation.assigneeStaffId) : undefined);
    const tags = [...new Set(tagsByConversationId.get(conversation.id) ?? [])].sort();
    const status = (ticket?.status ?? conversation.status) as ConversationStatus;
    const priority = (ticket?.priority ?? conversation.priority) as PriorityLevel;
    const slaState = deriveSlaState(conversation);
    const assignmentState: AssignmentState = assigneeStaff
      ? "assigned"
      : conversation.assignmentState === "team"
        ? "team"
        : "unassigned";

    return {
      id: conversation.id,
      subject: conversation.subject,
      requesterName: customer?.name ?? "Unknown customer",
      requesterEmail: customer?.email ?? "",
      company: customer?.company ?? "—",
      inboxLabel: inbox?.name ?? ticket?.team ?? "Support",
      preview: conversation.preview ?? "No preview available.",
      status,
      priority,
      unread: conversation.unreadCount > 0,
      assignmentState,
      assignee: assigneeStaff?.name ?? null,
      lastActivityLabel: formatRelative(conversation.lastMessageAt),
      waitingSinceLabel: deriveWaitingSinceLabel(conversation),
      messageCount: conversation.messageCount,
      slaState,
      tags,
      ticket: {
        id: ticket?.ticketNumber ?? `T-${conversation.id.slice(0, 8)}`,
        status,
        priority,
        assignee: assigneeStaff?.name ?? null,
        team: ticket?.team ?? inbox?.name ?? "Support",
        tags,
        slaState,
        nextMilestone: deriveNextMilestone(ticket, conversation),
      },
      customer: {
        id: customer?.externalId ?? customer?.id ?? `customer-${conversation.id}`,
        name: customer?.name ?? "Unknown customer",
        company: customer?.company ?? "—",
        tier: (customer?.tier as "standard" | "priority" | "strategic") ?? "standard",
        health: (customer?.health as "stable" | "watch" | "at_risk") ?? "stable",
        lastSeenLabel: customer?.lastSeenAt ? formatAbsolute(customer.lastSeenAt) : "Unknown",
      },
      propertyId: conversation.propertyId ?? null,
    };
  });
}

function sortConversationRows(rows: ConversationRow[]): ConversationRow[] {
  return [...rows].sort((a, b) => {
    const priorityDiff = priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority);
    if (priorityDiff !== 0) return priorityDiff;
    const statusDiff = statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status);
    if (statusDiff !== 0) return statusDiff;
    return a.lastActivityLabel.localeCompare(b.lastActivityLabel);
  });
}

export async function getHelpInboxNavigation(
  tenantId?: string | null,
  propertyId?: string | null,
  staffId?: string | null,
): Promise<InboxViewDefinition[]> {
  const context = await loadHelpdeskContext(tenantId, propertyId, staffId);
  if (!context) return [];
  const rows = buildConversationRows(context);
  const currentStaffName = context.staff.find((staff) => staff.id === context.scope.staffId)?.name ?? null;

  return inboxViewKeys.map((viewKey) => ({
    ...viewDefinitionsBase[viewKey],
    count: rows.filter((row) => matchesInboxView(row, viewKey, currentStaffName)).length,
  }));
}

export async function getHelpInboxConversations(
  viewKey: InboxViewKey = DEFAULT_INBOX_VIEW_KEY,
  tenantId?: string | null,
  propertyId?: string | null,
  staffId?: string | null,
  filterPropertyId?: string | null,
): Promise<ConversationRow[]> {
  const context = await loadHelpdeskContext(tenantId, propertyId, staffId);
  if (!context) return [];
  let rows = sortConversationRows(buildConversationRows(context));
  const currentStaffName = context.staff.find((staff) => staff.id === context.scope.staffId)?.name ?? null;
  rows = rows.filter((row) => matchesInboxView(row, viewKey, currentStaffName));
  if (filterPropertyId) {
    rows = rows.filter((row) => row.propertyId === filterPropertyId);
  }
  return rows;
}

export async function getHelpConversationDetail(
  conversationId: string,
  tenantId?: string | null,
  propertyId?: string | null,
  staffId?: string | null,
): Promise<ConversationDetail | null> {
  const context = await loadHelpdeskContext(tenantId, propertyId, staffId);
  if (!context) return null;

  const row = buildConversationRows(context).find((conversation) => conversation.id === conversationId);
  if (!row) return null;

  const timeline: ConversationTimelineItem[] = context.messages
    .filter((message) => message.conversationId === conversationId)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((message) => ({
      id: message.id,
      type: deriveTimelineItemType(message.messageType),
      author: message.authorLabel ?? context.staff.find((staff) => staff.id === message.authorStaffId)?.name ?? "Workflow",
      body: message.body,
      createdAtLabel: formatAbsolute(message.createdAt),
    }));

  return {
    conversationId: row.id,
    title: row.subject,
    summary: row.preview,
    composerMode: deriveComposerMode(context.messages.filter((message) => message.conversationId === conversationId)),
    ticket: row.ticket,
    customer: row.customer,
    suggestedActions: deriveSuggestedActions(row),
    timeline,
    availableAssignees: buildAssigneeOptions(context),
  };
}

export async function updateHelpConversationAssignee(
  conversationId: string,
  assigneeStaffId: string | null,
  tenantId?: string | null,
  propertyId?: string | null,
  actorStaffId?: string | null,
): Promise<ConversationDetail | null> {
  const context = await loadHelpdeskContext(tenantId, propertyId, actorStaffId);
  if (!context) return null;
  const conversation = context.conversations.find((item) => item.id === conversationId);
  if (!conversation) return null;

  await ensureTicketForConversation(conversation, context.tickets.find((ticket) => ticket.conversationId === conversationId));
  const assignmentState: AssignmentState = assigneeStaffId ? "assigned" : "unassigned";

  await db.update(helpConversations)
    .set({ assigneeStaffId, assignmentState, updatedAt: new Date() })
    .where(eq(helpConversations.id, conversationId));

  await db.update(helpTickets)
    .set({ assigneeStaffId, updatedAt: new Date() })
    .where(and(eq(helpTickets.tenantId, context.scope.tenantId), eq(helpTickets.conversationId, conversationId)));

  if (actorStaffId) {
    const actor = context.staff.find((staff) => staff.id === actorStaffId);
    const assignee = assigneeStaffId ? context.staff.find((staff) => staff.id === assigneeStaffId) : null;
    await db.insert(helpMessages).values({
      tenantId: context.scope.tenantId,
      propertyId: context.scope.propertyId,
      conversationId,
      authorStaffId: actorStaffId,
      messageType: "system",
      authorLabel: "Workflow",
      body: assignee ? `${actor?.name ?? "Operator"} assigned this conversation to ${assignee.name}.` : `${actor?.name ?? "Operator"} removed the assignee.`,
      metadataJson: {},
    });
  }

  return getHelpConversationDetail(conversationId, context.scope.tenantId, context.scope.propertyId, actorStaffId);
}

export async function updateHelpConversationStatus(
  conversationId: string,
  status: ConversationStatus,
  tenantId?: string | null,
  propertyId?: string | null,
  actorStaffId?: string | null,
): Promise<ConversationDetail | null> {
  const context = await loadHelpdeskContext(tenantId, propertyId, actorStaffId);
  if (!context) return null;
  const conversation = context.conversations.find((item) => item.id === conversationId);
  if (!conversation) return null;

  await ensureTicketForConversation(conversation, context.tickets.find((ticket) => ticket.conversationId === conversationId));
  const closedAt = status === "resolved" ? new Date() : null;

  await db.update(helpConversations)
    .set({ status, closedAt, updatedAt: new Date() })
    .where(eq(helpConversations.id, conversationId));

  await db.update(helpTickets)
    .set({ status, resolvedAt: status === "resolved" ? new Date() : null, updatedAt: new Date() })
    .where(and(eq(helpTickets.tenantId, context.scope.tenantId), eq(helpTickets.conversationId, conversationId)));

  if (actorStaffId) {
    const actor = context.staff.find((staff) => staff.id === actorStaffId);
    await db.insert(helpMessages).values({
      tenantId: context.scope.tenantId,
      propertyId: context.scope.propertyId,
      conversationId,
      authorStaffId: actorStaffId,
      messageType: "system",
      authorLabel: "Workflow",
      body: `${actor?.name ?? "Operator"} changed status to ${status.replaceAll("_", " ")}.`,
      metadataJson: {},
    });
  }

  return getHelpConversationDetail(conversationId, context.scope.tenantId, context.scope.propertyId, actorStaffId);
}

export async function updateHelpConversationPriority(
  conversationId: string,
  priority: PriorityLevel,
  tenantId?: string | null,
  propertyId?: string | null,
  actorStaffId?: string | null,
): Promise<ConversationDetail | null> {
  const context = await loadHelpdeskContext(tenantId, propertyId, actorStaffId);
  if (!context) return null;
  const conversation = context.conversations.find((item) => item.id === conversationId);
  if (!conversation) return null;

  await ensureTicketForConversation(conversation, context.tickets.find((ticket) => ticket.conversationId === conversationId));

  await db.update(helpConversations)
    .set({ priority, updatedAt: new Date() })
    .where(eq(helpConversations.id, conversationId));

  await db.update(helpTickets)
    .set({ priority, updatedAt: new Date() })
    .where(and(eq(helpTickets.tenantId, context.scope.tenantId), eq(helpTickets.conversationId, conversationId)));

  if (actorStaffId) {
    const actor = context.staff.find((staff) => staff.id === actorStaffId);
    await db.insert(helpMessages).values({
      tenantId: context.scope.tenantId,
      propertyId: context.scope.propertyId,
      conversationId,
      authorStaffId: actorStaffId,
      messageType: "system",
      authorLabel: "Workflow",
      body: `${actor?.name ?? "Operator"} changed priority to ${priority}.`,
      metadataJson: {},
    });
  }

  return getHelpConversationDetail(conversationId, context.scope.tenantId, context.scope.propertyId, actorStaffId);
}

export async function addHelpConversationInternalNote(
  conversationId: string,
  body: string,
  tenantId?: string | null,
  propertyId?: string | null,
  actorStaffId?: string | null,
): Promise<ConversationDetail | null> {
  const context = await loadHelpdeskContext(tenantId, propertyId, actorStaffId);
  if (!context) return null;
  const conversation = context.conversations.find((item) => item.id === conversationId);
  if (!conversation) return null;

  await ensureTicketForConversation(conversation, context.tickets.find((ticket) => ticket.conversationId === conversationId));
  const trimmed = body.trim();
  if (!trimmed) return getHelpConversationDetail(conversationId, context.scope.tenantId, context.scope.propertyId, actorStaffId);

  const actor = context.staff.find((staff) => staff.id === actorStaffId);
  await db.insert(helpMessages).values({
    tenantId: context.scope.tenantId,
    propertyId: context.scope.propertyId,
    conversationId,
    authorStaffId: actorStaffId ?? null,
    messageType: "internal_note",
    authorLabel: actor?.name ?? "Operator",
    body: trimmed,
    metadataJson: {},
  });

  await db.update(helpConversations)
    .set({ preview: trimmed.slice(0, 200), lastMessageAt: new Date(), messageCount: conversation.messageCount + 1, updatedAt: new Date() })
    .where(eq(helpConversations.id, conversationId));

  await db.update(helpTickets)
    .set({ updatedAt: new Date() })
    .where(and(eq(helpTickets.tenantId, context.scope.tenantId), eq(helpTickets.conversationId, conversationId)));

  return getHelpConversationDetail(conversationId, context.scope.tenantId, context.scope.propertyId, actorStaffId);
}

async function ensureTicketForConversation(conversation: HelpConversation, existingTicket?: HelpTicket): Promise<HelpTicket> {
  if (existingTicket) return existingTicket;
  const [created] = await db.insert(helpTickets).values({
    tenantId: conversation.tenantId,
    propertyId: conversation.propertyId,
    conversationId: conversation.id,
    ticketNumber: `T-${String(Date.now()).slice(-6)}`,
    status: conversation.status,
    priority: conversation.priority,
    team: "Support",
    assigneeStaffId: conversation.assigneeStaffId,
    nextMilestone: deriveNextMilestone(undefined, conversation),
  }).returning();
  return created!;
}

export interface PropertySummaryItem {
  id: string;
  code: string;
  name: string;
  location: string | null;
  unitCount: number;
  openTicketCount: number;
}

function derivePropertyCode(slug: string, name: string, index: number): string {
  const source = (slug || name).replace(/[^a-zA-Z]/g, "").toUpperCase();
  const prefix = source.slice(0, 3).padEnd(3, "X");
  const suffix = String(index + 1).padStart(2, "0");
  return `${prefix}-${suffix}`;
}

export async function getPropertiesSummary(tenantId?: string | null): Promise<PropertySummaryItem[]> {
  if (!tenantId) {
    const [tenant] = await db.select().from(tenants).orderBy(asc(tenants.createdAt)).limit(1);
    if (!tenant) return [];
    tenantId = tenant.id;
  }

  const allProperties = await db.select().from(properties).where(eq(properties.tenantId, tenantId)).orderBy(asc(properties.name));
  if (allProperties.length === 0) return [];

  const allConversations = await db.select({
    id: helpConversations.id,
    propertyId: helpConversations.propertyId,
    status: helpConversations.status,
  }).from(helpConversations).where(eq(helpConversations.tenantId, tenantId));

  const openByProperty = new Map<string, number>();
  for (const conv of allConversations) {
    if (conv.status === "resolved") continue;
    if (!conv.propertyId) continue;
    openByProperty.set(conv.propertyId, (openByProperty.get(conv.propertyId) ?? 0) + 1);
  }

  return allProperties.map((property, index) => ({
    id: property.id,
    code: derivePropertyCode(property.slug, property.name, index),
    name: property.name,
    location: property.location ?? null,
    unitCount: property.name.toLowerCase().includes("flex") ? 15 : 1,
    openTicketCount: openByProperty.get(property.id) ?? 0,
  }));
}

export async function getHelpdeskDashboardMetrics(
  tenantId?: string | null,
  propertyId?: string | null,
  staffId?: string | null,
): Promise<HelpdeskDashboardMetrics> {
  const context = await loadHelpdeskContext(tenantId, propertyId, staffId);
  if (!context) {
    return {
      summary: { openConversations: 0, unassigned: 0, slaAtRisk: 0, slaBreached: 0, resolvedToday: 0, waitingOnCustomer: 0 },
      afterHoursHandled: 0,
      channels: [],
      byStatus: statusOrder.map((status) => ({ status, count: 0 })),
      byInbox: [],
      recentActivity: [],
      openTickets: [],
    };
  }

  const rows = sortConversationRows(buildConversationRows(context));
  const openRows = rows.filter((row) => row.status !== "resolved");
  const byStatus = statusOrder.map((status) => ({ status, count: rows.filter((row) => row.status === status).length }));

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const isAfterHours = (d: Date) => {
    const h = d.getHours();
    return h >= 18 || h < 6;
  };

  const resolvedToday = context.conversations.filter(
    (c) => c.closedAt && c.closedAt >= todayStart,
  ).length;

  const afterHoursHandled = context.conversations.filter(
    (c) => c.createdAt >= last24h && isAfterHours(c.createdAt),
  ).length;

  const slaBreached = openRows.filter((row) => row.slaState === "breached").length;

  const channels = buildChannelMetrics(context.conversations, now);

  const inboxMap = new Map<string, HelpdeskInboxMetric>();
  for (const row of rows) {
    const existing = inboxMap.get(row.inboxLabel) ?? { inboxLabel: row.inboxLabel, count: 0, unassignedCount: 0, atRiskCount: 0 };
    existing.count += 1;
    if (!row.assignee) existing.unassignedCount += 1;
    if (row.slaState === "at_risk" || row.slaState === "breached") existing.atRiskCount += 1;
    inboxMap.set(row.inboxLabel, existing);
  }

  const recentActivity: HelpdeskRecentActivityItem[] = [...context.messages]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 8)
    .map((message) => {
      const row = rows.find((conversation) => conversation.id === message.conversationId);
      return {
        id: message.id,
        type: deriveTimelineItemType(message.messageType),
        conversationId: message.conversationId,
        title: row?.subject ?? "Conversation update",
        author: message.authorLabel ?? context.staff.find((staff) => staff.id === message.authorStaffId)?.name ?? "Workflow",
        createdAtLabel: formatRelative(message.createdAt),
      };
    });

  return {
    summary: {
      openConversations: openRows.length,
      unassigned: openRows.filter((row) => !row.assignee).length,
      slaAtRisk: openRows.filter((row) => row.slaState === "at_risk" || row.slaState === "breached").length,
      slaBreached,
      resolvedToday,
      waitingOnCustomer: openRows.filter((row) => row.status === "waiting_on_customer").length,
    },
    afterHoursHandled,
    channels,
    byStatus,
    byInbox: [...inboxMap.values()].sort((a, b) => b.count - a.count),
    recentActivity,
    openTickets: openRows.slice(0, 6),
  };
}

const CHANNEL_LABELS: Record<string, string> = {
  email: "Email",
  whatsapp: "WhatsApp",
  sms: "SMS",
  zoom: "Zoom",
  slack: "Slack",
  messenger: "Messenger",
  web: "Web",
  phone: "Phone",
};

const CHANNEL_ORDER = ["email", "whatsapp", "sms", "zoom", "slack", "messenger"];

function buildChannelMetrics(conversations: HelpConversation[], now: Date): import("../shared/helpdesk").ChannelMetric[] {
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const seen = new Set<string>();
  const buckets = new Map<string, number[]>();
  const counts = new Map<string, number>();

  for (const conversation of conversations) {
    const channel = (conversation.channel || "email").toLowerCase();
    seen.add(channel);
    if (conversation.lastMessageAt < last24h) continue;
    const hoursAgo = Math.min(23, Math.floor((now.getTime() - conversation.lastMessageAt.getTime()) / (60 * 60 * 1000)));
    const bucketIndex = 23 - hoursAgo;
    const arr = buckets.get(channel) ?? new Array(24).fill(0);
    arr[bucketIndex] = (arr[bucketIndex] ?? 0) + 1;
    buckets.set(channel, arr);
    counts.set(channel, (counts.get(channel) ?? 0) + 1);
  }

  const known = CHANNEL_ORDER.filter((c) => seen.has(c));
  const extras = [...seen].filter((c) => !CHANNEL_ORDER.includes(c));
  const offlineDefaults = CHANNEL_ORDER.filter((c) => !seen.has(c));

  const live = [...known, ...extras].map((channel) => ({
    channel,
    label: CHANNEL_LABELS[channel] ?? channel.charAt(0).toUpperCase() + channel.slice(1),
    status: "live" as const,
    count24h: counts.get(channel) ?? 0,
    hourlyBuckets: buckets.get(channel) ?? new Array(24).fill(0),
  }));

  const offline = offlineDefaults.slice(0, 2).map((channel) => ({
    channel,
    label: CHANNEL_LABELS[channel] ?? channel,
    status: "offline" as const,
    count24h: 0,
    hourlyBuckets: new Array(24).fill(0),
  }));

  return [...live, ...offline];
}
