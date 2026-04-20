import { describe, it, expect, beforeEach } from "vitest";
import supertest from "supertest";
import { buildApp } from "../server/app-factory.js";
import { seedTenant, seedProperty, seedStaff, truncateAll } from "./helpers/seed.js";

async function agentFor(email: string) {
  const app = await buildApp();
  const client = supertest.agent(app);
  await client.post("/api/auth/login").send({ email, password: "Password1234" }).expect(200);
  return client;
}

describe("properties + agents cross-tenant writes (H11, H12)", () => {
  beforeEach(truncateAll);

  // H11
  it("owner cannot set tenantId to another tenant on POST /api/properties", async () => {
    const a = await seedTenant("a");
    const b = await seedTenant("b");
    await seedStaff({ email: "o@x.com", role: "owner", tenantId: a.id });
    const c = await agentFor("o@x.com");
    const r = await c.post("/api/properties").send({
      name: "Hijack",
      slug: "hijack-a",
      tenantId: b.id,
    }).expect(201);
    expect(r.body.tenantId).toBe(a.id);
  });

  it("owner cannot PUT a property in another tenant", async () => {
    const a = await seedTenant("a");
    const b = await seedTenant("b");
    const propB = await seedProperty(b.id, "b-prop");
    await seedStaff({ email: "o@x.com", role: "owner", tenantId: a.id });
    const c = await agentFor("o@x.com");
    await c.put(`/api/properties/${propB.id}`).send({ name: "Hostile" }).expect(403);
  });

  it("owner cannot change a property's tenantId via PUT", async () => {
    const a = await seedTenant("a");
    const b = await seedTenant("b");
    const propA = await seedProperty(a.id, "a-prop");
    await seedStaff({ email: "o@x.com", role: "owner", tenantId: a.id });
    const c = await agentFor("o@x.com");
    const r = await c.put(`/api/properties/${propA.id}`).send({
      tenantId: b.id,
      name: "StillInA",
    }).expect(200);
    expect(r.body.tenantId).toBe(a.id);
    expect(r.body.name).toBe("StillInA");
  });

  // H12
  it("owner cannot PUT agents/by-property/<foreign>", async () => {
    const a = await seedTenant("a");
    const b = await seedTenant("b");
    const propB = await seedProperty(b.id, "b-prop");
    await seedStaff({ email: "o@x.com", role: "owner", tenantId: a.id });
    const c = await agentFor("o@x.com");
    await c.put(`/api/agents/by-property/${propB.id}`).send({ name: "HostileAgent" }).expect(403);
  });

  it("owner cannot POST an agent with a foreign propertyId", async () => {
    const a = await seedTenant("a");
    const b = await seedTenant("b");
    const propB = await seedProperty(b.id, "b-prop");
    await seedStaff({ email: "o@x.com", role: "owner", tenantId: a.id });
    const c = await agentFor("o@x.com");
    await c.post("/api/agents").send({ propertyId: propB.id, name: "HostileAgent" }).expect(403);
  });

  it("superadmin CAN POST an agent across tenants (admin bypass)", async () => {
    const a = await seedTenant("a");
    const b = await seedTenant("b");
    const propB = await seedProperty(b.id, "b-prop");
    await seedStaff({ email: "sa@x.com", role: "superadmin", tenantId: a.id });
    const c = await agentFor("sa@x.com");
    await c.post("/api/agents").send({ propertyId: propB.id, name: "AdminAgent" }).expect(201);
  });
});
