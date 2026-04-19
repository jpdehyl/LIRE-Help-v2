import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Building2,
  Flag,
  MessageSquare,
  Reply as ReplyIcon,
  Sparkles,
  User,
  X,
  type LucideIcon,
} from "lucide-react";
import { helpdeskApi } from "../../lib/helpdesk";
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
  customer: { eyebrow: "Tenant", barColor: "" },
  teammate: { eyebrow: "Teammate", barColor: "" },
  internal_note: { eyebrow: "Internal note", barColor: "var(--accent-press)" },
  system: { eyebrow: "System", barColor: "" },
} as const;

const statuses: ConversationStatus[] = ["open", "pending", "waiting_on_customer", "resolved"];
const priorities: PriorityLevel[] = ["low", "medium", "high", "urgent"];

export function ConversationDetailPane({
  conversation,
  detail,
  detailLoading = false,
  onMutated,
}: ConversationDetailProps) {
  const [note, setNote] = useState("");
  const [composerMode, setComposerMode] = useState<"reply" | "note">("reply");
  const [activePanel, setActivePanel] = useState<RightPanelKey | null>("ai");
  const [aiDraft, setAiDraft] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiEscalate, setAiEscalate] = useState(false);
  const activeConversationIdRef = useRef<string | null>(null);
  const availableAssignees = detail?.availableAssignees ?? [];

  const conversationId = conversation?.id ?? null;
  useEffect(() => {
    activeConversationIdRef.current = conversationId;
    setAiDraft(null);
    setAiError(null);
    setAiLoading(false);
    setAiEscalate(false);
    setNote("");
  }, [conversationId]);

  const regenerateDraft = async () => {
    if (!conversation || !detail || aiLoading) return;
    const requestId = conversation.id;
    setAiLoading(true);
    setAiError(null);
    try {
      const tenant = detail.customer?.name || "A tenant";
      const company = detail.customer?.company ? ` from ${detail.customer.company}` : "";
      const ask = conversation.preview || conversation.subject || "requesting assistance";
      const userMsg = `I'm ${tenant}${company}. ${ask}`;
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: userMsg }],
          sessionId: `inbox-${requestId}`,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (activeConversationIdRef.current !== requestId) return;
      if (!res.ok) throw new Error((data && data.error) || `Request failed (${res.status})`);
      setAiDraft(((data.response as string) || "").trim() || null);
      setAiEscalate(!!data.escalate);
    } catch (err) {
      if (activeConversationIdRef.current !== requestId) return;
      setAiError(err instanceof Error ? err.message : "Draft request failed.");
    } finally {
      if (activeConversationIdRef.current === requestId) setAiLoading(false);
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
      await onMutated?.();
    },
  });

  if (detailLoading && conversation) {
    return (
      <EmptyState
        tone="muted"
        title="Loading conversation"
        description="Pulling message history, ticket state, and customer context from the helpdesk API."
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
    assigneeMutation.error ?? statusMutation.error ?? priorityMutation.error ?? noteMutation.error;
  const isBusy =
    assigneeMutation.isPending || statusMutation.isPending || priorityMutation.isPending || noteMutation.isPending;

  const togglePanel = (panel: RightPanelKey) =>
    setActivePanel((current) => (current === panel ? null : panel));

  return (
    <section className="flex h-full min-h-0 flex-1 min-w-0 bg-bg">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col border-r border-border bg-surface">
        <div className="flex items-center gap-2.5 border-b border-border px-5 py-3">
          <div className="min-w-0 flex-1">
            <div className="truncate font-body text-[14px] font-semibold text-fg">{detail.title}</div>
            <div className="truncate font-body text-[12px] text-fg-muted">{detail.summary}</div>
          </div>
          <PriorityBadge priority={detail.ticket.priority} />
          {detail.ticket.slaState !== "healthy" ? <SlaBadge sla={detail.ticket.slaState} /> : null}
          <StatusBadge status={detail.ticket.status} />
          <span className="font-mono text-[11px] text-fg-subtle">{conversation.ticket.id}</span>
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
              />
            ) : null}

            {activePanel === "ai" ? (
              <AiConciergePanel
                aiDraft={aiDraft}
                aiLoading={aiLoading}
                aiError={aiError}
                aiEscalate={aiEscalate}
                onUseDraft={() => {
                  if (!aiDraft) return;
                  setNote(aiDraft);
                  setComposerMode("note");
                  setActivePanel("reply");
                }}
                onRegenerate={regenerateDraft}
              />
            ) : null}

            {activePanel === "ticket" ? (
              <TicketDetailsPanel
                detail={detail}
                disabled={isBusy}
                assignees={availableAssignees}
                onAssignee={(value) => assigneeMutation.mutate(value || null)}
                onStatus={(value) => statusMutation.mutate(value as ConversationStatus)}
                onPriority={(value) => priorityMutation.mutate(value as PriorityLevel)}
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
}: {
  channel: string;
  mode: "reply" | "note";
  onModeChange: (mode: "reply" | "note") => void;
  note: string;
  onNoteChange: (value: string) => void;
  noteBusy: boolean;
  onSubmitNote: () => void;
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
        <div className="rounded-sm border border-dashed border-border bg-surface-2 p-3 font-body text-[12.5px] text-fg-muted">
          Outbound reply sending is still intentionally restrained in this phase. Switch to Internal note to capture
          handoff context; the concierge workflow will deliver outbound messages once Phase 2 ships.
        </div>
      ) : (
        <div className="rounded-sm border border-[rgba(255,77,0,0.4)] bg-[rgba(255,77,0,0.04)]">
          <Textarea
            compact
            value={note}
            onChange={(event) => onNoteChange(event.target.value)}
            placeholder="Add context for the next operator, manager, or specialist…"
            className="min-h-24 border-0 bg-transparent focus:bg-transparent"
            style={{ borderColor: "transparent" }}
          />
          <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-1.5">
            <p className="font-body text-[11px] text-fg-muted">Internal notes stay in the operator timeline.</p>
            <Button
              size="sm"
              variant="dark"
              loading={noteBusy}
              disabled={!note.trim() || noteBusy}
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

function AiConciergePanel({
  aiDraft,
  aiLoading,
  aiError,
  aiEscalate,
  onUseDraft,
  onRegenerate,
}: {
  aiDraft: string | null;
  aiLoading: boolean;
  aiError: string | null;
  aiEscalate: boolean;
  onUseDraft: () => void;
  onRegenerate: () => void;
}) {
  return (
    <section className="rounded-sm bg-[#111111] p-3.5 text-[#FAFAFA]">
      <div className="flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 text-accent" />
        <div className="eyebrow text-[#FAFAFA]">Suggested next step</div>
        <span className="flex-1" />
        {aiDraft ? <Badge tone="success" size="sm">LIVE · CLAUDE</Badge> : null}
        {aiEscalate ? <Badge tone="warning" size="sm">ESCALATE</Badge> : null}
      </div>
      <div className="mt-2.5 font-body text-[12px] leading-[1.5] text-[rgba(255,255,255,0.72)]">
        {aiEscalate
          ? "Concierge flagged this for human escalation. Review draft before sending."
          : aiDraft
            ? "Drafted live from the platform knowledge base."
            : "Generate a reply using the property knowledge base and this conversation's context."}
      </div>
      {aiDraft || aiLoading ? (
        <div className="mt-2.5 whitespace-pre-wrap rounded-xs border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.06)] px-3 py-2.5 font-body text-[13px] leading-[1.5]">
          {aiLoading ? "Drafting from the live knowledge base…" : aiDraft}
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
  assignees,
  onAssignee,
  onStatus,
  onPriority,
}: {
  detail: ConversationDetail;
  disabled: boolean;
  assignees: { id: string; name: string; role: string }[];
  onAssignee: (value: string) => void;
  onStatus: (value: string) => void;
  onPriority: (value: string) => void;
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

      <div className="rounded-sm border border-border bg-surface p-3.5">
        <p className="eyebrow">Tags</p>
        <div className="mt-2 flex flex-wrap gap-1">
          {detail.ticket.tags.length > 0 ? (
            detail.ticket.tags.map((tag) => (
              <Badge key={tag} tone="muted" size="sm">
                {tag}
              </Badge>
            ))
          ) : (
            <span className="font-body text-[12px] text-fg-muted">No tags yet</span>
          )}
        </div>
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
          <Select
            compact
            value={detail.ticket.status}
            onChange={(event) => onStatus(event.target.value)}
            disabled={disabled}
          >
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status.replaceAll("_", " ")}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <p className="mb-1 font-body text-[11px] uppercase tracking-eyebrow text-fg-subtle">Priority</p>
          <Select
            compact
            value={detail.ticket.priority}
            onChange={(event) => onPriority(event.target.value)}
            disabled={disabled}
          >
            {priorities.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </Select>
        </div>
      </div>
    </div>
  );
}

function TenantPanel({ detail, conversation }: { detail: ConversationDetail; conversation: ConversationRow }) {
  return (
    <section className="rounded-sm border border-border bg-surface p-3.5">
      <h3 className="font-body text-[14px] font-semibold text-fg">{detail.customer.name}</h3>
      <p className="font-body text-[12px] text-fg-muted">{detail.customer.company}</p>
      <div className="mt-2.5 grid gap-1.5 font-body text-[12px] text-fg-muted">
        <Row label="Channel" value={conversation.channel.toUpperCase()} />
        <Row label="Tier" value={detail.customer.tier} />
        <Row label="Health" value={detail.customer.health.replaceAll("_", " ")} />
        <Row label="Opened" value={conversation.waitingSinceLabel || "—"} />
        <Row label="Last seen" value={detail.customer.lastSeenLabel} />
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
      <span className="font-body text-[10px] uppercase tracking-eyebrow text-fg-subtle w-16">{label}</span>
      <span className="flex-1 truncate font-body text-[12px] text-fg">{value}</span>
    </div>
  );
}
