import { beforeEach, describe, expect, it } from "vitest";
import supertest from "supertest";
import { buildApp } from "../server/app-factory.js";
import { db } from "../server/db.js";
import { platformKnowledge } from "../shared/schema.js";
import { seedStaff, seedTenant } from "./helpers/seed.js";

async function seedKbEntry(tenantId: string, title: string) {
  const [row] = await db.insert(platformKnowledge).values({
    tenantId,
    section: "general",
    title,
    content: `content for ${title}`,
    sortOrder: 0,
  }).returning();
  return row!;
}

describe("platform_knowledge tenant scoping (B10)", () => {
  let tenantA: Awaited<ReturnType<typeof seedTenant>>;
  let tenantB: Awaited<ReturnType<typeof seedTenant>>;
  let kbAId: string;
  let kbBId: string;
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    tenantA = await seedTenant("tenant-a", "Tenant A");
    tenantB = await seedTenant("tenant-b", "Tenant B");
    await seedStaff({ email: "owner-a@example.com", role: "owner", tenantId: tenantA.id });
    await seedStaff({ email: "owner-b@example.com", role: "owner", tenantId: tenantB.id });
    const kbA = await seedKbEntry(tenantA.id, "A-only policy");
    const kbB = await seedKbEntry(tenantB.id, "B-only policy");
    kbAId = kbA.id;
    kbBId = kbB.id;
    app = await buildApp();
  });

  async function loginAs(email: string) {
    const agent = supertest.agent(app);
    const res = await agent.post("/api/auth/login").send({ email, password: "Password1234" });
    expect(res.status).toBe(200);
    return agent;
  }

  it("owner of tenant A sees only A's KB entries", async () => {
    const agent = await loginAs("owner-a@example.com");
    const res = await agent.get("/api/knowledge/platform");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.map((e: { title: string }) => e.title)).toEqual(["A-only policy"]);
  });

  it("owner of A cannot update B's KB entry", async () => {
    const agent = await loginAs("owner-a@example.com");
    const res = await agent
      .put(`/api/knowledge/platform/${kbBId}`)
      .send({ title: "hijacked" });
    expect(res.status).toBe(404);

    const untouched = await db.select().from(platformKnowledge);
    const b = untouched.find((r) => r.id === kbBId);
    expect(b?.title).toBe("B-only policy");
  });

  it("owner of A cannot delete B's KB entry", async () => {
    const agent = await loginAs("owner-a@example.com");
    const res = await agent.delete(`/api/knowledge/platform/${kbBId}`);
    expect(res.status).toBe(404);

    const rows = await db.select().from(platformKnowledge);
    expect(rows.map((r) => r.id).sort()).toEqual([kbAId, kbBId].sort());
  });

  it("created entries are scoped to the caller's tenant", async () => {
    const agent = await loginAs("owner-a@example.com");
    const res = await agent
      .post("/api/knowledge/platform")
      .send({ section: "general", title: "A-new", content: "A content" });
    expect(res.status).toBe(201);
    expect(res.body.tenantId).toBe(tenantA.id);

    const rows = await db.select().from(platformKnowledge);
    expect(rows.filter((r) => r.tenantId === tenantB.id).map((r) => r.title)).toEqual(["B-only policy"]);
  });

  it("unauthenticated GET is rejected with 401", async () => {
    const client = supertest(app);
    const res = await client.get("/api/knowledge/platform");
    expect(res.status).toBe(401);
  });
});
