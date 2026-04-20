import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../server/db.js";
import {
  addHelpConversationInternalNote,
  getHelpConversationDetail,
  getHelpInboxConversations,
  replyToHelpConversation,
  updateHelpConversationAssignee,
  updateHelpConversationArchiveState,
  updateHelpConversationPriority,
  updateHelpConversationSnooze,
  updateHelpConversationSoftDeleteState,
  updateHelpConversationSpamState,
  updateHelpConversationStatus,
} from "../server/storage.js";
import {
  helpConversations,
  helpCustomers,
  helpInboxes,
  helpMessages,
  helpTickets,
} from "../shared/schema.js";
import { seedProperty, seedStaff, seedTenant } from "./helpers/seed.js";

describe("helpdesk mailbox foundation fixes", () => {
  let tenantId: string;
  let propertyId: string;
  let actorStaffId: string;
  let conversationId: string;

  beforeEach(async () => {
    const tenant = await seedTenant("mailbox-foundation", "Mailbox Foundation Tenant");
    tenantId = tenant.id;
    const property = await seedProperty(tenantId, "prop-a", "Property A");
    propertyId = property.id;
    const actor = await seedStaff({
      email: "manager@mailbox-foundation.example.com",
      role: "manager",
      tenantId,
      propertyId: null,
    });
    actorStaffId = actor.id;

    const [inbox] = await db.insert(helpInboxes).values({
      tenantId,
      slug: "support",
      name: "Support",
      description: null,
      channel: "email",
      isDefault: true,
    }).returning();
    const [customer] = await db.insert(helpCustomers).values({
      tenantId,
      propertyId,
      name: "Acme",
      email: "acme@example.com",
      tier: "standard",
      health: "stable",
    }).returning();
    const [conversation] = await db.insert(helpConversations).values({
      tenantId,
      propertyId,
      inboxId: inbox!.id,
      customerId: customer!.id,
      subject: "Foundation test conversation",
      status: "open",
      priority: "medium",
      assignmentState: "unassigned",
      channel: "email",
      preview: "Initial preview",
      unreadCount: 0,
      messageCount: 1,
      lastMessageAt: new Date(),
    }).returning();
    conversationId = conversation!.id;
  });

  it("restoring a conversation preserves delete audit fields in DB without surfacing deleted mailbox detail", async () => {
    const deletedDetail = await updateHelpConversationSoftDeleteState(
      conversationId,
      true,
      "cleanup",
      tenantId,
      null,
      actorStaffId,
    );
    expect(deletedDetail?.mailbox.visibilityStatus).toBe("deleted");
    expect(deletedDetail?.mailbox.deletedAtLabel).not.toBeNull();
    expect(deletedDetail?.mailbox.deleteReason).toBe("cleanup");

    const restoredDetail = await updateHelpConversationSoftDeleteState(
      conversationId,
      false,
      null,
      tenantId,
      null,
      actorStaffId,
    );
    expect(restoredDetail?.mailbox.visibilityStatus).toBe("active");
    expect(restoredDetail?.mailbox.deletedAtLabel).toBeNull();
    expect(restoredDetail?.mailbox.deleteReason).toBeNull();

    const [conversation] = await db.select().from(helpConversations).where(eq(helpConversations.id, conversationId));
    expect(conversation?.deletedAt).not.toBeNull();
    expect(conversation?.deleteReason).toBe("cleanup");
    expect(conversation?.visibilityStatus).toBe("active");
  });

  it("workflow/system messages use the target conversation propertyId", async () => {
    const detail = await updateHelpConversationStatus(
      conversationId,
      "resolved",
      tenantId,
      null,
      actorStaffId,
    );
    expect(detail?.ticket.status).toBe("resolved");

    const messages = await db.select().from(helpMessages).where(eq(helpMessages.conversationId, conversationId));
    const workflowMessage = messages.find((message) => message.messageType === "system");
    expect(workflowMessage?.propertyId).toBe(propertyId);
  });

  it("internal notes use the target conversation propertyId", async () => {
    const detail = await addHelpConversationInternalNote(
      conversationId,
      "Tenant-wide manager note",
      tenantId,
      null,
      actorStaffId,
    );
    expect(detail?.timeline.some((item) => item.body === "Tenant-wide manager note")).toBe(true);

    const messages = await db.select().from(helpMessages).where(eq(helpMessages.conversationId, conversationId));
    const internalNote = messages.find((message) => message.messageType === "internal_note");
    expect(internalNote?.propertyId).toBe(propertyId);
  });

  it("snoozed conversations leave active views, appear in snoozed view, and return on unsnooze", async () => {
    const snoozeUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const snoozedDetail = await updateHelpConversationSnooze(
      conversationId,
      snoozeUntil,
      tenantId,
      null,
      actorStaffId,
    );

    expect(snoozedDetail?.mailbox.visibilityStatus).toBe("active");
    expect(snoozedDetail?.mailbox.snoozedUntil).toBe(snoozeUntil);
    expect(snoozedDetail?.mailbox.snoozedUntilLabel).not.toBeNull();

    const activeRows = await getHelpInboxConversations("all", tenantId, null, actorStaffId);
    const snoozedRows = await getHelpInboxConversations("snoozed", tenantId, null, actorStaffId);
    expect(activeRows.some((row) => row.id === conversationId)).toBe(false);
    expect(snoozedRows.some((row) => row.id === conversationId)).toBe(true);

    const unsnoozedDetail = await updateHelpConversationSnooze(
      conversationId,
      null,
      tenantId,
      null,
      actorStaffId,
    );
    expect(unsnoozedDetail?.mailbox.snoozedUntil).toBeNull();
    expect(unsnoozedDetail?.mailbox.snoozedUntilLabel).toBeNull();

    const restoredRows = await getHelpInboxConversations("all", tenantId, null, actorStaffId);
    const restoredSnoozedRows = await getHelpInboxConversations("snoozed", tenantId, null, actorStaffId);
    expect(restoredRows.some((row) => row.id === conversationId)).toBe(true);
    expect(restoredSnoozedRows.some((row) => row.id === conversationId)).toBe(false);

    const detail = await getHelpConversationDetail(conversationId, tenantId, null, actorStaffId);
    expect(detail?.mailbox.snoozedUntil).toBeNull();
    expect(detail?.mailbox.snoozedUntilLabel).toBeNull();

    const messages = await db.select().from(helpMessages).where(eq(helpMessages.conversationId, conversationId));
    const snoozeEvents = messages.filter((message) => message.messageType === "system" && message.body.toLowerCase().includes("snooz"));
    expect(snoozeEvents).toHaveLength(2);
  });

  it("snooze mutation cannot change deleted conversations", async () => {
    const deletedDetail = await updateHelpConversationSoftDeleteState(
      conversationId,
      true,
      "cleanup",
      tenantId,
      null,
      actorStaffId,
    );
    expect(deletedDetail?.mailbox.visibilityStatus).toBe("deleted");

    const snoozedDetail = await updateHelpConversationSnooze(
      conversationId,
      new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      tenantId,
      null,
      actorStaffId,
    );
    expect(snoozedDetail).toBeNull();

    const [conversation] = await db.select().from(helpConversations).where(eq(helpConversations.id, conversationId));
    expect(conversation?.visibilityStatus).toBe("deleted");
    expect(conversation?.snoozedUntil).toBeNull();
  });

  it("archive/spam mutations cannot change deleted conversations", async () => {
    const deletedDetail = await updateHelpConversationSoftDeleteState(
      conversationId,
      true,
      "cleanup",
      tenantId,
      null,
      actorStaffId,
    );
    expect(deletedDetail?.mailbox.visibilityStatus).toBe("deleted");

    const archivedDetail = await updateHelpConversationArchiveState(
      conversationId,
      true,
      tenantId,
      null,
      actorStaffId,
    );
    const spamDetail = await updateHelpConversationSpamState(
      conversationId,
      true,
      tenantId,
      null,
      actorStaffId,
    );

    expect(archivedDetail).toBeNull();
    expect(spamDetail).toBeNull();

    const [conversation] = await db.select().from(helpConversations).where(eq(helpConversations.id, conversationId));
    expect(conversation?.visibilityStatus).toBe("deleted");
    expect(conversation?.deleteReason).toBe("cleanup");
  });

  it("assignee/status/priority/notes mutations cannot change deleted conversations", async () => {
    const deletedDetail = await updateHelpConversationSoftDeleteState(
      conversationId,
      true,
      "cleanup",
      tenantId,
      null,
      actorStaffId,
    );
    expect(deletedDetail?.mailbox.visibilityStatus).toBe("deleted");

    const [before] = await db.select().from(helpConversations).where(eq(helpConversations.id, conversationId));
    const beforeMessages = await db.select().from(helpMessages).where(eq(helpMessages.conversationId, conversationId));

    const assigneeDetail = await updateHelpConversationAssignee(
      conversationId,
      actorStaffId,
      tenantId,
      null,
      actorStaffId,
    );
    const statusDetail = await updateHelpConversationStatus(
      conversationId,
      "resolved",
      tenantId,
      null,
      actorStaffId,
    );
    const priorityDetail = await updateHelpConversationPriority(
      conversationId,
      "urgent",
      tenantId,
      null,
      actorStaffId,
    );
    const noteDetail = await addHelpConversationInternalNote(
      conversationId,
      "Should not be added",
      tenantId,
      null,
      actorStaffId,
    );

    expect(assigneeDetail).toBeNull();
    expect(statusDetail).toBeNull();
    expect(priorityDetail).toBeNull();
    expect(noteDetail).toBeNull();

    const [after] = await db.select().from(helpConversations).where(eq(helpConversations.id, conversationId));
    const afterMessages = await db.select().from(helpMessages).where(eq(helpMessages.conversationId, conversationId));

    expect(after?.visibilityStatus).toBe("deleted");
    expect(after?.assigneeStaffId).toBe(before?.assigneeStaffId ?? null);
    expect(after?.status).toBe(before?.status);
    expect(after?.priority).toBe(before?.priority);
    expect(afterMessages).toHaveLength(beforeMessages.length);
    expect(afterMessages.filter((message) => message.messageType === "internal_note")).toHaveLength(0);
  });

  it("reply creates a teammate timeline item and defaults status to waiting_on_customer", async () => {
    const detail = await replyToHelpConversation(
      conversationId,
      "We reviewed this and will follow up shortly.",
      undefined,
      tenantId,
      null,
      actorStaffId,
    );

    expect(detail?.timeline.some((item) => item.type === "teammate" && item.body === "We reviewed this and will follow up shortly.")).toBe(true);
    expect(detail?.ticket.status).toBe("waiting_on_customer");

    const [conversation] = await db.select().from(helpConversations).where(eq(helpConversations.id, conversationId));
    expect(conversation?.status).toBe("waiting_on_customer");
    expect(conversation?.preview).toBe("We reviewed this and will follow up shortly.");
    expect(conversation?.unreadCount).toBe(0);

    const messages = await db.select().from(helpMessages).where(eq(helpMessages.conversationId, conversationId));
    const teammateReply = messages.find((message) => message.messageType === "teammate");
    expect(teammateReply?.authorStaffId).toBe(actorStaffId);
    expect(teammateReply?.propertyId).toBe(propertyId);
    expect(teammateReply?.body).toBe("We reviewed this and will follow up shortly.");
  });

  it("reply stamps ticket first response when missing", async () => {
    await replyToHelpConversation(
      conversationId,
      "Initial recorded reply",
      undefined,
      tenantId,
      null,
      actorStaffId,
    );

    const detail = await getHelpConversationDetail(conversationId, tenantId, null, actorStaffId);
    expect(detail?.ticket.status).toBe("waiting_on_customer");

    const messages = await db.select().from(helpMessages).where(eq(helpMessages.conversationId, conversationId));
    expect(messages.filter((message) => message.messageType === "teammate")).toHaveLength(1);

    const [{ firstResponseAt, status }] = await db.select({
      firstResponseAt: helpTickets.firstResponseAt,
      status: helpTickets.status,
    }).from(helpTickets).where(eq(helpTickets.conversationId, conversationId));
    expect(status).toBe("waiting_on_customer");
    expect(firstResponseAt).not.toBeNull();
  });

  it("reply cannot change deleted conversations", async () => {
    await updateHelpConversationSoftDeleteState(
      conversationId,
      true,
      "cleanup",
      tenantId,
      null,
      actorStaffId,
    );

    const beforeMessages = await db.select().from(helpMessages).where(eq(helpMessages.conversationId, conversationId));
    const replyDetail = await replyToHelpConversation(
      conversationId,
      "Should not be recorded",
      undefined,
      tenantId,
      null,
      actorStaffId,
    );
    expect(replyDetail).toBeNull();

    const [conversation] = await db.select().from(helpConversations).where(eq(helpConversations.id, conversationId));
    const afterMessages = await db.select().from(helpMessages).where(eq(helpMessages.conversationId, conversationId));
    expect(conversation?.visibilityStatus).toBe("deleted");
    expect(afterMessages).toHaveLength(beforeMessages.length);
    expect(afterMessages.filter((message) => message.messageType === "teammate")).toHaveLength(0);
  });

  it("repeated soft-delete preserves the original visibility state for restore", async () => {
    await updateHelpConversationArchiveState(
      conversationId,
      true,
      tenantId,
      null,
      actorStaffId,
    );

    const firstDelete = await updateHelpConversationSoftDeleteState(
      conversationId,
      true,
      "cleanup",
      tenantId,
      null,
      actorStaffId,
    );
    const secondDelete = await updateHelpConversationSoftDeleteState(
      conversationId,
      true,
      "cleanup again",
      tenantId,
      null,
      actorStaffId,
    );
    const restoredDetail = await updateHelpConversationSoftDeleteState(
      conversationId,
      false,
      null,
      tenantId,
      null,
      actorStaffId,
    );

    expect(firstDelete?.mailbox.visibilityStatus).toBe("deleted");
    expect(secondDelete?.mailbox.visibilityStatus).toBe("deleted");
    expect(restoredDetail?.mailbox.visibilityStatus).toBe("archived");

    const [conversation] = await db.select().from(helpConversations).where(eq(helpConversations.id, conversationId));
    expect(conversation?.visibilityStatus).toBe("archived");
    expect(conversation?.previousVisibilityStatus).toBeNull();
  });

  it("archive/spam restore flags do not cross-restore other visibility states", async () => {
    const spammedDetail = await updateHelpConversationSpamState(
      conversationId,
      true,
      tenantId,
      null,
      actorStaffId,
    );
    const archiveRestoreAttempt = await updateHelpConversationArchiveState(
      conversationId,
      false,
      tenantId,
      null,
      actorStaffId,
    );

    expect(spammedDetail?.mailbox.visibilityStatus).toBe("spam");
    expect(archiveRestoreAttempt?.mailbox.visibilityStatus).toBe("spam");

    let [conversation] = await db.select().from(helpConversations).where(eq(helpConversations.id, conversationId));
    expect(conversation?.visibilityStatus).toBe("spam");

    await updateHelpConversationArchiveState(
      conversationId,
      true,
      tenantId,
      null,
      actorStaffId,
    );
    const spamRestoreAttempt = await updateHelpConversationSpamState(
      conversationId,
      false,
      tenantId,
      null,
      actorStaffId,
    );

    expect(spamRestoreAttempt?.mailbox.visibilityStatus).toBe("archived");

    [conversation] = await db.select().from(helpConversations).where(eq(helpConversations.id, conversationId));
    expect(conversation?.visibilityStatus).toBe("archived");
  });
});
