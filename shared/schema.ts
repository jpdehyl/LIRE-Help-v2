import {
  pgTable, text, integer, boolean, timestamp, varchar, json, jsonb, doublePrecision, index, uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─── Tenants ─────────────────────────────────────────────────────────────────

// Concierge configuration stored per tenant. Migrated to a JSONB column on
// tenants rather than a dedicated table because the shape evolves during
// dogfooding and we want additive rollouts without constant migrations.
export type ConciergeRunState = "live" | "shadow" | "paused";

export interface ConciergeSettings {
  // live: the agent auto-replies per confidence. shadow: the agent runs
  // but every send_reply is downgraded to a draft for human review — no
  // outbound traffic. paused: the orchestrator skips dispatch entirely,
  // leaving inbound messages in the inbox for a human.
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
  // Future: audiences, escalation rules. Add fields additively — deserialize
  // is lenient so old rows keep working.
}

export const DEFAULT_CONCIERGE_SETTINGS: ConciergeSettings = {
  runState: "live",
  autonomyCeilingPct: 80,
  channels: { email: true, whatsapp: true, sms: true, zoom: false, slack: false, messenger: false },
};

export const tenants = pgTable("tenants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  plan: text("plan").notNull().default("starter"),
  billingEmail: text("billing_email"),
  phone: text("phone"),
  country: text("country").default("US"),
  timezone: text("timezone").default("America/Los_Angeles"),
  isActive: boolean("is_active").default(true).notNull(),
  trialEndsAt: timestamp("trial_ends_at"),
  conciergeSettingsJson: jsonb("concierge_settings_json").$type<Partial<ConciergeSettings>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertTenantSchema = createInsertSchema(tenants).omit({ id: true, createdAt: true, updatedAt: true });
export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = z.infer<typeof insertTenantSchema>;

// ─── Properties ──────────────────────────────────────────────────────────────

export const properties = pgTable("properties", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  location: text("location"),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  tenantId: varchar("tenant_id").references(() => tenants.id),
  agentName: text("agent_name"),
  agentEmoji: text("agent_emoji"),
  agentTagline: text("agent_tagline"),
  agentGreeting: text("agent_greeting"),
  agentPersonality: text("agent_personality"),
  brandingJson: jsonb("branding_json").$type<{
    primaryColor?: string;
    secondaryColor?: string;
    fontFamily?: string;
    darkMode?: boolean;
    logoUrl?: string | null;
    faviconUrl?: string | null;
  }>().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// B14: branding JSON is rendered into inline CSS/HTML attributes on tenant login
// pages, so clamp every field shape before persisting. primaryColor/secondaryColor
// must be strict 6-digit hex; URLs validated; fontFamily bounded; unknown keys rejected.
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const urlOrNull = z.string().url().refine((u) => {
  try {
    const parsed = new URL(u);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}, { message: "Only http(s) URLs are allowed" }).nullable();
const brandingJsonSchema = z.object({
  primaryColor: hexColor.optional(),
  secondaryColor: hexColor.optional(),
  fontFamily: z.string().max(64).optional(),
  darkMode: z.boolean().optional(),
  logoUrl: urlOrNull.optional(),
  faviconUrl: urlOrNull.optional(),
}).strict();

export const insertPropertySchema = createInsertSchema(properties, {
  brandingJson: brandingJsonSchema.optional(),
}).omit({ id: true, createdAt: true, updatedAt: true });
export type Property = typeof properties.$inferSelect;
export type InsertProperty = z.infer<typeof insertPropertySchema>;

// ─── Agents ──────────────────────────────────────────────────────────────────

export const agents = pgTable("agents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  propertyId: varchar("property_id").references(() => properties.id).notNull().unique(),
  tenantId: varchar("tenant_id").references(() => tenants.id),
  name: text("name").notNull().default("LIRE Agent"),
  emoji: text("emoji").notNull().default("LH"),
  tagline: text("tagline"),
  greeting: text("greeting"),
  personality: text("personality"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertAgentSchema = createInsertSchema(agents).omit({ id: true, createdAt: true, updatedAt: true });
export type Agent = typeof agents.$inferSelect;
export type InsertAgent = z.infer<typeof insertAgentSchema>;

// ─── Staff Users ─────────────────────────────────────────────────────────────

export const staffUsers = pgTable("staff_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("readonly"),
  tenantId: varchar("tenant_id").references(() => tenants.id),
  propertyId: varchar("property_id").references(() => properties.id),
  isActive: boolean("is_active").default(true).notNull(),
  whatsappNumber: text("whatsapp_number"),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type StaffUser = typeof staffUsers.$inferSelect;

export const STAFF_ROLES = ["superadmin", "owner", "manager", "staff", "readonly", "compliance"] as const;
export type StaffRole = typeof STAFF_ROLES[number];
export const SUBORDINATE_ROLES = ["manager", "staff", "readonly"] as const satisfies readonly StaffRole[];

// ─── Staff Identities (SSO providers) ────────────────────────────────────────
//
// One row per linked OIDC identity. A single staff user can be linked to
// multiple providers (Google + Azure). The unique index on
// (provider, provider_sub) is what binds an incoming id_token to a local user.

export const staffIdentities = pgTable("staff_identities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  staffUserId: varchar("staff_user_id").references(() => staffUsers.id, { onDelete: "cascade" }).notNull(),
  provider: text("provider").notNull(),
  providerSub: text("provider_sub").notNull(),
  email: text("email").notNull(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  providerSubUq: uniqueIndex("staff_identities_provider_sub_uq").on(table.provider, table.providerSub),
}));

export type StaffIdentity = typeof staffIdentities.$inferSelect;

// ─── Platform Knowledge Base ─────────────────────────────────────────────────

export const platformKnowledge = pgTable("platform_knowledge", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  section: text("section").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type PlatformKnowledgeEntry = typeof platformKnowledge.$inferSelect;

// ─── KB Documents ────────────────────────────────────────────────────────────
// Uploaded files (leases, drawings, policy PDFs) that supplement
// platformKnowledge. Phase 1 stores bytes on a Railway volume and extracted
// plaintext in extractedText; Phase 2 will add chunked embeddings for
// retrieval via lookup_knowledge. propertyId nullable so a file can apply
// operator-wide (e.g. standard lease template) or to one building.

export const kbDocumentKinds = [
  "lease",
  "drawing",
  "policy",
  "sow",
  "other",
] as const;
export type KbDocumentKind = (typeof kbDocumentKinds)[number];

export const kbDocumentExtractStatuses = ["pending", "done", "failed"] as const;
export type KbDocumentExtractStatus = (typeof kbDocumentExtractStatuses)[number];

export const kbDocuments = pgTable("kb_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  propertyId: varchar("property_id"),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  storagePath: text("storage_path").notNull(),
  extractStatus: text("extract_status").default("pending").notNull(),
  extractError: text("extract_error"),
  extractedText: text("extracted_text"),
  uploadedByStaffId: varchar("uploaded_by_staff_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type KbDocument = typeof kbDocuments.$inferSelect;

// ─── Platform Sessions ───────────────────────────────────────────────────────

export const platformSessions = pgTable("platform_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: text("session_id").notNull().unique(),
  messages: jsonb("messages").$type<{ role: string; content: string }[]>().default([]),
  messageCount: integer("message_count").default(0).notNull(),
  escalatedToWa: boolean("escalated_to_wa").default(false).notNull(),
  isAnalyzed: boolean("is_analyzed").default(false).notNull(),
  summary: text("summary"),
  tipoConsulta: text("tipo_consulta"),
  intencion: text("intencion"),
  tags: jsonb("tags").$type<string[]>().default([]),
  isLead: boolean("is_lead").default(false).notNull(),
  propertyType: text("property_type"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastMessageAt: timestamp("last_message_at").defaultNow().notNull(),
});

export type PlatformSession = typeof platformSessions.$inferSelect;

// ─── Helpdesk Domain Scaffolding (additive) ─────────────────────────────────

export const helpInboxes = pgTable("help_inboxes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  propertyId: varchar("property_id").references(() => properties.id),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  channel: text("channel").notNull().default("email"),
  isDefault: boolean("is_default").default(false).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const helpCustomers = pgTable("help_customers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  propertyId: varchar("property_id").references(() => properties.id),
  externalId: text("external_id"),
  name: text("name").notNull(),
  email: text("email"),
  company: text("company"),
  tier: text("tier").notNull().default("standard"),
  health: text("health").notNull().default("stable"),
  lastSeenAt: timestamp("last_seen_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const helpSlas = pgTable("help_slas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  propertyId: varchar("property_id").references(() => properties.id),
  inboxId: varchar("inbox_id").references(() => helpInboxes.id),
  name: text("name").notNull(),
  description: text("description"),
  firstResponseMinutes: integer("first_response_minutes"),
  nextResponseMinutes: integer("next_response_minutes"),
  resolutionMinutes: integer("resolution_minutes"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const helpTags = pgTable("help_tags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  propertyId: varchar("property_id").references(() => properties.id),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  color: text("color"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  tenantPropertySlugUq: uniqueIndex("help_tags_tenant_property_slug_uq").on(table.tenantId, table.propertyId, table.slug),
}));

export const helpConversations = pgTable("help_conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  propertyId: varchar("property_id").references(() => properties.id),
  inboxId: varchar("inbox_id").references(() => helpInboxes.id),
  customerId: varchar("customer_id").references(() => helpCustomers.id),
  externalThreadId: text("external_thread_id"),
  subject: text("subject").notNull(),
  status: text("status").notNull().default("open"),
  priority: text("priority").notNull().default("medium"),
  assignmentState: text("assignment_state").notNull().default("unassigned"),
  assigneeStaffId: varchar("assignee_staff_id").references(() => staffUsers.id),
  visibilityStatus: text("visibility_status").notNull().default("active"),
  previousVisibilityStatus: text("previous_visibility_status"),
  visibilityChangedAt: timestamp("visibility_changed_at"),
  visibilityChangedByStaffId: varchar("visibility_changed_by_staff_id").references(() => staffUsers.id),
  deletedAt: timestamp("deleted_at"),
  deletedByStaffId: varchar("deleted_by_staff_id").references(() => staffUsers.id),
  deleteReason: text("delete_reason"),
  channel: text("channel").notNull().default("email"),
  preview: text("preview"),
  unreadCount: integer("unread_count").default(0).notNull(),
  messageCount: integer("message_count").default(0).notNull(),
  firstResponseDueAt: timestamp("first_response_due_at"),
  nextResponseDueAt: timestamp("next_response_due_at"),
  resolutionDueAt: timestamp("resolution_due_at"),
  lastCustomerMessageAt: timestamp("last_customer_message_at"),
  lastMessageAt: timestamp("last_message_at").defaultNow().notNull(),
  snoozedUntil: timestamp("snoozed_until"),
  snoozedByStaffId: varchar("snoozed_by_staff_id").references(() => staffUsers.id),
  closedAt: timestamp("closed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const helpTickets = pgTable("help_tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  propertyId: varchar("property_id").references(() => properties.id),
  conversationId: varchar("conversation_id").references(() => helpConversations.id).notNull(),
  slaId: varchar("sla_id").references(() => helpSlas.id),
  ticketNumber: text("ticket_number").notNull(),
  status: text("status").notNull().default("open"),
  priority: text("priority").notNull().default("medium"),
  team: text("team"),
  assigneeStaffId: varchar("assignee_staff_id").references(() => staffUsers.id),
  nextMilestone: text("next_milestone"),
  firstResponseAt: timestamp("first_response_at"),
  // Latency in milliseconds between conversation open (or latest customer
  // message) and the first reply. Populated when the concierge agent or a
  // human sends a reply; used to compute dashboard "avg response".
  responseLatencyMs: integer("response_latency_ms"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const helpMessages = pgTable("help_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  propertyId: varchar("property_id").references(() => properties.id),
  conversationId: varchar("conversation_id").references(() => helpConversations.id).notNull(),
  authorStaffId: varchar("author_staff_id").references(() => staffUsers.id),
  externalMessageId: text("external_message_id"),
  messageType: text("message_type").notNull().default("customer"),
  // "human" | "ai" | "system" — lets the dashboard compute % autonomous
  // without brittle string-matching on authorLabel.
  messageSource: text("message_source").notNull().default("human"),
  authorLabel: text("author_label"),
  body: text("body").notNull(),
  metadataJson: jsonb("metadata_json").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const helpConversationTags = pgTable("help_conversation_tags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  propertyId: varchar("property_id").references(() => properties.id),
  conversationId: varchar("conversation_id").references(() => helpConversations.id).notNull(),
  tagId: varchar("tag_id").references(() => helpTags.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  conversationTagUq: uniqueIndex("help_conversation_tags_conversation_tag_uq").on(table.conversationId, table.tagId),
}));

export type HelpInbox = typeof helpInboxes.$inferSelect;
export type HelpCustomer = typeof helpCustomers.$inferSelect;
export type HelpSla = typeof helpSlas.$inferSelect;
export type HelpTag = typeof helpTags.$inferSelect;
export type HelpConversation = typeof helpConversations.$inferSelect;
export type HelpTicket = typeof helpTickets.$inferSelect;
export type HelpMessage = typeof helpMessages.$inferSelect;
export type HelpConversationTag = typeof helpConversationTags.$inferSelect;

// ─── Channel OAuth tokens ───────────────────────────────────────────────
//
// For channels whose API requires user-OAuth (notably Zoom Team Chat —
// Server-to-Server apps don't expose the chat-write scopes), we persist
// the resulting access + refresh tokens here and refresh on demand.
// One row per (tenant, provider); the unique index enforces that.

export const channelOauthTokens = pgTable("channel_oauth_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  provider: text("provider").notNull(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  expiresAt: timestamp("expires_at"),
  scope: text("scope"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  tenantProviderUq: uniqueIndex("channel_oauth_tokens_tenant_provider_uq").on(table.tenantId, table.provider),
}));

export type ChannelOauthToken = typeof channelOauthTokens.$inferSelect;

// ─── Leasing Pilot (Pilot A) ────────────────────────────────────────────────
//
// Units, deals, tours, unit sheets — the VTS-lite leasing workspace layered on
// top of Yardi as system of record. Every entity is tenant-scoped.

export const units = pgTable("units", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  propertyId: varchar("property_id").references(() => properties.id).notNull(),
  yardiUnitId: text("yardi_unit_id"),
  label: text("label").notNull(),
  sqFt: integer("sq_ft"),
  clearHeightFt: doublePrecision("clear_height_ft"),
  dockDoors: integer("dock_doors"),
  power: text("power"),
  availability: text("availability").notNull().default("occupied"),
  askingRateUsd: text("asking_rate_usd"),
  floorPlanUrl: text("floor_plan_url"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const deals = pgTable("deals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  propertyId: varchar("property_id").references(() => properties.id),
  unitId: varchar("unit_id").references(() => units.id),
  prospectCompany: text("prospect_company").notNull(),
  prospectContactName: text("prospect_contact_name"),
  prospectContactEmail: text("prospect_contact_email"),
  prospectContactPhone: text("prospect_contact_phone"),
  brokerStaffId: varchar("broker_staff_id").references(() => staffUsers.id),
  stage: text("stage").notNull().default("prospect"),
  sizeNeededSqFt: integer("size_needed_sq_ft"),
  targetMoveInAt: timestamp("target_move_in_at"),
  expectedRentUsd: text("expected_rent_usd"),
  stageEnteredAt: timestamp("stage_entered_at").defaultNow().notNull(),
  lastActivityAt: timestamp("last_activity_at").defaultNow().notNull(),
  lostReason: text("lost_reason"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const dealEvents = pgTable("deal_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  dealId: varchar("deal_id").references(() => deals.id).notNull(),
  authorStaffId: varchar("author_staff_id").references(() => staffUsers.id),
  eventType: text("event_type").notNull(),
  summary: text("summary").notNull(),
  metadataJson: jsonb("metadata_json").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tours = pgTable("tours", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  dealId: varchar("deal_id").references(() => deals.id).notNull(),
  unitId: varchar("unit_id").references(() => units.id),
  scheduledAt: timestamp("scheduled_at"),
  completedAt: timestamp("completed_at"),
  brokerStaffId: varchar("broker_staff_id").references(() => staffUsers.id),
  brokerNotesRaw: text("broker_notes_raw"),
  aiRecap: text("ai_recap"),
  aiRecapModel: text("ai_recap_model"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const unitSheets = pgTable("unit_sheets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  unitId: varchar("unit_id").references(() => units.id).notNull(),
  generatedByStaffId: varchar("generated_by_staff_id").references(() => staffUsers.id),
  shareToken: text("share_token").notNull().unique(),
  pdfUrl: text("pdf_url"),
  snapshotJson: jsonb("snapshot_json").default({}),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUnitSchema = createInsertSchema(units).omit({ id: true, createdAt: true, updatedAt: true });
export const insertDealSchema = createInsertSchema(deals).omit({ id: true, createdAt: true, updatedAt: true, stageEnteredAt: true, lastActivityAt: true });
export const insertDealEventSchema = createInsertSchema(dealEvents).omit({ id: true, createdAt: true });
export const insertTourSchema = createInsertSchema(tours).omit({ id: true, createdAt: true, updatedAt: true });
export const insertUnitSheetSchema = createInsertSchema(unitSheets).omit({ id: true, createdAt: true });

export type Unit = typeof units.$inferSelect;
export type Deal = typeof deals.$inferSelect;
export type DealEvent = typeof dealEvents.$inferSelect;
export type Tour = typeof tours.$inferSelect;
export type UnitSheet = typeof unitSheets.$inferSelect;
export type InsertUnit = z.infer<typeof insertUnitSchema>;
export type InsertDeal = z.infer<typeof insertDealSchema>;
export type InsertDealEvent = z.infer<typeof insertDealEventSchema>;
export type InsertTour = z.infer<typeof insertTourSchema>;
export type InsertUnitSheet = z.infer<typeof insertUnitSheetSchema>;

// ─── Credit Review Pilot (Pilot B) ──────────────────────────────────────────
//
// Lessees, financial documents, extractions, checklist runs, memos, approvals,
// and the SEC-archivable log. Every entity is tenant-scoped. Extractions carry
// citations back to their source document.

export const lessees = pgTable("lessees", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  yardiTenantId: text("yardi_tenant_id"),
  legalName: text("legal_name").notNull(),
  dba: text("dba"),
  primaryPropertyId: varchar("primary_property_id").references(() => properties.id),
  primaryUnitId: varchar("primary_unit_id").references(() => units.id),
  riskTier: text("risk_tier").notNull().default("green"),
  watchlist: boolean("watchlist").default(false).notNull(),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  metadataJson: jsonb("metadata_json").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const creditDocuments = pgTable("credit_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  lesseeId: varchar("lessee_id").references(() => lessees.id).notNull(),
  uploadedByStaffId: varchar("uploaded_by_staff_id").references(() => staffUsers.id),
  blobUrl: text("blob_url").notNull(),
  sha256: text("sha256").notNull(),
  mimeType: text("mime_type"),
  pageCount: integer("page_count"),
  classification: text("classification"),
  classificationConfidence: doublePrecision("classification_confidence"),
  periodStart: timestamp("period_start"),
  periodEnd: timestamp("period_end"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const creditExtractions = pgTable("credit_extractions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  documentId: varchar("document_id").references(() => creditDocuments.id).notNull(),
  lineItem: text("line_item").notNull(),
  value: text("value"),
  unit: text("unit"),
  page: integer("page"),
  bboxJson: jsonb("bbox_json").$type<{ x: number; y: number; w: number; h: number } | null>(),
  rawText: text("raw_text"),
  confidence: doublePrecision("confidence"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const creditChecklistRuns = pgTable("credit_checklist_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  lesseeId: varchar("lessee_id").references(() => lessees.id).notNull(),
  rubricVersion: text("rubric_version").notNull(),
  status: text("status").notNull().default("in_progress"),
  resultsJson: jsonb("results_json").default({}),
  redFlagCount: integer("red_flag_count").default(0).notNull(),
  yellowFlagCount: integer("yellow_flag_count").default(0).notNull(),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const creditMemos = pgTable("credit_memos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  lesseeId: varchar("lessee_id").references(() => lessees.id).notNull(),
  checklistRunId: varchar("checklist_run_id").references(() => creditChecklistRuns.id),
  templateVersion: text("template_version").notNull(),
  draftMarkdown: text("draft_markdown").notNull(),
  finalMarkdown: text("final_markdown"),
  analystEditsJson: jsonb("analyst_edits_json").default([]),
  aiModel: text("ai_model"),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const creditApprovals = pgTable("credit_approvals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  memoId: varchar("memo_id").references(() => creditMemos.id).notNull(),
  analystStaffId: varchar("analyst_staff_id").references(() => staffUsers.id).notNull(),
  decision: text("decision").notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const archiveLog = pgTable("archive_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  subjectType: text("subject_type").notNull(),
  subjectId: text("subject_id").notNull(),
  actorStaffId: varchar("actor_staff_id").references(() => staffUsers.id),
  eventType: text("event_type").notNull(),
  payloadJson: jsonb("payload_json").default({}),
  payloadSha256: text("payload_sha256").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertLesseeSchema = createInsertSchema(lessees).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCreditDocumentSchema = createInsertSchema(creditDocuments).omit({ id: true, createdAt: true });
export const insertCreditExtractionSchema = createInsertSchema(creditExtractions).omit({ id: true, createdAt: true });
export const insertCreditChecklistRunSchema = createInsertSchema(creditChecklistRuns).omit({ id: true, startedAt: true });
export const insertCreditMemoSchema = createInsertSchema(creditMemos).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCreditApprovalSchema = createInsertSchema(creditApprovals).omit({ id: true, createdAt: true });
export const insertArchiveLogSchema = createInsertSchema(archiveLog).omit({ id: true, createdAt: true });

export type Lessee = typeof lessees.$inferSelect;
export type CreditDocument = typeof creditDocuments.$inferSelect;
export type CreditExtraction = typeof creditExtractions.$inferSelect;
export type CreditChecklistRun = typeof creditChecklistRuns.$inferSelect;
export type CreditMemo = typeof creditMemos.$inferSelect;
export type CreditApproval = typeof creditApprovals.$inferSelect;
export type ArchiveLogEntry = typeof archiveLog.$inferSelect;
export type InsertLessee = z.infer<typeof insertLesseeSchema>;
export type InsertCreditDocument = z.infer<typeof insertCreditDocumentSchema>;
export type InsertCreditExtraction = z.infer<typeof insertCreditExtractionSchema>;
export type InsertCreditChecklistRun = z.infer<typeof insertCreditChecklistRunSchema>;
export type InsertCreditMemo = z.infer<typeof insertCreditMemoSchema>;
export type InsertCreditApproval = z.infer<typeof insertCreditApprovalSchema>;
export type InsertArchiveLogEntry = z.infer<typeof insertArchiveLogSchema>;

// ─── Token Usage ────────────────────────────────────────────────────────────

export const tokenUsage = pgTable("token_usage", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id),
  propertyId: varchar("property_id").references(() => properties.id),
  sessionId: text("session_id"),
  operation: text("operation").notNull(),
  model: text("model").notNull(),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  costUsd: text("cost_usd").notNull().default("0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type TokenUsage = typeof tokenUsage.$inferSelect;
export type InsertTokenUsage = typeof tokenUsage.$inferInsert;

// ─── Staff Sessions ─────────────────────────────────────────────────────────
//
// Session store for express-session + connect-pg-simple. The table is also
// created at runtime in server/app-factory.ts so the app can boot against a
// fresh DB without a migration. It is declared here so `drizzle-kit push`
// recognizes it and leaves it alone — without this row, push sees drift and
// tries to drop the live table.

export const staffSessions = pgTable("staff_sessions", {
  sid: varchar("sid").primaryKey(),
  sess: json("sess").notNull(),
  expire: timestamp("expire", { precision: 6 }).notNull(),
}, (table) => ({
  expireIdx: index("idx_staff_sessions_expire").on(table.expire),
}));

// ─── Channel Configs ────────────────────────────────────────────────────────
//
// Per-tenant configuration for each communication channel (email, phone,
// whatsapp, switch, slack, messenger). One row per (tenant, channelType).
// Provider-specific fields live in configJson so each channel can evolve its
// schema independently without migrations. Secrets (API keys, tokens) are
// stored encrypted at rest by the application layer before being persisted —
// the column itself just holds opaque JSON.

export const CHANNEL_TYPES = ["email", "phone", "whatsapp", "switch", "slack", "messenger"] as const;
export type ChannelType = typeof CHANNEL_TYPES[number];

export interface EmailChannelConfig {
  provider: "sendgrid" | "smtp" | "ses" | "none";
  fromAddress: string | null;
  fromName: string | null;
  replyToAddress: string | null;
  forwardingAddress: string | null;
  signatureHtml: string | null;
}

export const channelConfigs = pgTable("channel_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  channelType: text("channel_type").notNull(),
  enabled: boolean("enabled").notNull().default(false),
  configJson: jsonb("config_json").$type<Record<string, unknown>>().notNull().default({}),
  updatedByStaffId: varchar("updated_by_staff_id").references(() => staffUsers.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  tenantChannelUq: uniqueIndex("channel_configs_tenant_channel_uq").on(table.tenantId, table.channelType),
}));

export type ChannelConfig = typeof channelConfigs.$inferSelect;
export type InsertChannelConfig = typeof channelConfigs.$inferInsert;
