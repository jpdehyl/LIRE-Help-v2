import { beforeEach, describe, expect, it } from "vitest";
import supertest from "supertest";
import { getApp } from "./helpers/request.js";
import { db } from "../server/db.js";
import { helpConversationTags, helpConversations, helpCustomers, helpInboxes, helpTags } from "../shared/schema.js";
import { seedProperty, seedStaff, seedTenant } from "./helpers/seed.js";

describe("helpdesk mutation endpoints block readonly role (A4)", () => {
  let tenantId: string;
  let conversationId: string;
  let propertyId: string;
  let foreignPropertyId: string;
  let tagId: string;
  let app: Awaited<ReturnType<typeof getApp>>;

  beforeEach(async () => {
    const tenant = await seedTenant("rg-tenant", "Role Gating Tenant");
    tenantId = tenant.id;
    propertyId = (await seedProperty(tenantId, "rg-property", "RG Property")).id;
    await seedStaff({ email: "ro@rg.example.com", role: "readonly", tenantId });
    await seedStaff({ email: "staff@rg.example.com", role: "staff", tenantId });
    await seedStaff({ email: "mgr@rg.example.com", role: "manager", tenantId });

    const otherTenant = await seedTenant("rg-foreign-tenant", "Role Gating Foreign Tenant");
    foreignPropertyId = (await seedProperty(otherTenant.id, "rg-foreign-property", "RG Foreign Property")).id;

    const [inbox] = await db.insert(helpInboxes).values({
      tenantId, propertyId, slug: "support", name: "Support", description: null, channel: "email", isDefault: true,
    }).returning();
    const [customer] = await db.insert(helpCustomers).values({
      tenantId, propertyId, name: "Acme", email: "acme@example.com", tier: "standard", health: "stable",
    }).returning();
    const [conv] = await db.insert(helpConversations).values({
      tenantId, propertyId, inboxId: inbox!.id, customerId: customer!.id, subject: "Test",
      status: "open", priority: "medium", assignmentState: "unassigned", channel: "email",
      preview: "…", unreadCount: 1, messageCount: 1,
      lastMessageAt: new Date(),
    }).returning();
    conversationId = conv!.id;

    const [tag] = await db.insert(helpTags).values({
      tenantId,
      propertyId,
      name: "Urgent HVAC",
      slug: "urgent-hvac",
      color: null,
      description: null,
    }).returning();
    tagId = tag!.id;

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

  it("readonly role gets 403 on replies POST", async () => {
    const ro = await login("ro@rg.example.com");
    const res = await ro.post(`/api/helpdesk/inbox/conversations/${conversationId}/replies`).send({ body: "reply" });
    expect(res.status).toBe(403);
  });

  it("readonly role gets 403 on tag add POST", async () => {
    const ro = await login("ro@rg.example.com");
    const res = await ro.post(`/api/helpdesk/inbox/conversations/${conversationId}/tags`).send({ tagId });
    expect(res.status).toBe(403);
  });

  it("readonly role gets 403 on tag remove DELETE", async () => {
    await db.insert(helpConversationTags).values({ tenantId, propertyId, conversationId, tagId });
    const ro = await login("ro@rg.example.com");
    const res = await ro.delete(`/api/helpdesk/inbox/conversations/${conversationId}/tags/${tagId}`);
    expect(res.status).toBe(403);
  });

  it("readonly role gets 403 on snooze PATCH", async () => {
    const ro = await login("ro@rg.example.com");
    const res = await ro.patch(`/api/helpdesk/inbox/conversations/${conversationId}/snooze`).send({ snoozedUntil: new Date(Date.now() + 60 * 60 * 1000).toISOString() });
    expect(res.status).toBe(403);
  });

  it("readonly role gets 403 on archive PATCH", async () => {
    const ro = await login("ro@rg.example.com");
    const res = await ro.patch(`/api/helpdesk/inbox/conversations/${conversationId}/archive`).send({ archived: true });
    expect(res.status).toBe(403);
  });

  it("readonly role gets 403 on spam PATCH", async () => {
    const ro = await login("ro@rg.example.com");
    const res = await ro.patch(`/api/helpdesk/inbox/conversations/${conversationId}/spam`).send({ spam: true });
    expect(res.status).toBe(403);
  });

  it("staff role gets 403 on soft-delete PATCH", async () => {
    const staff = await login("staff@rg.example.com");
    const res = await staff.patch(`/api/helpdesk/inbox/conversations/${conversationId}/soft-delete`).send({ deleted: true });
    expect(res.status).toBe(403);
  });

  it("readonly role can still read inbox navigation", async () => {
    const ro = await login("ro@rg.example.com");
    const res = await ro.get("/api/helpdesk/inbox/navigation");
    expect(res.status).toBe(200);
    expect(res.body.views.some((view: { key: string }) => view.key === "trash")).toBe(false);
  });

  it("staff role cannot request the trash inbox view", async () => {
    const staff = await login("staff@rg.example.com");
    const res = await staff.get("/api/helpdesk/inbox/conversations?view=trash");
    expect(res.status).toBe(403);
  });

  it("navigation rejects property filters outside the tenant scope", async () => {
    const ro = await login("ro@rg.example.com");
    const res = await ro.get(`/api/helpdesk/inbox/navigation?propertyId=${foreignPropertyId}`);
    expect(res.status).toBe(403);
  });

  it("manager role can mutate status", async () => {
    const mgr = await login("mgr@rg.example.com");
    const res = await mgr.patch(`/api/helpdesk/inbox/conversations/${conversationId}/status`).send({ status: "resolved" });
    expect([200, 404]).toContain(res.status);
  });

  it("manager role can record replies", async () => {
    const mgr = await login("mgr@rg.example.com");
    const res = await mgr.post(`/api/helpdesk/inbox/conversations/${conversationId}/replies`).send({ body: "We have an update for you." });
    expect(res.status).toBe(201);
    expect(res.body.ticket.status).toBe("waiting_on_customer");
    expect(res.body.timeline.some((item: { type: string; body: string }) => item.type === "teammate" && item.body === "We have an update for you.")).toBe(true);
  });

  it("manager role can add and remove tags", async () => {
    const mgr = await login("mgr@rg.example.com");

    const addRes = await mgr.post(`/api/helpdesk/inbox/conversations/${conversationId}/tags`).send({ tagId });
    expect(addRes.status).toBe(201);
    expect(addRes.body.ticket.tags).toContain("Urgent HVAC");

    const duplicateAddRes = await mgr.post(`/api/helpdesk/inbox/conversations/${conversationId}/tags`).send({ tagId });
    expect(duplicateAddRes.status).toBe(201);
    expect(duplicateAddRes.body.ticket.tags.filter((tag: string) => tag === "Urgent HVAC")).toHaveLength(1);

    const removeRes = await mgr.delete(`/api/helpdesk/inbox/conversations/${conversationId}/tags/${tagId}`);
    expect(removeRes.status).toBe(200);
    expect(removeRes.body.ticket.tags).not.toContain("Urgent HVAC");

    const duplicateRemoveRes = await mgr.delete(`/api/helpdesk/inbox/conversations/${conversationId}/tags/${tagId}`);
    expect(duplicateRemoveRes.status).toBe(200);
    expect(duplicateRemoveRes.body.ticket.tags).not.toContain("Urgent HVAC");
  });

  it("manager tag add route validates tagId", async () => {
    const mgr = await login("mgr@rg.example.com");
    const res = await mgr.post(`/api/helpdesk/inbox/conversations/${conversationId}/tags`).send({ tagId: "" });
    expect(res.status).toBe(400);
  });

  it("manager role can snooze and unsnooze", async () => {
    const mgr = await login("mgr@rg.example.com");
    const snoozedUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const snoozeRes = await mgr.patch(`/api/helpdesk/inbox/conversations/${conversationId}/snooze`).send({ snoozedUntil });
    expect(snoozeRes.status).toBe(200);
    expect(snoozeRes.body.mailbox.snoozedUntil).toBe(snoozedUntil);

    const unsnoozeRes = await mgr.patch(`/api/helpdesk/inbox/conversations/${conversationId}/snooze`).send({ snoozedUntil: null });
    expect(unsnoozeRes.status).toBe(200);
    expect(unsnoozeRes.body.mailbox.snoozedUntil).toBeNull();
  });

  it("manager role can archive, mark spam, and soft-delete", async () => {
    const mgr = await login("mgr@rg.example.com");

    const archiveRes = await mgr.patch(`/api/helpdesk/inbox/conversations/${conversationId}/archive`).send({ archived: true });
    expect(archiveRes.status).toBe(200);

    const spamRes = await mgr.patch(`/api/helpdesk/inbox/conversations/${conversationId}/spam`).send({ spam: true });
    expect(spamRes.status).toBe(200);

    const softDeleteRes = await mgr.patch(`/api/helpdesk/inbox/conversations/${conversationId}/soft-delete`).send({ deleted: true, deleteReason: "cleanup" });
    expect(softDeleteRes.status).toBe(200);
  });

  it("non-admin users cannot fetch deleted conversation detail while admins still can", async () => {
    const mgr = await login("mgr@rg.example.com");
    const softDeleteRes = await mgr.patch(`/api/helpdesk/inbox/conversations/${conversationId}/soft-delete`).send({ deleted: true, deleteReason: "cleanup" });
    expect(softDeleteRes.status).toBe(200);

    const staff = await login("staff@rg.example.com");
    const staffDetailRes = await staff.get(`/api/helpdesk/inbox/conversations/${conversationId}`);
    expect(staffDetailRes.status).toBe(404);

    const adminDetailRes = await mgr.get(`/api/helpdesk/inbox/conversations/${conversationId}`);
    expect(adminDetailRes.status).toBe(200);
    expect(adminDetailRes.body.mailbox.visibilityStatus).toBe("deleted");
  });

  it("snooze route validates future ISO payload", async () => {
    const mgr = await login("mgr@rg.example.com");

    const badDateRes = await mgr.patch(`/api/helpdesk/inbox/conversations/${conversationId}/snooze`).send({ snoozedUntil: "not-a-date" });
    expect(badDateRes.status).toBe(400);

    const pastDateRes = await mgr.patch(`/api/helpdesk/inbox/conversations/${conversationId}/snooze`).send({ snoozedUntil: new Date(Date.now() - 60 * 1000).toISOString() });
    expect(pastDateRes.status).toBe(400);
  });

  it("archive route validates boolean payload", async () => {
    const mgr = await login("mgr@rg.example.com");
    const res = await mgr.patch(`/api/helpdesk/inbox/conversations/${conversationId}/archive`).send({ archived: "yes" });
    expect(res.status).toBe(400);
  });

  it("spam route validates boolean payload", async () => {
    const mgr = await login("mgr@rg.example.com");
    const res = await mgr.patch(`/api/helpdesk/inbox/conversations/${conversationId}/spam`).send({ spam: "yes" });
    expect(res.status).toBe(400);
  });

  it("soft-delete route validates boolean payload", async () => {
    const mgr = await login("mgr@rg.example.com");
    const res = await mgr.patch(`/api/helpdesk/inbox/conversations/${conversationId}/soft-delete`).send({ deleted: "yes" });
    expect(res.status).toBe(400);
  });
});
