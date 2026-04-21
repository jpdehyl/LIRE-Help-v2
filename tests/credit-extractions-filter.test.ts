import { describe, it, expect, beforeEach } from "vitest";
import supertest from "supertest";
import { buildApp } from "../server/app-factory.js";
import { seedTenant, seedStaff, truncateAll } from "./helpers/seed.js";
import { db } from "../server/db.js";
import { creditExtractions, creditDocuments, lessees } from "../shared/schema.js";

async function agentFor(email: string) {
  const app = await buildApp();
  const agent = supertest.agent(app);
  await agent.post("/api/auth/login").send({ email, password: "Password1234" }).expect(200);
  return agent;
}

// H4: extractions endpoint must filter by documentId in SQL, not by pulling
// the whole tenant's extractions and filtering in JS. Previously it returned
// the entire tenant's extractions minus a JS filter — the SQL query itself
// ignored the docIds. This test locks in that the server only returns rows
// whose documentId belongs to the requested lessee.
describe("credit extractions — tenant-wide isolation via inArray (H4)", () => {
  beforeEach(truncateAll);

  it("GET /lessees/:id/extractions only returns extractions for that lessee's documents", async () => {
    const t = await seedTenant("a");
    await seedStaff({ email: "o@x.com", role: "owner", tenantId: t.id });
    const agent = await agentFor("o@x.com");

    // Two lessees on the same tenant, each with one document.
    const lesseeA = await agent.post("/api/pilots/credit/lessees").send({ legalName: "A" }).expect(201);
    const lesseeB = await agent.post("/api/pilots/credit/lessees").send({ legalName: "B" }).expect(201);

    const [docA] = await db.insert(creditDocuments).values({
      tenantId: t.id,
      lesseeId: lesseeA.body.lessee.id,
      blobUrl: "file:///a",
      sha256: "a".repeat(64),
      mimeType: "application/pdf",
    }).returning();
    const [docB] = await db.insert(creditDocuments).values({
      tenantId: t.id,
      lesseeId: lesseeB.body.lessee.id,
      blobUrl: "file:///b",
      sha256: "b".repeat(64),
      mimeType: "application/pdf",
    }).returning();

    await db.insert(creditExtractions).values([
      { tenantId: t.id, documentId: docA.id, lineItem: "revenue", value: "100" },
      { tenantId: t.id, documentId: docA.id, lineItem: "ebitda", value: "20" },
      { tenantId: t.id, documentId: docB.id, lineItem: "revenue", value: "999" },
    ]);

    // Requesting lessee A should NOT surface lessee B's extraction row.
    const r = await agent.get(`/api/pilots/credit/lessees/${lesseeA.body.lessee.id}/extractions`).expect(200);
    const docIds = (r.body.extractions as Array<{ documentId: string }>).map((e) => e.documentId);
    expect(docIds.sort()).toEqual([docA.id, docA.id].sort());
    expect(docIds).not.toContain(docB.id);
  });

  it("returns empty array when lessee has no documents", async () => {
    const t = await seedTenant("a");
    await seedStaff({ email: "o@x.com", role: "owner", tenantId: t.id });
    const agent = await agentFor("o@x.com");

    const lessee = await agent.post("/api/pilots/credit/lessees").send({ legalName: "Solo" }).expect(201);
    const r = await agent.get(`/api/pilots/credit/lessees/${lessee.body.lessee.id}/extractions`).expect(200);
    expect(r.body.extractions).toEqual([]);
  });
});

// Silence the unused-import warning on lessees — it's imported for type
// narrowing in test setup in case we need to add more scenarios later.
void lessees;
