import { describe, it, expect, beforeEach } from "vitest";
import supertest from "supertest";
import { getApp } from "./helpers/request.js";
import { seedTenant, seedProperty, seedStaff, truncateAll } from "./helpers/seed.js";
import { pgClient } from "../server/db.js";

async function agentFor(email: string) {
  const app = await getApp();
  const agent = supertest.agent(app);
  const res = await agent.post("/api/auth/login").send({ email, password: "Password1234" });
  expect(res.status).toBe(200);
  return agent;
}

describe("staff-routes hardening (B2)", () => {
  beforeEach(truncateAll);

  it("readonly cannot list staff", async () => {
    const a = await seedTenant("a");
    await seedStaff({ email: "ro@x.com", role: "readonly", tenantId: a.id });
    const agent = await agentFor("ro@x.com");
    const res = await agent.get("/api/staff");
    expect(res.status).toBe(403);
  });

  it("owner cannot create staff with a foreign propertyId", async () => {
    const a = await seedTenant("a");
    const b = await seedTenant("b");
    const propB = await seedProperty(b.id, "b-prop");
    await seedStaff({ email: "owner-a@x.com", role: "owner", tenantId: a.id });
    const agent = await agentFor("owner-a@x.com");
    const res = await agent.post("/api/staff").send({
      email: "new@x.com",
      password: "Password1234",
      name: "N",
      role: "manager",
      propertyId: propB.id,
    });
    expect(res.status).toBe(403);
  });

  it("owner cannot set tenantId on create", async () => {
    const a = await seedTenant("a");
    const b = await seedTenant("b");
    await seedStaff({ email: "owner-a@x.com", role: "owner", tenantId: a.id });
    const agent = await agentFor("owner-a@x.com");
    const res = await agent.post("/api/staff").send({
      email: "new@x.com",
      password: "Password1234",
      name: "N",
      role: "manager",
      tenantId: b.id,
    });
    expect(res.status).toBe(201);
    expect(res.body.tenantId).toBe(a.id);
  });

  it("patching staff in another tenant returns 404", async () => {
    const a = await seedTenant("a");
    const b = await seedTenant("b");
    await seedStaff({ email: "owner-a@x.com", role: "owner", tenantId: a.id });
    const bUser = await seedStaff({ email: "b-mgr@x.com", role: "manager", tenantId: b.id });
    const agent = await agentFor("owner-a@x.com");
    const res = await agent.patch(`/api/staff/${bUser.id}`).send({ name: "Hijack" });
    expect(res.status).toBe(404);
  });

  it("deactivate revokes existing sessions", async () => {
    const a = await seedTenant("a");
    await seedStaff({ email: "owner-a@x.com", role: "owner", tenantId: a.id });
    const target = await seedStaff({ email: "target@x.com", role: "manager", tenantId: a.id });

    // target logs in, then owner deactivates, then target's next call must 401.
    const targetAgent = await agentFor("target@x.com");
    const me1 = await targetAgent.get("/api/auth/me");
    expect(me1.status).toBe(200);

    const sessBefore = await pgClient`SELECT 1 FROM staff_sessions WHERE sess::jsonb->>'staffId' = ${target.id}` as unknown as Array<{ "?column?": number }>;
    expect(sessBefore.length).toBeGreaterThan(0);

    const ownerAgent = await agentFor("owner-a@x.com");
    const del = await ownerAgent.delete(`/api/staff/${target.id}`);
    expect(del.status).toBe(200);

    const sessAfter = await pgClient`SELECT 1 FROM staff_sessions WHERE sess::jsonb->>'staffId' = ${target.id}` as unknown as Array<{ "?column?": number }>;
    expect(sessAfter.length).toBe(0);

    const me2 = await targetAgent.get("/api/auth/me");
    expect(me2.status).toBe(401);
  });
});
