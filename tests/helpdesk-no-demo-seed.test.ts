import { beforeEach, describe, expect, it } from "vitest";
import supertest from "supertest";
import { buildApp } from "../server/app-factory.js";
import { db } from "../server/db.js";
import { helpConversations, helpInboxes, helpMessages, helpTickets } from "../shared/schema.js";
import { eq } from "drizzle-orm";
import { seedStaff, seedTenant } from "./helpers/seed.js";

describe("helpdesk never seeds demo data on read (H2)", () => {
  let tenantId: string;
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    const tenant = await seedTenant("fresh-tenant", "Fresh Tenant");
    tenantId = tenant.id;
    await seedStaff({ email: "manager@fresh.example.com", role: "manager", tenantId });
    app = await buildApp();
  });

  async function loginAsManager() {
    const agent = supertest.agent(app);
    const res = await agent.post("/api/auth/login").send({
      email: "manager@fresh.example.com",
      password: "Password1234",
    });
    expect(res.status).toBe(200);
    return agent;
  }

  it("GET /api/helpdesk/inbox/navigation on a fresh tenant creates no demo conversations", async () => {
    const agent = await loginAsManager();
    const res = await agent.get("/api/helpdesk/inbox/navigation");
    expect(res.status).toBe(200);

    const conversations = await db.select().from(helpConversations).where(eq(helpConversations.tenantId, tenantId));
    const messages = await db.select().from(helpMessages).where(eq(helpMessages.tenantId, tenantId));
    const tickets = await db.select().from(helpTickets).where(eq(helpTickets.tenantId, tenantId));
    const inboxes = await db.select().from(helpInboxes).where(eq(helpInboxes.tenantId, tenantId));

    expect(conversations.length).toBe(0);
    expect(messages.length).toBe(0);
    expect(tickets.length).toBe(0);
    expect(inboxes.length).toBe(0);
  });

  it("GET /api/helpdesk/inbox/conversations on a fresh tenant returns empty and writes nothing", async () => {
    const agent = await loginAsManager();
    const res = await agent.get("/api/helpdesk/inbox/conversations");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.conversations)).toBe(true);
    expect(res.body.conversations.length).toBe(0);

    const conversations = await db.select().from(helpConversations).where(eq(helpConversations.tenantId, tenantId));
    expect(conversations.length).toBe(0);
  });
});
