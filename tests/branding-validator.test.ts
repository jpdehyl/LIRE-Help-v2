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

describe("branding_json validator (B14)", () => {
  beforeEach(truncateAll);

  it("accepts a valid hex primaryColor on PUT", async () => {
    const a = await seedTenant("a");
    const prop = await seedProperty(a.id, "p1");
    await seedStaff({ email: "o@x.com", role: "owner", tenantId: a.id });
    const c = await agentFor("o@x.com");
    await c.put(`/api/properties/${prop.id}`).send({
      brandingJson: { primaryColor: "#0F2942" },
    }).expect(200);
  });

  it("rejects a CSS-injection primaryColor", async () => {
    const a = await seedTenant("a");
    const prop = await seedProperty(a.id, "p1");
    await seedStaff({ email: "o@x.com", role: "owner", tenantId: a.id });
    const c = await agentFor("o@x.com");
    await c.put(`/api/properties/${prop.id}`).send({
      brandingJson: { primaryColor: "red; background: url(javascript:alert(1))" },
    }).expect(400);
  });

  it("rejects unknown brandingJson keys (strict)", async () => {
    const a = await seedTenant("a");
    const prop = await seedProperty(a.id, "p1");
    await seedStaff({ email: "o@x.com", role: "owner", tenantId: a.id });
    const c = await agentFor("o@x.com");
    await c.put(`/api/properties/${prop.id}`).send({
      brandingJson: { primaryColor: "#0F2942", xssPayload: "<script>" },
    }).expect(400);
  });

  it("rejects non-URL logoUrl", async () => {
    const a = await seedTenant("a");
    const prop = await seedProperty(a.id, "p1");
    await seedStaff({ email: "o@x.com", role: "owner", tenantId: a.id });
    const c = await agentFor("o@x.com");
    await c.put(`/api/properties/${prop.id}`).send({
      brandingJson: { logoUrl: "javascript:alert(1)" },
    }).expect(400);
  });

  it("accepts valid full brandingJson on POST (superadmin)", async () => {
    const a = await seedTenant("a");
    await seedStaff({ email: "sa@x.com", role: "superadmin", tenantId: a.id });
    const c = await agentFor("sa@x.com");
    const r = await c.post("/api/properties").send({
      name: "Valid",
      slug: "valid-1",
      tenantId: a.id,
      brandingJson: {
        primaryColor: "#123456",
        secondaryColor: "#abcdef",
        fontFamily: "Inter",
        darkMode: true,
        logoUrl: "https://example.com/logo.png",
        faviconUrl: null,
      },
    }).expect(201);
    expect(r.body.brandingJson.primaryColor).toBe("#123456");
  });
});
