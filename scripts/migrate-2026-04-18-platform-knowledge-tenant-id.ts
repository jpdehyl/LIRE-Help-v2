// Idempotent migration: add `tenant_id` to `platform_knowledge` and make it NOT NULL.
// Run with: tsx scripts/migrate-2026-04-18-platform-knowledge-tenant-id.ts
//
// Any pre-existing unscoped rows are assigned to a "system" tenant (created if needed)
// so the NOT NULL constraint can be applied cleanly. Further re-runs are no-ops.

import { Client } from "pg";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    const colCheck = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name='platform_knowledge' AND column_name='tenant_id'",
    );
    if (colCheck.rows.length === 0) {
      console.log("Adding platform_knowledge.tenant_id …");
      await client.query("ALTER TABLE platform_knowledge ADD COLUMN tenant_id varchar");
    } else {
      console.log("platform_knowledge.tenant_id already present.");
    }

    const unscoped = await client.query(
      "SELECT COUNT(*)::int AS count FROM platform_knowledge WHERE tenant_id IS NULL",
    );
    const unscopedCount: number = unscoped.rows[0]?.count ?? 0;
    if (unscopedCount > 0) {
      const sys = await client.query("SELECT id FROM tenants WHERE slug='system' LIMIT 1");
      let sysId: string | undefined = sys.rows[0]?.id;
      if (!sysId) {
        const inserted = await client.query(
          "INSERT INTO tenants (slug, name) VALUES ('system','System') RETURNING id",
        );
        sysId = inserted.rows[0].id;
        console.log("Created 'system' tenant", sysId);
      }
      await client.query("UPDATE platform_knowledge SET tenant_id=$1 WHERE tenant_id IS NULL", [sysId]);
      console.log(`Backfilled ${unscopedCount} platform_knowledge rows to system tenant.`);
    }

    try {
      await client.query("ALTER TABLE platform_knowledge ALTER COLUMN tenant_id SET NOT NULL");
    } catch (e: any) {
      if (!/is not null|already/i.test(e.message)) throw e;
    }

    const fkCheck = await client.query(
      "SELECT conname FROM pg_constraint WHERE conname='platform_knowledge_tenant_id_fkey'",
    );
    if (fkCheck.rows.length === 0) {
      await client.query(
        "ALTER TABLE platform_knowledge ADD CONSTRAINT platform_knowledge_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id)",
      );
      console.log("Added FK platform_knowledge_tenant_id_fkey.");
    }

    await client.query(
      "CREATE INDEX IF NOT EXISTS idx_platform_knowledge_tenant ON platform_knowledge (tenant_id)",
    );

    console.log("Done — platform_knowledge.tenant_id is NOT NULL with FK + index.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
