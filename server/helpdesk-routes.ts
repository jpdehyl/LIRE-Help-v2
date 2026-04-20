import { Router } from "express";
import { DEFAULT_INBOX_VIEW_KEY, inboxViewKeys } from "../shared/helpdesk.js";
import { requireAdmin, requireStaff, requireStaffRole } from "./middleware/auth.js";

const HELPDESK_AGENT_ROLES = ["superadmin", "owner", "manager", "staff"] as const;
import {
  addHelpConversationInternalNote,
  addHelpConversationTag,
  getHelpConversationDetail,
  getHelpInboxConversations,
  getHelpInboxNavigation,
  getHelpdeskDashboardMetrics,
  getPropertiesSummary,
  replyToHelpConversation,
  removeHelpConversationTag,
  tenantOwnsProperty,
  updateHelpConversationArchiveState,
  updateHelpConversationAssignee,
  updateHelpConversationPriority,
  updateHelpConversationSoftDeleteState,
  updateHelpConversationSnooze,
  updateHelpConversationSpamState,
  updateHelpConversationStatus,
} from "./storage.js";
import type { ConversationStatus, InboxViewKey, PriorityLevel } from "../shared/helpdesk.js";

const router = Router();
const validStatuses = new Set<ConversationStatus>(["open", "pending", "waiting_on_customer", "resolved"]);
const validPriorities = new Set<PriorityLevel>(["low", "medium", "high", "urgent"]);
const adminRoles = new Set(["superadmin", "owner", "manager"]);

function isAdminSession(session: any): boolean {
  return typeof session?.staffRole === "string" && adminRoles.has(session.staffRole);
}

function coerceViewKey(raw: unknown): InboxViewKey {
  if (typeof raw === "string" && inboxViewKeys.includes(raw as InboxViewKey)) {
    return raw as InboxViewKey;
  }
  return DEFAULT_INBOX_VIEW_KEY;
}

function parseSnoozedUntil(raw: unknown): { value: string | null } | { error: string } {
  if (raw === null) return { value: null };
  if (typeof raw !== "string") return { error: "Invalid snoozedUntil" };
  const trimmed = raw.trim();
  if (!trimmed) return { error: "Invalid snoozedUntil" };
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return { error: "Invalid snoozedUntil" };
  if (date.getTime() <= Date.now()) return { error: "snoozedUntil must be in the future" };
  if (date.toISOString() !== trimmed) return { error: "snoozedUntil must be a valid ISO timestamp" };
  return { value: trimmed };
}

router.use(requireStaff);

router.get("/inbox/navigation", async (req, res) => {
  try {
    const sess = req.session as any;
    const filterPropertyId = typeof req.query["propertyId"] === "string" && req.query["propertyId"] ? req.query["propertyId"] : null;
    const tenantId = sess?.staffTenantId ?? null;
    const sessionPropertyId = sess?.staffPropertyId ?? null;

    if (filterPropertyId) {
      if (sessionPropertyId && sessionPropertyId !== filterPropertyId) {
        return res.status(403).json({ message: "Property out of scope" });
      }
      if (!tenantId || !(await tenantOwnsProperty(tenantId, filterPropertyId))) {
        return res.status(403).json({ message: "Unknown property for this tenant" });
      }
    }

    const views = await getHelpInboxNavigation(tenantId, sessionPropertyId, sess?.staffId ?? null, filterPropertyId);
    const visibleViews = isAdminSession(sess) ? views : views.filter((view) => view.key !== "trash");
    res.json({ views: visibleViews, defaultViewKey: DEFAULT_INBOX_VIEW_KEY });
  } catch (err) {
    console.error("[helpdesk inbox navigation]", err);
    res.status(500).json({ message: "Error fetching inbox navigation" });
  }
});

