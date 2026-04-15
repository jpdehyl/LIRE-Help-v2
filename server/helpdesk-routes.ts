import { Router } from "express";
import { DEFAULT_INBOX_VIEW_KEY, inboxViewKeys } from "../shared/helpdesk.js";
import { requireStaff } from "./middleware/auth.js";
import {
  addHelpConversationInternalNote,
  getHelpConversationDetail,
  getHelpInboxConversations,
  getHelpInboxNavigation,
  getHelpdeskDashboardMetrics,
  updateHelpConversationAssignee,
  updateHelpConversationPriority,
  updateHelpConversationStatus,
} from "./storage.js";
import type { ConversationStatus, InboxViewKey, PriorityLevel } from "../shared/helpdesk.js";

const router = Router();
const validStatuses = new Set<ConversationStatus>(["open", "pending", "waiting_on_customer", "resolved"]);
const validPriorities = new Set<PriorityLevel>(["low", "medium", "high", "urgent"]);

function coerceViewKey(raw: unknown): InboxViewKey {
  if (typeof raw === "string" && inboxViewKeys.includes(raw as InboxViewKey)) {
    return raw as InboxViewKey;
  }
  return DEFAULT_INBOX_VIEW_KEY;
}

router.use(requireStaff);

router.get("/inbox/navigation", async (req, res) => {
  try {
    const sess = req.session as any;
    const views = await getHelpInboxNavigation(sess?.staffTenantId ?? null, sess?.staffPropertyId ?? null, sess?.staffId ?? null);
    res.json({ views, defaultViewKey: DEFAULT_INBOX_VIEW_KEY });
  } catch (err) {
    console.error("[helpdesk inbox navigation]", err);
    res.status(500).json({ message: "Error fetching inbox navigation" });
  }
});

router.get("/inbox/conversations", async (req, res) => {
  try {
    const sess = req.session as any;
    const view = coerceViewKey(req.query["view"]);
    const conversations = await getHelpInboxConversations(view, sess?.staffTenantId ?? null, sess?.staffPropertyId ?? null, sess?.staffId ?? null);
    res.json({ view, conversations });
  } catch (err) {
    console.error("[helpdesk inbox conversations]", err);
    res.status(500).json({ message: "Error fetching conversations" });
  }
});

router.get("/inbox/conversations/:conversationId", async (req, res) => {
  try {
    const sess = req.session as any;
    const conversationId = req.params["conversationId"] as string;
    const detail = await getHelpConversationDetail(conversationId, sess?.staffTenantId ?? null, sess?.staffPropertyId ?? null, sess?.staffId ?? null);
    if (!detail) {
      return res.status(404).json({ message: "Conversation not found" });
    }
    return res.json(detail);
  } catch (err) {
    console.error("[helpdesk conversation detail]", err);
    return res.status(500).json({ message: "Error fetching conversation detail" });
  }
});

router.patch("/inbox/conversations/:conversationId/assignee", async (req, res) => {
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

router.patch("/inbox/conversations/:conversationId/status", async (req, res) => {
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

router.patch("/inbox/conversations/:conversationId/priority", async (req, res) => {
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

router.post("/inbox/conversations/:conversationId/notes", async (req, res) => {
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

export default router;
