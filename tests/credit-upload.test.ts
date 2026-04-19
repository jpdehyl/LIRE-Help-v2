import { describe, it, expect, beforeEach } from "vitest";
import supertest from "supertest";
import { getApp } from "./helpers/request.js";
import { seedTenant, seedStaff, truncateAll } from "./helpers/seed.js";

async function agentFor(email: string) {
  const app = await getApp();
  const agent = supertest.agent(app);
  await agent.post("/api/auth/login").send({ email, password: "Password1234" }).expect(200);
  return agent;
}

describe("credit document upload (B7)", () => {
  beforeEach(truncateAll);

  it("rejects disallowed mimeType", async () => {
    const t = await seedTenant("a");
    await seedStaff({ email: "o@x.com", role: "owner", tenantId: t.id });
    const agent = await agentFor("o@x.com");
    const created = await agent.post("/api/pilots/credit/lessees").send({ legalName: "ACME" }).expect(201);
    await agent.post("/api/pilots/credit/documents/upload").send({
      lesseeId: created.body.lessee.id,
      filename: "bad.exe",
      mimeType: "application/x-msdownload",
      base64: Buffer.from("hi").toString("base64"),
    }).expect(400);
  });

  it("rejects oversized payloads", async () => {
    const t = await seedTenant("a");
    await seedStaff({ email: "o@x.com", role: "owner", tenantId: t.id });
    const agent = await agentFor("o@x.com");
    const created = await agent.post("/api/pilots/credit/lessees").send({ legalName: "ACME" }).expect(201);
    const big = Buffer.alloc(30 * 1024 * 1024, 0x20); // 30MB > 25MB cap
    await agent.post("/api/pilots/credit/documents/upload").send({
      lesseeId: created.body.lessee.id,
      filename: "big.pdf",
      mimeType: "application/pdf",
      base64: big.toString("base64"),
    }).expect(413);
  });

  it("dedupes identical uploads", async () => {
    const t = await seedTenant("a");
    await seedStaff({ email: "o@x.com", role: "owner", tenantId: t.id });
    const agent = await agentFor("o@x.com");
    const created = await agent.post("/api/pilots/credit/lessees").send({ legalName: "ACME" }).expect(201);
    const body = {
      lesseeId: created.body.lessee.id,
      filename: "ok.pdf",
      mimeType: "application/pdf",
      base64: Buffer.from("PDF_BYTES_HERE").toString("base64"),
    };
    const a = await agent.post("/api/pilots/credit/documents/upload").send(body).expect(201);
    const b = await agent.post("/api/pilots/credit/documents/upload").send(body).expect(200);
    expect(b.body.dedup).toBe(true);
    expect(b.body.document.id).toBe(a.body.document.id);
  });

  it("sanitizes traversal filenames", async () => {
    const t = await seedTenant("a");
    await seedStaff({ email: "o@x.com", role: "owner", tenantId: t.id });
    const agent = await agentFor("o@x.com");
    const created = await agent.post("/api/pilots/credit/lessees").send({ legalName: "ACME" }).expect(201);
    const r = await agent.post("/api/pilots/credit/documents/upload").send({
      lesseeId: created.body.lessee.id,
      filename: "../../../etc/passwd",
      mimeType: "application/pdf",
      base64: Buffer.from("x").toString("base64"),
    }).expect(201);
    expect(r.body.document.blobUrl).not.toMatch(/\.\./);
  });
});