router.get("/inbox/conversations", async (req, res) => {
  try {
    const sess = req.session as any;
    const view = coerceViewKey(req.query["view"]);
    if (view === "trash" && !isAdminSession(sess)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    const filterPropertyId = typeof req.query["propertyId"] === "string" && req.query["propertyId"] ? req.query["propertyId"] : null;
    const tenantId = sess?.staffTenantId ?? null;
    const sessionPropertyId = sess?.staffPropertyId ?? null;

    if (filterPropertyId) {
      if (sessionPropertyId && sessionPropertyId !== filterPropertyId) {
        return res.status(403).json({ message: "Property out of scope" });
      }
      if (!tenantId || !(await tenantOwnsProperty(tenantId, filterPropertyId))) {
        return res.status(403).json({ message: "Unknown property for this tenant" });
      }
    }

    const conversations = await getHelpInboxConversations(view, tenantId, sessionPropertyId, sess?.staffId ?? null, filterPropertyId);
    return res.json({ view, conversations });
  } catch (err) {
    console.error("[helpdesk inbox conversations]", err);
    return res.status(500).json({ message: "Error fetching conversations" });
  }
});

router.get("/inbox/conversations/:conversationId", async (req, res) => {
  try {
    const sess = req.session as any;
    const conversationId = req.params["conversationId"] as string;
    const detail = await getHelpConversationDetail(conversationId, sess?.staffTenantId ?? null, sess?.staffPropertyId ?? null, sess?.staffId ?? null);
    if (!detail || (detail.mailbox.visibilityStatus === "deleted" && !isAdminSession(sess))) {
      return res.status(404).json({ message: "Conversation not found" });
    }
    return res.json(detail);
  } catch (err) {
    console.error("[helpdesk conversation detail]", err);
    return res.status(500).json({ message: "Error fetching conversation detail" });
  }
});

router.patch("/inbox/conversations/:conversationId/assignee", requireStaffRole(...HELPDESK_AGENT_ROLES), async (req, res) => {
  try {
    const sess = req.session as any;
    const conversationId = req.params["conversationId"] as string;
    const assigneeStaffId = typeof req.body?.assigneeStaffId === "string" && req.body.assigneeStaffId.trim().length > 0
      ? req.body.assigneeStaffId
      : null;
    const detail = await updateHelpConversationAssignee(conversationId, assigneeStaffId, sess?.staffTenantId ?? null, sess?.staffPropertyId ?? null, sess?.staffId ?? null);
    if (!detail) {
      return res.status(404).json({ message: "Conversation not found" });
    }
    return res.json(detail);
  } catch (err) {
    console.error("[helpdesk assignee update]", err);
    return res.status(500).json({ message: "Error updating assignee" });
  }
});

router.patch("/inbox/conversations/:conversationId/status", requireStaffRole(...HELPDESK_AGENT_ROLES), async (req, res) => {
  try {
    const sess = req.session as any;
    const conversationId = req.params["conversationId"] as string;
    const status = req.body?.status;
    if (typeof status !== "string" || !validStatuses.has(status as ConversationStatus)) {
      return res.status(400).json({ message: "Invalid status" });
    }
    const detail = await updateHelpConversationStatus(conversationId, status as ConversationStatus, sess?.staffTenantId ?? null, sess?.staffPropertyId ?? null, sess?.staffId ?? null);
    if (!detail) {
      return res.status(404).json({ message: "Conversation not found" });
    }
    return res.json(detail);
  } catch (err) {
    console.error("[helpdesk status update]", err);
    return res.status(500).json({ message: "Error updating status" });
  }
});

router.patch("/inbox/conversations/:conversationId/priority", requireStaffRole(...HELPDESK_AGENT_ROLES), async (req, res) => {
  try {
    const sess = req.session as any;
    const conversationId = req.params["conversationId"] as string;
    const priority = req.body?.priority;
    if (typeof priority !== "string" || !validPriorities.has(priority as PriorityLevel)) {
      return res.status(400).json({ message: "Invalid priority" });
    }
    const detail = await updateHelpConversationPriority(conversationId, priority as PriorityLevel, sess?.staffTenantId ?? null, sess?.staffPropertyId ?? null, sess?.staffId ?? null);
    if (!detail) {
      return res.status(404).json({ message: "Conversation not found" });
    }
    return res.json(detail);
  } catch (err) {
    console.error("[helpdesk priority update]", err);
    return res.status(500).json({ message: "Error updating priority" });
  }
});

router.post("/inbox/conversations/:conversationId/tags", requireStaffRole(...HELPDESK_AGENT_ROLES), async (req, res) => {
  try {
    const sess = req.session as any;
    const conversationId = req.params["conversationId"] as string;
    const tagId = typeof req.body?.tagId === "string" ? req.body.tagId.trim() : "";
    if (!tagId) {
      return res.status(400).json({ message: "Invalid tagId" });
    }
    const detail = await addHelpConversationTag(conversationId, tagId, sess?.staffTenantId ?? null, sess?.staffPropertyId ?? null, sess?.staffId ?? null);
    if (!detail) {
      return res.status(404).json({ message: "Conversation or tag not found" });
    }
    return res.status(201).json(detail);
  } catch (err) {
    console.error("[helpdesk tag add]", err);
    return res.status(500).json({ message: "Error adding tag" });
  }
});

router.delete("/inbox/conversations/:conversationId/tags/:tagId", requireStaffRole(...HELPDESK_AGENT_ROLES), async (req, res) => {
  try {
    const sess = req.session as any;
    const conversationId = req.params["conversationId"] as string;
    const tagId = typeof req.params["tagId"] === "string" ? req.params["tagId"].trim() : "";
    if (!tagId) {
      return res.status(400).json({ message: "Invalid tagId" });
    }
    const detail = await removeHelpConversationTag(conversationId, tagId, sess?.staffTenantId ?? null, sess?.staffPropertyId ?? null, sess?.staffId ?? null);
    if (!detail) {
      return res.status(404).json({ message: "Conversation or tag not found" });
    }
    return res.json(detail);
  } catch (err) {
    console.error("[helpdesk tag remove]", err);
    return res.status(500).json({ message: "Error removing tag" });
  }
});

router.patch("/inbox/conversations/:conversationId/snooze", requireStaffRole(...HELPDESK_AGENT_ROLES), async (req, res) => {
  try {
    const sess = req.session as any;
    const conversationId = req.params["conversationId"] as string;
    const parsed = parseSnoozedUntil(req.body?.snoozedUntil);
    if ("error" in parsed) {
      return res.status(400).json({ message: parsed.error });
    }
    const detail = await updateHelpConversationSnooze(conversationId, parsed.value, sess?.staffTenantId ?? null, sess?.staffPropertyId ?? null, sess?.staffId ?? null);
    if (!detail) {
      return res.status(404).json({ message: "Conversation not found" });
    }
    return res.json(detail);
  } catch (err) {
    console.error("[helpdesk snooze update]", err);
    return res.status(500).json({ message: "Error updating snooze" });
  }
});

router.patch("/inbox/conversations/:conversationId/archive", requireStaffRole(...HELPDESK_AGENT_ROLES), async (req, res) => {
  try {
    const sess = req.session as any;
    const conversationId = req.params["conversationId"] as string;
    const archived = req.body?.archived;
    if (typeof archived !== "boolean") {
      return res.status(400).json({ message: "Invalid archived flag" });
    }
    const detail = await updateHelpConversationArchiveState(conversationId, archived, sess?.staffTenantId ?? null, sess?.staffPropertyId ?? null, sess?.staffId ?? null);
    if (!detail) {
      return res.status(404).json({ message: "Conversation not found" });
    }
    return res.json(detail);
  } catch (err) {
    console.error("[helpdesk archive update]", err);
    return res.status(500).json({ message: "Error updating archive state" });
  }
});

router.patch("/inbox/conversations/:conversationId/spam", requireStaffRole(...HELPDESK_AGENT_ROLES), async (req, res) => {
  try {
    const sess = req.session as any;
    const conversationId = req.params["conversationId"] as string;
    const spam = req.body?.spam;
    if (typeof spam !== "boolean") {
      return res.status(400).json({ message: "Invalid spam flag" });
    }
    const detail = await updateHelpConversationSpamState(conversationId, spam, sess?.staffTenantId ?? null, sess?.staffPropertyId ?? null, sess?.staffId ?? null);
    if (!detail) {
      return res.status(404).json({ message: "Conversation not found" });
    }
    return res.json(detail);
  } catch (err) {
    console.error("[helpdesk spam update]", err);
    return res.status(500).json({ message: "Error updating spam state" });
  }
});

router.patch("/inbox/conversations/:conversationId/soft-delete", requireAdmin, async (req, res) => {
  try {
    const sess = req.session as any;
    const conversationId = req.params["conversationId"] as string;
    const deleted = req.body?.deleted;
    if (typeof deleted !== "boolean") {
      return res.status(400).json({ message: "Invalid deleted flag" });
    }
    const deleteReason = typeof req.body?.deleteReason === "string" && req.body.deleteReason.trim().length > 0
      ? req.body.deleteReason.trim()
      : null;
    const detail = await updateHelpConversationSoftDeleteState(conversationId, deleted, deleteReason, sess?.staffTenantId ?? null, sess?.staffPropertyId ?? null, sess?.staffId ?? null);
    if (!detail) {
      return res.status(404).json({ message: "Conversation not found" });
    }
    return res.json(detail);
  } catch (err) {
    console.error("[helpdesk soft delete update]", err);
    return res.status(500).json({ message: "Error updating soft delete state" });
  }
});

router.post("/inbox/conversations/:conversationId/notes", requireStaffRole(...HELPDESK_AGENT_ROLES), async (req, res) => {
  try {
    const sess = req.session as any;
    const conversationId = req.params["conversationId"] as string;
    const body = typeof req.body?.body === "string" ? req.body.body : "";
    if (!body.trim()) {
      return res.status(400).json({ message: "Note body is required" });
    }
    const detail = await addHelpConversationInternalNote(conversationId, body, sess?.staffTenantId ?? null, sess?.staffPropertyId ?? null, sess?.staffId ?? null);
    if (!detail) {
      return res.status(404).json({ message: "Conversation not found" });
    }
    return res.status(201).json(detail);
  } catch (err) {
    console.error("[helpdesk note create]", err);
    return res.status(500).json({ message: "Error adding internal note" });
  }
});

router.post("/inbox/conversations/:conversationId/replies", requireStaffRole(...HELPDESK_AGENT_ROLES), async (req, res) => {
  try {
    const sess = req.session as any;
    const conversationId = req.params["conversationId"] as string;
    const body = typeof req.body?.body === "string" ? req.body.body : "";
    if (!body.trim()) {
      return res.status(400).json({ message: "Reply body is required" });
    }

    const rawStatus = req.body?.status;
    if (rawStatus != null && (typeof rawStatus !== "string" || !validStatuses.has(rawStatus as ConversationStatus))) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const detail = await replyToHelpConversation(
      conversationId,
      body,
      rawStatus == null ? undefined : rawStatus as ConversationStatus,
      sess?.staffTenantId ?? null,
      sess?.staffPropertyId ?? null,
      sess?.staffId ?? null,
    );
    if (!detail) {
      return res.status(404).json({ message: "Conversation not found" });
    }
    return res.status(201).json(detail);
  } catch (err) {
    console.error("[helpdesk reply create]", err);
    return res.status(500).json({ message: "Error recording reply" });
  }
});

router.get("/dashboard/metrics", async (req, res) => {
  try {
    const sess = req.session as any;
    const metrics = await getHelpdeskDashboardMetrics(sess?.staffTenantId ?? null, sess?.staffPropertyId ?? null, sess?.staffId ?? null);
    return res.json(metrics);
  } catch (err) {
    console.error("[helpdesk dashboard metrics]", err);
    return res.status(500).json({ message: "Error fetching dashboard metrics" });
  }
});

router.get("/properties-summary", async (req, res) => {
  try {
    const sess = req.session as any;
    const summary = await getPropertiesSummary(sess?.staffTenantId ?? null);
    return res.json({ properties: summary });
  } catch (err) {
    console.error("[helpdesk properties summary]", err);
    return res.status(500).json({ message: "Error fetching properties summary" });
  }
});

export default router;
