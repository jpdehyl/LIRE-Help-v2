import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Archive,
  Building2,
  Clock3,
  Flag,
  MessageSquare,
  Reply as ReplyIcon,
  ShieldAlert,
  Sparkles,
  Trash2,
  User,
  X,
  type LucideIcon,
} from "lucide-react";
import { conciergeApi, helpdeskApi } from "../../lib/helpdesk";
import type { ConciergeStreamEvent, ConciergeTryToolCall } from "../../lib/helpdesk";
import type {
  ConversationDetail,
  ConversationRow,
  ConversationStatus,
  PriorityLevel,
} from "./types";
import {
  Badge,
  Button,
  EmptyState,
  PriorityBadge,
  Select,
  SlaBadge,
  StatusBadge,
  Textarea,
} from "../ui";

interface ConversationDetailProps {
  conversation: ConversationRow | undefined;
  detail: ConversationDetail | undefined;
  detailLoading?: boolean;
  onMutated?: () => Promise<void> | void;
}

type RightPanelKey = "reply" | "ai" | "ticket" | "tenant" | "property";

const timelineKinds = {
  occupant: { eyebrow: "Tenant", barColor: "" },
  teammate: { eyebrow: "Teammate", barColor: "" },
  internal_note: { eyebrow: "Internal note", barColor: "var(--accent-press)" },
  system: { eyebrow: "System", barColor: "" },
} as const;

const statuses: ConversationStatus[] = ["open", "pending", "waiting_on_occupant", "resolved"];
const priorities: PriorityLevel[] = ["low", "medium", "high", "urgent"];
const snoozePresets = [
  { value: "1h", label: "In 1 hour" },
  { value: "4h", label: "In 4 hours" },
  { value: "tomorrow", label: "Tomorrow morning" },
  { value: "next_week", label: "Next week" },
] as const;

type SnoozePresetValue = (typeof snoozePresets)[number]["value"];

type ConciergeMilestone = { key: string; detail: string };
type ConciergeLiveToolCall = ConciergeTryToolCall & { status: "running" | "completed" };

const conciergeMilestoneLabels: Record<string, string> = {
  accepted: "Request received",
  session_ready: "Session ready",
  agent_connected: "Agent connected",
  message_sent: "Message delivered",
  thinking: "Reviewing context",
  tool_requested: "Tool requested",
  drafting: "Drafting reply",
  escalation_flagged: "Escalation flagged",
  wrapping_up: "Wrapping up",
  completed: "Complete",
};

function buildSnoozeTimestamp(preset: SnoozePresetValue): string {
  const now = new Date();
  switch (preset) {
    case "1h": {
      const next = new Date(now);
      next.setHours(next.getHours() + 1);
      return next.toISOString();
    }
    case "4h": {
      const next = new Date(now);
      next.setHours(next.getHours() + 4);
      return next.toISOString();
    }
    case "tomorrow": {
      const next = new Date(now);
      next.setDate(next.getDate() + 1);
      next.setHours(9, 0, 0, 0);
      return next.toISOString();
    }
    case "next_week": {
      const next = new Date(now);
      next.setDate(next.getDate() + 7);
      next.setHours(9, 0, 0, 0);
      return next.toISOString();
    }
  }
}

