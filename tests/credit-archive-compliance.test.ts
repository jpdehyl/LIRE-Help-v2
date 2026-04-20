import { describe, it, expect, beforeEach } from "vitest";
import supertest from "supertest";
import { buildApp } from "../server/app-factory.js";
import { seedTenant, seedStaff, truncateAll } from "./helpers/seed.js";

async function agentFor(email: string) {
  const app = await buildApp();
  const agent = supertest.agent(app);
  await agent.post("/api/auth/login").send({ email, password: "Password1234" }).expect(200);
  return agent;
}

describe("credit archive access (B13)", () => {
  beforeEach(truncateAll);

  it("compliance role can GET the archive", async () => {
    const t = await seedTenant("a");
    await seedStaff({ email: "c@x.com", role: "compliance", tenantId: t.id });
    const agent = await agentFor("c@x.com");
    await agent.get("/api/pilots/credit/archive").expect(200);
  });

  it("superadmin can GET the archive", async () => {
    const t = await seedTenant("a");
    await seedStaff({ email: "sa@x.com", role: "superadmin", tenantId: t.id });
    const agent = await agentFor("sa@x.com");
    await agent.get("/api/pilots/credit/archive").expect(200);
  });

  it("owner cannot GET the archive", async () => {
    const t = await seedTenant("a");
    await seedStaff({ email: "o@x.com", role: "owner", tenantId: t.id });
    const agent = await agentFor("o@x.com");
    await agent.get("/api/pilots/credit/archive").expect(403);
  });

  it("readonly cannot GET the archive", async () => {
    const t = await seedTenant("a");
    await seedStaff({ email: "ro@x.com", role: "readonly", tenantId: t.id });
    const agent = await agentFor("ro@x.com");
    await agent.get("/api/pilots/credit/archive").expect(403);
  });
});
