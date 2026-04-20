import { db, pgClient } from "../../server/db.js";
import {
  tenants,
  properties,
  staffUsers,
  type StaffRole,
} from "../../shared/schema.js";
import { hashPassword } from "../../server/helpers/authHelpers.js";

const TABLES = [
  "archive_log", "credit_approvals", "credit_memos", "credit_checklist_runs",
  "credit_extractions", "credit_documents", "lessees",
  "unit_sheets", "tours", "deal_events", "deals", "units",
  "help_conversation_tags", "help_messages", "help_tickets", "help_conversations",
  "help_tags", "help_slas", "help_occupants", "help_inboxes",
  "token_usage", "platform_sessions", "platform_knowledge",
  "agents", "staff_sessions", "staff_users", "properties", "tenants",
] as const;

export async function truncateAll() {
  // Skip tables that don't exist yet. This lets tests run against a partially-
  // migrated test DB during Phase 1 (staff_sessions is declared in Task 5).
  // Why: the alternative is strict ordering of Tasks 1/2/5; we prefer a
  // tolerant truncate so iteration order in the plan stays flexible.
  const rows = await pgClient<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  `;
  const present = new Set(rows.map((r) => r.tablename));
  const toTruncate = TABLES.filter((t) => present.has(t)).map((t) => `"${t}"`).join(", ");
  if (toTruncate.length === 0) return;
  // Single TRUNCATE ... CASCADE is ~10x faster than one-per-table and avoids
  // repeated cascade planning.
  await pgClient.unsafe(`TRUNCATE TABLE ${toTruncate} CASCADE`);
}

export async function closeDb() {
  await pgClient.end();
}

export async function seedTenant(slug: string, name = slug) {
  const [row] = await db.insert(tenants).values({ slug, name }).returning();
  return row;
}

export async function seedProperty(tenantId: string, slug: string, name = slug) {
  const [row] = await db.insert(properties).values({ tenantId, slug, name }).returning();
  return row;
}

export async function seedStaff(opts: {
  email: string;
  role: StaffRole;
  tenantId: string | null;
  propertyId?: string | null;
  password?: string;
  name?: string;
}) {
  const passwordHash = await hashPassword(opts.password ?? "Password1234");
  const [row] = await db.insert(staffUsers).values({
    email: opts.email.toLowerCase(),
    passwordHash,
    name: opts.name ?? opts.email,
    role: opts.role,
    tenantId: opts.tenantId,
    propertyId: opts.propertyId ?? null,
    isActive: true,
  }).returning();
  return row;
}