export function ConversationDetailPane({
  conversation,
  detail,
  detailLoading = false,
  onMutated,
}: ConversationDetailProps) {
  const [note, setNote] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [replyStatus, setReplyStatus] = useState<ConversationStatus>("waiting_on_occupant");
  const [composerMode, setComposerMode] = useState<"reply" | "note">("reply");
  const [activePanel, setActivePanel] = useState<RightPanelKey | null>("ai");
  const [aiDraft, setAiDraft] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiEscalate, setAiEscalate] = useState(false);
  const [aiSessionId, setAiSessionId] = useState<string | null>(null);
  const [aiMilestones, setAiMilestones] = useState<ConciergeMilestone[]>([]);
  const [aiToolCalls, setAiToolCalls] = useState<ConciergeLiveToolCall[]>([]);
  const [aiPartialReply, setAiPartialReply] = useState<string | null>(null);
  const [aiStartedAt, setAiStartedAt] = useState<number | null>(null);
  const [aiElapsedMs, setAiElapsedMs] = useState(0);
  const [selectedTagId, setSelectedTagId] = useState("");
  const [selectedSnoozePreset, setSelectedSnoozePreset] = useState("");
  const activeConversationIdRef = useRef<string | null>(null);
  const aiAbortRef = useRef<AbortController | null>(null);
  const availableAssignees = detail?.availableAssignees ?? [];
  const availableTags = detail?.availableTags ?? [];
  const attachedTagOptions = useMemo(
    () => availableTags.filter((tag) => detail?.ticket.tags.includes(tag.name)),
    [availableTags, detail?.ticket.tags],
  );
  const attachableTags = useMemo(
    () => availableTags.filter((tag) => !detail?.ticket.tags.includes(tag.name)),
    [availableTags, detail?.ticket.tags],
  );

  const conversationId = conversation?.id ?? null;
  useEffect(() => {
    activeConversationIdRef.current = conversationId;
    aiAbortRef.current?.abort();
    aiAbortRef.current = null;
    setNote("");
    setReplyBody("");
    setReplyStatus("waiting_on_occupant");
    setComposerMode(detail?.composerMode === "note" ? "note" : "reply");
    setAiDraft(null);
    setAiError(null);
    setAiLoading(false);
    setAiEscalate(false);
    setAiSessionId(null);
    setAiMilestones([]);
    setAiToolCalls([]);
    setAiPartialReply(null);
    setAiStartedAt(null);
    setAiElapsedMs(0);
    setSelectedTagId("");
    setSelectedSnoozePreset("");
  }, [conversationId, detail?.composerMode]);

  useEffect(() => {
    setSelectedTagId((current) => {
      if (current && attachableTags.some((tag) => tag.id === current)) return current;
      return attachableTags[0]?.id ?? "";
    });
  }, [attachableTags]);

  useEffect(() => {
    if (!aiLoading || !aiStartedAt) return undefined;
    setAiElapsedMs(Date.now() - aiStartedAt);
    const timer = window.setInterval(() => setAiElapsedMs(Date.now() - aiStartedAt), 1000);
    return () => window.clearInterval(timer);
  }, [aiLoading, aiStartedAt]);

  const regenerateDraft = async () => {
    if (!conversation || !detail || aiLoading) return;
    const requestId = conversation.id;
    const startedAt = Date.now();
    aiAbortRef.current?.abort();
    const controller = new AbortController();
    aiAbortRef.current = controller;
    setAiLoading(true);
    setAiError(null);
    setAiDraft(null);
    setAiEscalate(false);
    setAiSessionId(null);
    setAiMilestones([{ key: "accepted", detail: "Draft request received." }]);
    setAiToolCalls([]);
    setAiPartialReply(null);
    setAiStartedAt(startedAt);
    setAiElapsedMs(0);
    try {
      await conciergeApi.draftReplyStream(
        requestId,
        async (event: ConciergeStreamEvent) => {
          if (activeConversationIdRef.current !== requestId) return;
          if (event.sessionId) setAiSessionId(event.sessionId);
          if (event.type === "ack" || event.type === "milestone") {
            const key = event.milestone ?? event.type;
            const detail = event.detail ?? conciergeMilestoneLabels[key] ?? "Concierge updated its status.";
            setAiMilestones((prev) => (prev.some((item) => item.key === key && item.detail === detail) ? prev : [...prev, { key, detail }]));
            return;
          }
          if (event.type === "tool" && event.toolCall) {
            const toolCall = event.toolCall;
            setAiToolCalls((prev) => {
              const next = prev.filter((item) => item.id !== toolCall.id);
              return [...next, toolCall];
            });
            return;
          }
          if (event.type === "partial_reply") {
            setAiPartialReply((event.reply || "").trim() || null);
            return;
          }
          if (event.type === "complete" && event.response) {
            setAiDraft((event.response.reply || "").trim() || null);
            setAiPartialReply((event.response.reply || "").trim() || null);
            setAiEscalate(!!event.response.escalated);
            setAiToolCalls(event.response.toolCalls.map((call) => ({ ...call, status: "completed" as const })));
            return;
          }
          if (event.type === "error") {
            throw new Error(event.message || "Draft request failed.");
          }
        },
        controller.signal,
      );
    } catch (err) {
      if (controller.signal.aborted || activeConversationIdRef.current !== requestId) return;
      setAiError(err instanceof Error ? err.message : "Draft request failed.");
    } finally {
      if (aiAbortRef.current === controller) aiAbortRef.current = null;
      if (activeConversationIdRef.current === requestId) {
        setAiElapsedMs(Date.now() - startedAt);
        setAiLoading(false);
      }
    }
  };

  const assigneeMutation = useMutation({
    mutationFn: (assigneeStaffId: string | null) => helpdeskApi.updateAssignee(conversation!.id, assigneeStaffId),
    onSuccess: async () => {
      await onMutated?.();
    },
  });

  const statusMutation = useMutation({
    mutationFn: (status: ConversationStatus) => helpdeskApi.updateStatus(conversation!.id, status),
    onSuccess: async () => {
      await onMutated?.();
    },
  });

  const priorityMutation = useMutation({
    mutationFn: (priority: PriorityLevel) => helpdeskApi.updatePriority(conversation!.id, priority),
    onSuccess: async () => {
      await onMutated?.();
    },
  });

  const noteMutation = useMutation({
    mutationFn: (body: string) => helpdeskApi.addInternalNote(conversation!.id, body),
    onSuccess: async () => {
      setNote("");
      setComposerMode("note");
      await onMutated?.();
    },
  });

  const replyMutation = useMutation({
    mutationFn: ({ body, status }: { body: string; status: ConversationStatus }) =>
      helpdeskApi.replyToConversation(conversation!.id, body, status),
    onSuccess: async () => {
      setReplyBody("");
      setReplyStatus("waiting_on_occupant");
      setComposerMode("reply");
      await onMutated?.();
    },
  });

  const addTagMutation = useMutation({
    mutationFn: (tagId: string) => helpdeskApi.addTag(conversation!.id, tagId),
    onSuccess: async () => {
      setSelectedTagId("");
      await onMutated?.();
    },
  });

  const removeTagMutation = useMutation({
    mutationFn: (tagId: string) => helpdeskApi.removeTag(conversation!.id, tagId),
    onSuccess: async () => {
      await onMutated?.();
    },
  });

  const snoozeMutation = useMutation({
    mutationFn: (snoozedUntil: string | null) => helpdeskApi.updateSnooze(conversation!.id, snoozedUntil),
    onSuccess: async () => {
      setSelectedSnoozePreset("");
      await onMutated?.();
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (archived: boolean) => helpdeskApi.updateArchiveState(conversation!.id, archived),
    onSuccess: async () => {
      await onMutated?.();
    },
  });

  const spamMutation = useMutation({
    mutationFn: (spam: boolean) => helpdeskApi.updateSpamState(conversation!.id, spam),
    onSuccess: async () => {
      await onMutated?.();
    },
  });

  const softDeleteMutation = useMutation({
    mutationFn: ({ deleted, deleteReason }: { deleted: boolean; deleteReason?: string | null }) =>
      helpdeskApi.updateSoftDeleteState(conversation!.id, deleted, deleteReason),
    onSuccess: async () => {
      await onMutated?.();
    },
  });

  if (detailLoading && conversation) {
    return (
      <EmptyState
        tone="muted"
        title="Loading conversation"
        description="Pulling message history, ticket state, and tenant context from the helpdesk API."
      />
    );
  }

  if (!conversation || !detail) {
    return (
      <EmptyState
        tone="muted"
        icon={MessageSquare}
        title="Select a conversation"
        description="Pick a ticket to see its timeline, ticket state, and next actions."
      />
    );
  }

  const mutationError =
    assigneeMutation.error
    ?? statusMutation.error
    ?? priorityMutation.error
    ?? addTagMutation.error
    ?? removeTagMutation.error
    ?? snoozeMutation.error
    ?? archiveMutation.error
    ?? spamMutation.error
    ?? softDeleteMutation.error
    ?? replyMutation.error
    ?? noteMutation.error;
  const isBusy =
    assigneeMutation.isPending
    || statusMutation.isPending
    || priorityMutation.isPending
    || addTagMutation.isPending
    || removeTagMutation.isPending
    || snoozeMutation.isPending
    || archiveMutation.isPending
    || spamMutation.isPending
    || softDeleteMutation.isPending
    || replyMutation.isPending
    || noteMutation.isPending;

  const togglePanel = (panel: RightPanelKey) =>
    setActivePanel((current) => (current === panel ? null : panel));
  const isArchived = detail.mailbox.visibilityStatus === "archived";
  const isSpam = detail.mailbox.visibilityStatus === "spam";
  const isDeleted = detail.mailbox.visibilityStatus === "deleted";
  const canSnooze = !isDeleted && !isArchived && !isSpam;
  const mailboxStateLabel = detail.mailbox.visibilityStatus.replace(/_/g, " ");
  const deleteActionLabel = isDeleted ? "Restore" : "Move to trash";
  const deleteHelperLabel = isDeleted
    ? "Restore this conversation from trash."
    : "Soft delete this conversation. Admin-only.";

  const handleSoftDeleteClick = () => {
    if (!detail.mailbox.canSoftDelete) return;
    if (isDeleted) {
      softDeleteMutation.mutate({ deleted: false });
      return;
    }
    const response = window.prompt("Optional reason for moving this conversation to trash:", detail.mailbox.deleteReason ?? "");
    if (response === null) return;
    const trimmedReason = response.trim();
    softDeleteMutation.mutate({
      deleted: true,
      deleteReason: trimmedReason.length > 0 ? trimmedReason : null,
    });
  };

  return (
    <section className="flex h-full min-h-0 flex-1 min-w-0 bg-bg">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col border-r border-border bg-surface">
        <div className="border-b border-border px-5 py-3">
          <div className="flex flex-wrap items-start gap-2.5">
            <div className="min-w-0 flex-1">
              <div className="truncate font-body text-[14px] font-semibold text-fg">{detail.title}</div>
              <div className="truncate font-body text-[12px] text-fg-muted">{detail.summary}</div>
            </div>
            <PriorityBadge priority={detail.ticket.priority} />
            {detail.ticket.slaState !== "healthy" ? <SlaBadge sla={detail.ticket.slaState} /> : null}
            <StatusBadge status={detail.ticket.status} />
            <span className="font-mono text-[11px] text-fg-subtle">{conversation.ticket.id}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone={isDeleted ? "warning" : isSpam ? "warning" : isArchived ? "neutral" : "success"} size="sm">
              {mailboxStateLabel}
            </Badge>
            {detail.mailbox.snoozedUntilLabel ? (
              <Badge tone="neutral" size="sm">
                Snoozed until {detail.mailbox.snoozedUntilLabel}
              </Badge>
            ) : null}
            {detail.mailbox.deletedAtLabel ? (
              <Badge tone="warning" size="sm">
                Deleted {detail.mailbox.deletedAtLabel}
              </Badge>
            ) : null}
            <span className="flex-1" />
            <div className="flex min-w-[220px] items-center gap-2">
              <Select
                compact
                value={selectedSnoozePreset}
                onChange={(event) => setSelectedSnoozePreset(event.target.value)}
                disabled={isBusy || !canSnooze}
                className="min-w-0 flex-1"
              >
                <option value="">Snooze…</option>
                {snoozePresets.map((preset) => (
                  <option key={preset.value} value={preset.value}>
                    {preset.label}
                  </option>
                ))}
              </Select>
              <Button
                size="sm"
                variant="ghost"
                leftIcon={<Clock3 className="h-3.5 w-3.5" />}
                loading={snoozeMutation.isPending && Boolean(selectedSnoozePreset)}
                disabled={!selectedSnoozePreset || isBusy || !canSnooze}
                onClick={() => snoozeMutation.mutate(buildSnoozeTimestamp(selectedSnoozePreset as SnoozePresetValue))}
              >
                Snooze
              </Button>
            </div>
            {detail.mailbox.snoozedUntil ? (
              <Button
                size="sm"
                variant="ghost"
                loading={snoozeMutation.isPending && !selectedSnoozePreset}
                disabled={isBusy || !canSnooze}
                onClick={() => snoozeMutation.mutate(null)}
              >
                Unsnooze
              </Button>
            ) : null}
            <Button
              size="sm"
              variant={isArchived ? "secondary" : "ghost"}
              leftIcon={<Archive className="h-3.5 w-3.5" />}
              loading={archiveMutation.isPending}
              disabled={!detail.mailbox.canArchive || isBusy}
              onClick={() => archiveMutation.mutate(!isArchived)}
            >
              {isArchived ? "Unarchive" : "Archive"}
            </Button>
            <Button
              size="sm"
              variant={isSpam ? "secondary" : "ghost"}
              leftIcon={<ShieldAlert className="h-3.5 w-3.5" />}
              loading={spamMutation.isPending}
              disabled={!detail.mailbox.canSpam || isBusy}
              onClick={() => spamMutation.mutate(!isSpam)}
            >
              {isSpam ? "Unspam" : "Spam"}
            </Button>
            <Button
              size="sm"
              variant={isDeleted ? "secondary" : "danger"}
              leftIcon={<Trash2 className="h-3.5 w-3.5" />}
              loading={softDeleteMutation.isPending}
              disabled={!detail.mailbox.canSoftDelete || isBusy}
              onClick={handleSoftDeleteClick}
              title={deleteHelperLabel}
            >
              {deleteActionLabel}
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-5 py-4">
          {detail.timeline.length > 0 ? (
            detail.timeline.map((item) => {
              const kind = timelineKinds[item.type];
              const isInternal = item.type === "internal_note";
              const isConcierge = item.author?.toLowerCase().includes("concierge");
              const eyebrowLabel = isConcierge ? "LIRE Concierge" : kind.eyebrow;
              return (
                <article
                  key={item.id}
                  className={[
                    "rounded-sm border px-3.5 py-3",
                    isInternal
                      ? "border-[rgba(255,77,0,0.25)] bg-[rgba(255,77,0,0.06)]"
                      : isConcierge
                        ? "border-[rgba(255,77,0,0.2)] bg-surface"
                        : "border-border bg-surface",
                  ].join(" ")}
                  style={kind.barColor ? { borderLeft: `3px solid ${kind.barColor}` } : undefined}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="eyebrow"
                      style={{
                        color: isInternal || isConcierge ? "var(--accent-press)" : "var(--fg-muted)",
                      }}
                    >
                      {eyebrowLabel}
                    </span>
                    <span className="text-fg-subtle">·</span>
                    <span className="font-body text-[12px] font-medium text-fg">{item.author}</span>
                    <span className="flex-1" />
                    <span className="font-mono text-[10px] text-fg-subtle">{item.createdAtLabel}</span>
                  </div>
                  <p className="mt-1.5 whitespace-pre-wrap font-body text-[13.5px] leading-[1.6] text-fg">
                    {item.body}
                  </p>
                </article>
              );
            })
          ) : (
            <div className="rounded-sm border border-dashed border-border bg-surface-2 p-5 font-body text-[13px] text-fg-muted">
              No message history yet. Add an internal note to capture next steps.
            </div>
          )}
        </div>
      </div>

      {activePanel ? (
        <div className="flex min-h-0 w-[340px] shrink-0 flex-col border-r border-border bg-surface">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <span className="eyebrow flex-1 text-fg-subtle">{panelLabel(activePanel)}</span>
            <button
              type="button"
              onClick={() => setActivePanel(null)}
              aria-label="Close panel"
              className="grid h-6 w-6 place-items-center rounded-xs text-fg-muted transition-colors ease-ds duration-fast hover:bg-surface-2 hover:text-fg"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {activePanel === "reply" ? (
              <ReplyPanel
                channel={conversation.channel}
                mode={composerMode}
                onModeChange={setComposerMode}
                note={note}
                onNoteChange={setNote}
                noteBusy={noteMutation.isPending}
                onSubmitNote={() => noteMutation.mutate(note)}
                replyBody={replyBody}
                onReplyBodyChange={setReplyBody}
                replyStatus={replyStatus}
                onReplyStatusChange={setReplyStatus}
                replyBusy={replyMutation.isPending}
                canReply={detail.mailbox.canReply}
                canAddNote={!isDeleted}
                onSubmitReply={() => replyMutation.mutate({ body: replyBody, status: replyStatus })}
              />
            ) : null}

            {activePanel === "ai" ? (
              <AiConciergePanel
                aiDraft={aiDraft}
                aiLoading={aiLoading}
                aiError={aiError}
                aiEscalate={aiEscalate}
                aiSessionId={aiSessionId}
                aiMilestones={aiMilestones}
                aiToolCalls={aiToolCalls}
                aiPartialReply={aiPartialReply}
                aiElapsedMs={aiElapsedMs}
                onUseDraft={() => {
                  if (!aiDraft) return;
                  setReplyBody(aiDraft);
                  setReplyStatus("waiting_on_occupant");
                  setComposerMode("reply");
                  setActivePanel("reply");
                }}
                onRegenerate={regenerateDraft}
              />
            ) : null}

            {activePanel === "ticket" ? (
              <TicketDetailsPanel
                detail={detail}
                disabled={isBusy || isDeleted}
                snoozeDisabled={!canSnooze}
                assignees={availableAssignees}
                attachableTags={attachableTags}
                attachedTagOptions={attachedTagOptions}
                selectedTagId={selectedTagId}
                selectedSnoozePreset={selectedSnoozePreset}
                onSelectedTagIdChange={setSelectedTagId}
                onSelectedSnoozePresetChange={setSelectedSnoozePreset}
                onAssignee={(value) => assigneeMutation.mutate(value || null)}
                onStatus={(value) => statusMutation.mutate(value as ConversationStatus)}
                onPriority={(value) => priorityMutation.mutate(value as PriorityLevel)}
                onAddTag={() => addTagMutation.mutate(selectedTagId)}
                onRemoveTag={(tagId) => removeTagMutation.mutate(tagId)}
                onApplySnooze={() =>
                  snoozeMutation.mutate(buildSnoozeTimestamp(selectedSnoozePreset as SnoozePresetValue))}
                onClearSnooze={() => snoozeMutation.mutate(null)}
                addTagBusy={addTagMutation.isPending}
                removeTagBusy={removeTagMutation.isPending}
                snoozeBusy={snoozeMutation.isPending}
              />
            ) : null}

            {activePanel === "tenant" ? (
              <TenantPanel detail={detail} conversation={conversation} />
            ) : null}

            {activePanel === "property" ? (
              <PropertyPanel conversation={conversation} />
            ) : null}

            {mutationError instanceof Error ? (
              <p className="font-body text-[12px] text-error">{mutationError.message}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="flex w-11 shrink-0 flex-col gap-1 border-l border-border bg-bg py-2">
        <PanelIconButton icon={ReplyIcon} label="Reply / note" active={activePanel === "reply"} onClick={() => togglePanel("reply")} />
        <PanelIconButton icon={Sparkles} label="AI Concierge" active={activePanel === "ai"} onClick={() => togglePanel("ai")} />
        <PanelIconButton icon={Flag} label="Ticket details" active={activePanel === "ticket"} onClick={() => togglePanel("ticket")} />
        <PanelIconButton icon={User} label="Tenant" active={activePanel === "tenant"} onClick={() => togglePanel("tenant")} />
        <PanelIconButton icon={Building2} label="Property" active={activePanel === "property"} onClick={() => togglePanel("property")} />
      </div>
    </section>
  );
}

function panelLabel(panel: RightPanelKey): string {
  switch (panel) {
    case "reply":
      return "Reply";
    case "ai":
      return "AI Concierge";
    case "ticket":
      return "Ticket details";
    case "tenant":
      return "Tenant";
    case "property":
      return "Property";
  }
}

function PanelIconButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={label}
      aria-label={label}
      className={[
        "mx-auto grid h-8 w-8 place-items-center rounded-sm border transition-colors ease-ds duration-fast",
        active
          ? "border-accent bg-surface-2 text-accent"
          : "border-transparent text-fg-muted hover:bg-surface-2 hover:text-fg",
      ].join(" ")}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

function ReplyPanel({
  channel,
  mode,
  onModeChange,
  note,
  onNoteChange,
  noteBusy,
  onSubmitNote,
  replyBody,
  onReplyBodyChange,
  replyStatus,
  onReplyStatusChange,
  replyBusy,
  canReply,
  canAddNote,
  onSubmitReply,
}: {
  channel: string;
  mode: "reply" | "note";
  onModeChange: (mode: "reply" | "note") => void;
  note: string;
  onNoteChange: (value: string) => void;
  noteBusy: boolean;
  onSubmitNote: () => void;
  replyBody: string;
  onReplyBodyChange: (value: string) => void;
  replyStatus: ConversationStatus;
  onReplyStatusChange: (value: ConversationStatus) => void;
  replyBusy: boolean;
  canReply: boolean;
  canAddNote: boolean;
  onSubmitReply: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5">
        {(["reply", "note"] as const).map((option) => (
          <Button
            key={option}
            size="sm"
            variant={mode === option ? "dark" : "ghost"}
            onClick={() => onModeChange(option)}
          >
            {option === "reply" ? "Reply" : "Internal note"}
          </Button>
        ))}
        <span className="flex-1" />
        <span className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-subtle">
          Sending via {channel}
        </span>
      </div>

      {mode === "reply" ? (
        <div className="rounded-sm border border-border bg-surface-2">
          <Textarea
            compact
            value={replyBody}
            onChange={(event) => onReplyBodyChange(event.target.value)}
            placeholder="Reply to the tenant…"
            disabled={replyBusy || !canReply}
            className="min-h-24 border-0 bg-transparent focus:bg-transparent"
            style={{ borderColor: "transparent" }}
          />
          <div className="flex flex-col gap-2 border-t border-border px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
              <span className="font-body text-[11px] text-fg-muted">After sending</span>
              <Select
                compact
                value={replyStatus}
                onChange={(event) => onReplyStatusChange(event.target.value as ConversationStatus)}
                disabled={replyBusy || !canReply}
                className="w-full sm:w-[220px]"
              >
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {status.replaceAll("_", " ")}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex items-center justify-between gap-2 sm:justify-end">
              <p className="font-body text-[11px] text-fg-muted">
                Recorded in-app only. No outbound email is sent in this phase.
              </p>
              <Button
                size="sm"
                variant="dark"
                loading={replyBusy}
                disabled={!replyBody.trim() || replyBusy || !canReply}
                onClick={onSubmitReply}
              >
                {replyBusy ? "Sending…" : "Send reply"}
              </Button>
            </div>
          </div>
          {!canReply ? (
            <p className="border-t border-border px-3 py-2 font-body text-[11px] text-fg-muted">
              Replies are disabled for deleted conversations.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="rounded-sm border border-[rgba(255,77,0,0.4)] bg-[rgba(255,77,0,0.04)]">
          <Textarea
            compact
            value={note}
            onChange={(event) => onNoteChange(event.target.value)}
            placeholder="Add context for the next operator, manager, or specialist…"
            disabled={noteBusy || !canAddNote}
            className="min-h-24 border-0 bg-transparent focus:bg-transparent"
            style={{ borderColor: "transparent" }}
          />
          <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-1.5">
            <p className="font-body text-[11px] text-fg-muted">
              {canAddNote ? "Internal notes stay in the operator timeline." : "Internal notes are disabled for deleted conversations."}
            </p>
            <Button
              size="sm"
              variant="dark"
              loading={noteBusy}
              disabled={!note.trim() || noteBusy || !canAddNote}
              onClick={onSubmitNote}
            >
              {noteBusy ? "Saving…" : "Add note"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function AiConciergePanel({
  aiDraft,
  aiLoading,
  aiError,
  aiEscalate,
  aiSessionId,
  aiMilestones,
  aiToolCalls,
  aiPartialReply,
  aiElapsedMs,
  onUseDraft,
  onRegenerate,
}: {
  aiDraft: string | null;
  aiLoading: boolean;
  aiError: string | null;
  aiEscalate: boolean;
  aiSessionId: string | null;
  aiMilestones: ConciergeMilestone[];
  aiToolCalls: ConciergeLiveToolCall[];
  aiPartialReply: string | null;
  aiElapsedMs: number;
  onUseDraft: () => void;
  onRegenerate: () => void;
}) {
  const visibleReply = aiDraft ?? aiPartialReply;

  return (
    <section className="rounded-sm bg-[#111111] p-3.5 text-[#FAFAFA]">
      <div className="flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 text-accent" />
        <div className="eyebrow text-[#FAFAFA]">Suggested next step</div>
        <span className="flex-1" />
        {aiSessionId ? <Badge tone="neutral" size="sm">{aiSessionId.slice(0, 10)}</Badge> : null}
        {visibleReply ? <Badge tone="success" size="sm">LIVE · CLAUDE</Badge> : null}
        {aiEscalate ? <Badge tone="warning" size="sm">ESCALATE</Badge> : null}
      </div>
      <div className="mt-2.5 font-body text-[12px] leading-[1.5] text-[rgba(255,255,255,0.72)]">
        {aiEscalate
          ? "Concierge flagged this for human escalation. Review the draft before sending."
          : aiLoading
            ? "Streaming progress from the live concierge run."
            : aiDraft
              ? "Drafted live from the platform knowledge base."
              : "Generate a reply using the property knowledge base and this conversation's context."}
      </div>

      {aiLoading || aiMilestones.length > 0 ? (
        <div className="mt-3 rounded-xs border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-3 py-2.5">
          <div className="flex items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-eyebrow text-[rgba(255,255,255,0.58)]">
            <span>{aiLoading ? "Concierge working" : "Last run"}</span>
            <span>{formatElapsed(aiElapsedMs)}</span>
          </div>
          <ol className="mt-2 space-y-1.5">
            {aiMilestones.map((item, index) => (
              <li key={`${item.key}-${index}`} className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-accent" />
                <div>
                  <div className="font-body text-[12px] text-[#FAFAFA]">{conciergeMilestoneLabels[item.key] ?? item.key.replaceAll("_", " ")}</div>
                  <div className="font-body text-[11px] text-[rgba(255,255,255,0.58)]">{item.detail}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {aiToolCalls.length ? (
        <div className="mt-3 rounded-xs border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-3 py-2.5">
          <div className="font-mono text-[10px] uppercase tracking-eyebrow text-[rgba(255,255,255,0.58)]">Tool activity</div>
          <ul className="mt-2 space-y-2">
            {aiToolCalls.map((call) => (
              <li key={call.id} className="rounded-xs border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-2 py-1.5">
                <div className="flex items-center gap-2">
                  <code className="font-mono text-[11px] text-[#FAFAFA]">{call.name}</code>
                  <span className="flex-1" />
                  <Badge tone={call.status === "running" ? "neutral" : "success"} size="sm">{call.status}</Badge>
                </div>
                {call.result ? <p className="mt-1 font-body text-[11px] text-[rgba(255,255,255,0.62)]">{call.result}</p> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {visibleReply || aiLoading ? (
        <div className="mt-3 whitespace-pre-wrap rounded-xs border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.06)] px-3 py-2.5 font-body text-[13px] leading-[1.5]">
          {visibleReply ?? "Waiting for concierge to produce a useful draft…"}
        </div>
      ) : null}
      {aiError ? (
        <div className="mt-2 rounded-xs border border-[rgba(220,38,38,0.45)] bg-[rgba(220,38,38,0.18)] px-2.5 py-1.5 font-body text-[11px] text-[#FEE2E2]">
          {aiError}
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Button size="sm" variant="primary" onClick={onUseDraft} disabled={aiLoading || !aiDraft}>
          Use draft
        </Button>
        <button
          type="button"
          onClick={onRegenerate}
          disabled={aiLoading}
          className="inline-flex h-7 items-center gap-1.5 rounded-sm border border-[rgba(255,255,255,0.15)] bg-transparent px-2.5 font-body text-[12px] font-medium text-[#FAFAFA] transition-colors ease-ds duration-fast hover:bg-[rgba(255,255,255,0.06)] disabled:opacity-40"
        >
          <Sparkles className="h-3 w-3" />
          {aiLoading ? "Drafting…" : aiDraft ? "Regenerate" : "Draft with Claude"}
        </button>
      </div>
    </section>
  );
}

function TicketDetailsPanel({
  detail,
  disabled,
  snoozeDisabled,
  assignees,
  attachableTags,
  attachedTagOptions,
  selectedTagId,
  selectedSnoozePreset,
  onSelectedTagIdChange,
  onSelectedSnoozePresetChange,
  onAssignee,
  onStatus,
  onPriority,
  onAddTag,
  onRemoveTag,
  onApplySnooze,
  onClearSnooze,
  addTagBusy,
  removeTagBusy,
  snoozeBusy,
}: {
  detail: ConversationDetail;
  disabled: boolean;
  snoozeDisabled: boolean;
  assignees: { id: string; name: string; role: string }[];
  attachableTags: { id: string; name: string; slug: string; color: string | null }[];
  attachedTagOptions: { id: string; name: string; slug: string; color: string | null }[];
  selectedTagId: string;
  selectedSnoozePreset: string;
  onSelectedTagIdChange: (value: string) => void;
  onSelectedSnoozePresetChange: (value: string) => void;
  onAssignee: (value: string) => void;
  onStatus: (value: string) => void;
  onPriority: (value: string) => void;
  onAddTag: () => void;
  onRemoveTag: (tagId: string) => void;
  onApplySnooze: () => void;
  onClearSnooze: () => void;
  addTagBusy: boolean;
  removeTagBusy: boolean;
  snoozeBusy: boolean;
}) {
  const assigneeValue = useMemo(
    () => assignees.find((item) => item.name === detail.ticket.assignee)?.id ?? "",
    [assignees, detail.ticket.assignee],
  );

  return (
    <div className="space-y-3">
      <div className="rounded-sm border border-border bg-surface p-3.5">
        <p className="eyebrow">Category</p>
        <p className="mt-1.5 font-body text-[13px] font-semibold text-fg">
          {detail.ticket.team} · {detail.ticket.tags[0] ?? "general"}
        </p>
      </div>

      <div className="rounded-sm border border-border bg-surface p-3.5 space-y-2.5">
        <div>
          <p className="mb-1 font-body text-[11px] uppercase tracking-eyebrow text-fg-subtle">Assignee</p>
          <Select compact value={assigneeValue} onChange={(event) => onAssignee(event.target.value)} disabled={disabled}>
            <option value="">Unassigned</option>
            {assignees.map((assignee) => (
              <option key={assignee.id} value={assignee.id}>
                {assignee.name} · {assignee.role}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <p className="mb-1 font-body text-[11px] uppercase tracking-eyebrow text-fg-subtle">Status</p>
          <Select compact value={detail.ticket.status} onChange={(event) => onStatus(event.target.value)} disabled={disabled}>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status.replaceAll("_", " ")}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <p className="mb-1 font-body text-[11px] uppercase tracking-eyebrow text-fg-subtle">Priority</p>
          <Select compact value={detail.ticket.priority} onChange={(event) => onPriority(event.target.value)} disabled={disabled}>
            {priorities.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="rounded-sm border border-border bg-surface p-3.5">
        <p className="eyebrow">Mailbox</p>
        <div className="mt-2.5 grid gap-1.5 font-body text-[12px] text-fg-muted">
          <Row label="State" value={detail.mailbox.visibilityStatus.replaceAll("_", " ")} />
          <Row label="Reply" value={detail.mailbox.canReply ? "Enabled" : "Disabled"} />
          <Row
            label="Snooze"
            value={detail.mailbox.snoozedUntilLabel ? `Until ${detail.mailbox.snoozedUntilLabel}` : "Active now"}
          />
          {detail.mailbox.deletedAtLabel ? <Row label="Deleted" value={detail.mailbox.deletedAtLabel} /> : null}
        </div>
        {detail.mailbox.deleteReason ? (
          <p className="mt-2 rounded-xs bg-surface-2 px-2.5 py-1.5 font-body text-[11px] text-fg-muted">
            {detail.mailbox.deleteReason}
          </p>
        ) : null}
      </div>

      <div className="rounded-sm border border-border bg-surface p-3.5">
        <p className="eyebrow">Snooze</p>
        <div className="mt-2.5 space-y-2.5">
          <div className="rounded-xs bg-surface-2 px-2.5 py-1.5 font-body text-[11px] text-fg-muted">
            {detail.mailbox.snoozedUntilLabel
              ? `Snoozed until ${detail.mailbox.snoozedUntilLabel}`
              : "Visible in active queues now"}
          </div>
          <div className="flex items-center gap-2">
            <Select
              compact
              value={selectedSnoozePreset}
              onChange={(event) => onSelectedSnoozePresetChange(event.target.value)}
              disabled={disabled || snoozeDisabled}
              className="min-w-0 flex-1"
            >
              <option value="">Choose a snooze preset…</option>
              {snoozePresets.map((preset) => (
                <option key={preset.value} value={preset.value}>
                  {preset.label}
                </option>
              ))}
            </Select>
            <Button
              size="sm"
              variant="secondary"
              loading={snoozeBusy && Boolean(selectedSnoozePreset)}
              disabled={!selectedSnoozePreset || disabled || snoozeDisabled}
              onClick={onApplySnooze}
            >
              Snooze
            </Button>
          </div>
          {detail.mailbox.snoozedUntil ? (
            <Button
              size="sm"
              variant="ghost"
              loading={snoozeBusy && !selectedSnoozePreset}
              disabled={disabled || snoozeDisabled}
              onClick={onClearSnooze}
              className="w-full justify-center"
            >
              Remove snooze
            </Button>
          ) : null}
        </div>
      </div>

      <div className="rounded-sm border border-border bg-surface p-3.5">
        <p className="eyebrow">Tags</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {attachedTagOptions.length > 0 ? (
            attachedTagOptions.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => onRemoveTag(tag.id)}
                disabled={disabled}
                className="inline-flex items-center gap-1 rounded-xs border border-border px-1.5 py-[2px] font-body text-[10px] font-semibold uppercase tracking-eyebrow text-fg transition-colors ease-ds duration-fast hover:bg-surface-2 disabled:opacity-40"
                title={`Remove ${tag.name}`}
              >
                <span>{tag.name}</span>
                <span className="text-fg-subtle">×</span>
              </button>
            ))
          ) : (
            <span className="font-body text-[12px] text-fg-muted">No tags yet</span>
          )}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Select
            compact
            value={selectedTagId}
            onChange={(event) => onSelectedTagIdChange(event.target.value)}
            disabled={disabled || attachableTags.length === 0}
            className="min-w-0 flex-1"
          >
            {attachableTags.length === 0 ? <option value="">All available tags are attached</option> : null}
            {attachableTags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
              </option>
            ))}
          </Select>
          <Button
            size="sm"
            variant="secondary"
            loading={addTagBusy || removeTagBusy}
            disabled={!selectedTagId || disabled || attachableTags.length === 0}
            onClick={onAddTag}
          >
            Add tag
          </Button>
        </div>
        <p className="mt-2 font-body text-[11px] text-fg-muted">
          Attach existing scoped tags or click a chip to remove it.
        </p>
      </div>

      <div className="rounded-sm border border-border bg-surface p-3.5">
        <p className="eyebrow">Suggested next actions</p>
        <div className="mt-2.5 space-y-2">
          {detail.suggestedActions.length > 0 ? (
            detail.suggestedActions.map((action) => (
              <div key={action.id} className="rounded-xs bg-surface-2 px-3 py-2.5">
                <p className="font-body text-[13px] font-medium text-fg">{action.label}</p>
                <p className="mt-1 font-body text-[12px] leading-[1.45] text-fg-muted">{action.detail}</p>
              </div>
            ))
          ) : (
            <p className="font-body text-[12px] text-fg-muted">No suggested actions yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function TenantPanel({ detail, conversation }: { detail: ConversationDetail; conversation: ConversationRow }) {
  return (
    <section className="rounded-sm border border-border bg-surface p-3.5">
      <h3 className="font-body text-[14px] font-semibold text-fg">{detail.occupant.name}</h3>
      <p className="font-body text-[12px] text-fg-muted">{detail.occupant.company}</p>
      <div className="mt-2.5 grid gap-1.5 font-body text-[12px] text-fg-muted">
        <Row label="Channel" value={conversation.channel.toUpperCase()} />
        <Row label="Tier" value={detail.occupant.tier} />
        <Row label="Health" value={detail.occupant.health.replaceAll("_", " ")} />
        <Row label="Opened" value={conversation.waitingSinceLabel || "—"} />
        <Row label="Last seen" value={detail.occupant.lastSeenLabel} />
      </div>
    </section>
  );
}

function PropertyPanel({ conversation }: { conversation: ConversationRow }) {
  if (!conversation.propertyCode) {
    return (
      <section className="rounded-sm border border-dashed border-border bg-surface-2 p-3.5 font-body text-[12px] text-fg-muted">
        This conversation is not linked to a property.
      </section>
    );
  }
  return (
    <section className="rounded-sm border border-border bg-surface p-3.5">
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-[11px] text-fg-subtle">{conversation.propertyCode}</span>
        <h3 className="font-body text-[14px] font-semibold text-fg">{conversation.company}</h3>
      </div>
      <p className="mt-0.5 font-body text-[12px] text-fg-muted">{conversation.inboxLabel}</p>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-16 font-body text-[10px] uppercase tracking-eyebrow text-fg-subtle">{label}</span>
      <span className="flex-1 truncate font-body text-[12px] text-fg">{value}</span>
    </div>
  );
}
