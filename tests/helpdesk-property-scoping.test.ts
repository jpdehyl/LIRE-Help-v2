import { beforeEach, describe, expect, it } from "vitest";
import supertest from "supertest";
import { getApp } from "./helpers/request.js";
import { db } from "../server/db.js";
import { helpConversations, helpCustomers, helpInboxes, properties } from "../shared/schema.js";
import { seedStaff, seedTenant } from "./helpers/seed.js";

describe("helpdesk propertyId scoping (A5)", () => {
  let tenantId: string;
  let propertyX: string;
  let propertyY: string;
  let foreignTenantPropertyId: string;
  let app: Awaited<ReturnType<typeof getApp>>;

  beforeEach(async () => {
    const tenant = await seedTenant("scope-tenant", "Scope Tenant");
    tenantId = tenant.id;
    const foreign = await seedTenant("foreign-tenant", "Foreign Tenant");

    const [propX] = await db.insert(properties).values({
      tenantId, slug: "prop-x", name: "Property X",
    }).returning();
    const [propY] = await db.insert(properties).values({
      tenantId, slug: "prop-y", name: "Property Y",
    }).returning();
    const [propF] = await db.insert(properties).values({
      tenantId: foreign.id, slug: "foreign-prop", name: "Foreign Prop",
    }).returning();
    propertyX = propX!.id;
    propertyY = propY!.id;
    foreignTenantPropertyId = propF!.id;

    await seedStaff({
      email: "mgr-scoped@scope.example.com",
      role: "manager",
      tenantId,
      propertyId: propertyX,
    });
    await seedStaff({
      email: "mgr-tenantwide@scope.example.com",
      role: "manager",
      tenantId,
      propertyId: null,
    });

    const [inbox] = await db.insert(helpInboxes).values({
      tenantId, slug: "support", name: "Support", description: null, channel: "email", isDefault: true,
    }).returning();
    const [customer] = await db.insert(helpCustomers).values({
      tenantId, name: "Acme", email: "acme@example.com", tier: "standard", health: "stable",
    }).returning();
    await db.insert(helpConversations).values({
      tenantId, propertyId: propertyX, inboxId: inbox!.id, customerId: customer!.id,
      subject: "X convo", status: "open", priority: "medium", assignmentState: "unassigned", channel: "email",
      preview: "…", unreadCount: 0, messageCount: 1, lastMessageAt: new Date(),
    });
    await db.insert(helpConversations).values({
      tenantId, propertyId: propertyY, inboxId: inbox!.id, customerId: customer!.id,
      subject: "Y convo", status: "open", priority: "medium", assignmentState: "unassigned", channel: "email",
      preview: "…", unreadCount: 0, messageCount: 1, lastMessageAt: new Date(),
    });

    app = await getApp();
  });

  async function login(email: string) {
    const agent = supertest.agent(app);
    const res = await agent.post("/api/auth/login").send({ email, password: "Password1234" });
    expect(res.status).toBe(200);
    return agent;
  }

  it("property-scoped staff requesting a different property gets 403", async () => {
    const agent = await login("mgr-scoped@scope.example.com");
    const res = await agent.get(`/api/helpdesk/inbox/conversations?propertyId=${propertyY}`);
    expect(res.status).toBe(403);
  });

  it("tenant-wide staff requesting a foreign tenant's property gets 403", async () => {
    const agent = await login("mgr-tenantwide@scope.example.com");
    const res = await agent.get(`/api/helpdesk/inbox/conversations?propertyId=${foreignTenantPropertyId}`);
    expect(res.status).toBe(403);
  });

  it("tenant-wide staff with no filter sees both property conversations", async () => {
    const agent = await login("mgr-tenantwide@scope.example.com");
    const res = await agent.get("/api/helpdesk/inbox/conversations");
    expect(res.status).toBe(200);
    const subjects = (res.body.conversations as Array<{ subject: string }>).map((c) => c.subject).sort();
    expect(subjects).toEqual(["X convo", "Y convo"]);
  });

  it("tenant-wide staff filtering to propertyX only sees X", async () => {
    const agent = await login("mgr-tenantwide@scope.example.com");
    const res = await agent.get(`/api/helpdesk/inbox/conversations?propertyId=${propertyX}`);
    expect(res.status).toBe(200);
    const subjects = (res.body.conversations as Array<{ subject: string }>).map((c) => c.subject);
    expect(subjects).toEqual(["X convo"]);
  });

  it("navigation counts honor property filters", async () => {
    const agent = await login("mgr-tenantwide@scope.example.com");
    const res = await agent.get(`/api/helpdesk/inbox/navigation?propertyId=${propertyX}`);
    expect(res.status).toBe(200);

    const views = res.body.views as Array<{ key: string; count: number }>;
    expect(views.find((view) => view.key === "all")?.count).toBe(1);
    expect(views.find((view) => view.key === "unassigned")?.count).toBe(1);
    expect(views.find((view) => view.key === "support")?.count).toBe(1);
  });
});
