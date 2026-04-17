// Run: npx tsx scripts/sync-yardi-units.ts <tenant-slug> <property-slug> <property-external-id>
// Example: npx tsx scripts/sync-yardi-units.ts berkeley oakland-gateway oakland-gateway
//
// Uses Yardi fixture data unless YARDI_API_URL + YARDI_API_KEY are set, in
// which case the live client is used. Prints a SyncResult to stdout.

import { and, eq } from "drizzle-orm";
import { db } from "../server/db.js";
import { properties, tenants } from "../shared/schema.js";
import { syncPropertyUnits } from "../server/pilots/leasing/yardi-sync.js";

async function main() {
  const [tenantSlug, propertySlug, propertyExternalId] = process.argv.slice(2);
  if (!tenantSlug || !propertySlug || !propertyExternalId) {
    console.error("Usage: sync-yardi-units.ts <tenant-slug> <property-slug> <property-external-id>");
    process.exit(1);
  }

  const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, tenantSlug)).limit(1);
  if (!tenant) {
    console.error(`Tenant ${tenantSlug} not found`);
    process.exit(1);
  }

  const [property] = await db
    .select()
    .from(properties)
    .where(and(eq(properties.slug, propertySlug), eq(properties.tenantId, tenant.id)))
    .limit(1);
  if (!property) {
    console.error(`Property ${propertySlug} not found under tenant ${tenantSlug}`);
    process.exit(1);
  }

  const result = await syncPropertyUnits({
    tenantId: tenant.id,
    tenantSlug,
    propertyId: property.id,
    propertyExternalId,
  });

  console.log("Sync result:", result);
}

main().catch((err) => {
  console.error("[sync-yardi-units] fatal:", err);
  process.exit(1);
});
