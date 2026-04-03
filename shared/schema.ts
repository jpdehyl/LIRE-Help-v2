import {
  pgTable, text, integer, boolean, timestamp, varchar, jsonb, doublePrecision,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─── Tenants ─────────────────────────────────────────────────────────────────

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

export const insertPropertySchema = createInsertSchema(properties).omit({ id: true, createdAt: true, updatedAt: true });
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

// ─── Platform Knowledge Base ─────────────────────────────────────────────────

export const platformKnowledge = pgTable("platform_knowledge", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  section: text("section").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type PlatformKnowledgeEntry = typeof platformKnowledge.$inferSelect;

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
