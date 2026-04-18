import { beforeEach, describe, expect, it } from "vitest";
import supertest from "supertest";
import { getApp } from "./helpers/request.js";
import { db } from "../server/db.js";
import { helpConversations, helpCustomers, helpInboxes } from "../shared/schema.js";
import { seedStaff, seedTenant } from "./helpers/seed.js";

describe("helpdesk mutation endpoints block readonly role (A4)", () => {
  let tenantId: string;
  let conversationId: string;
  let app: Awaited<ReturnType<typeof getApp>>;

  beforeEach(async () => {
    const tenant = await seedTenant("rg-tenant", "Role Gating Tenant");
    tenantId = tenant.id;
    await seedStaff({ email: "ro@rg.example.com", role: "readonly", tenantId });
    await seedStaff({ email: "mgr@rg.example.com", role: "manager", tenantId });

    const [inbox] = await db.insert(helpInboxes).values({
      tenantId, slug: "support", name: "Support", description: null, channel: "email", isDefault: true,
    }).returning();
    const [customer] = await db.insert(helpCustomers).values({
      tenantId, name: "Acme", email: "acme@example.com", tier: "standard", health: "stable",
    }).returning();
    const [conv] = await db.insert(helpConversations).values({
      tenantId, inboxId: inbox!.id, customerId: customer!.id, subject: "Test",
      status: "open", priority: "medium", assignmentState: "unassigned", channel: "email",
      preview: "…", unreadCount: 1, messageCount: 1,
      lastMessageAt: new Date(),
    }).returning();
    conversationId = conv!.id;

    app = await getApp();
  });

  async function login(email: string) {
    const agent = supertest.agent(app);
    const res = await agent.post("/api/auth/login").send({ email, password: "Password1234" });
    expect(res.status).toBe(200);
    return agent;
  }

  it("readonly role gets 403 on assignee PATCH", async () => {
    const ro = await login("ro@rg.example.com");
    const res = await ro.patch(`/api/helpdesk/inbox/conversations/${conversationId}/assignee`).send({ assigneeStaffId: null });
    expect(res.status).toBe(403);
  });

  it("readonly role gets 403 on status PATCH", async () => {
    const ro = await login("ro@rg.example.com");
    const res = await ro.patch(`/api/helpdesk/inbox/conversations/${conversationId}/status`).send({ status: "resolved" });
    expect(res.status).toBe(403);
  });

  it("readonly role gets 403 on priority PATCH", async () => {
    const ro = await login("ro@rg.example.com");
    const res = await ro.patch(`/api/helpdesk/inbox/conversations/${conversationId}/priority`).send({ priority: "urgent" });
    expect(res.status).toBe(403);
  });

  it("readonly role gets 403 on notes POST", async () => {
    const ro = await login("ro@rg.example.com");
    const res = await ro.post(`/api/helpdesk/inbox/conversations/${conversationId}/notes`).send({ body: "internal" });
    expect(res.status).toBe(403);
  });

  it("readonly role can still read inbox navigation", async () => {
    const ro = await login("ro@rg.example.com");
    const res = await ro.get("/api/helpdesk/inbox/navigation");
    expect(res.status).toBe(200);
  });

  it("manager role can mutate status", async () => {
    const mgr = await login("mgr@rg.example.com");
    const res = await mgr.patch(`/api/helpdesk/inbox/conversations/${conversationId}/status`).send({ status: "resolved" });
    expect([200, 404]).toContain(res.status);
  });
});
