import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { MessageSquare } from "lucide-react";
import { helpdeskApi } from "../../lib/helpdesk";
import type { ConversationDetail, ConversationRow, ConversationStatus, PriorityLevel } from "./types";
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
  const [composerMode, setComposerMode] = useState<"reply" | "note">("note");
  const availableAssignees = detail?.availableAssignees ?? [];
  const busyLabel = useMemo(() => {
    if (!detail) return null;
    return detail.ticket.assignee ? `Assigned to ${detail.ticket.assignee}` : "No owner yet";
  }, [detail]);

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

  return (
    <section className="grid h-full min-h-0 flex-1 min-w-0 grid-cols-1 bg-bg 2xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-h-0 min-w-0 flex-col border-r border-border bg-surface">
        {/* Slim header */}
        <div className="flex items-center gap-2.5 border-b border-border px-5 py-3">
          <div className="min-w-0 flex-1">
            <div className="truncate font-body text-[14px] font-semibold text-fg">{detail.title}</div>
            <div className="truncate font-body text-[12px] text-fg-muted">{detail.summary}</div>
          </div>
          <PriorityBadge priority={detail.ticket.priority} />
          {detail.ticket.slaState !== "healthy" ? <SlaBadge sla={detail.ticket.slaState} /> : null}
          <StatusBadge status={detail.ticket.status} />
        </div>

        {/* Timeline */}
        <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-5 py-4">
          {detail.timeline.length > 0 ? (
            detail.timeline.map((item) => {
              const kind = timelineKinds[item.type];
              const isInternal = item.type === "internal_note";
              return (
                <article
                  key={item.id}
                  className={[
                    "rounded-sm border px-3.5 py-3",
                    isInternal ? "border-[rgba(255,77,0,0.25)] bg-[rgba(255,77,0,0.06)]" : "border-border bg-surface",
                  ].join(" ")}
                  style={kind.barColor ? { borderLeft: `3px solid ${kind.barColor}` } : undefined}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="eyebrow"
                      style={{ color: isInternal ? "var(--accent-press)" : "var(--fg-muted)" }}
                    >
                      {kind.eyebrow}
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

        {/* Composer */}
        <div className="border-t border-border bg-surface px-5 py-3">
          <div className="flex items-center gap-1.5">
            {(["reply", "note"] as const).map((mode) => (
              <Button
                key={mode}
                size="sm"
                variant={composerMode === mode ? "dark" : "ghost"}
                onClick={() => setComposerMode(mode)}
              >
                {mode === "reply" ? "Reply" : "Internal note"}
              </Button>
            ))}
          </div>
          {composerMode === "reply" ? (
            <div className="mt-2 rounded-sm border border-dashed border-border bg-surface-2 p-3 font-body text-[12.5px] text-fg-muted">
              Outbound reply sending is still intentionally restrained in this phase. Use internal notes for handoff
              context while triage controls are live.
            </div>
          ) : (
            <div className="mt-2 rounded-sm border border-[rgba(255,77,0,0.4)] bg-[rgba(255,77,0,0.04)]">
              <Textarea
                compact
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Add context for the next operator, manager, or specialist…"
                className="min-h-24 border-0 bg-transparent focus:bg-transparent"
                style={{ borderColor: "transparent" }}
              />
              <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-1.5">
                <p className="font-body text-[11px] text-fg-muted">
                  Internal notes stay in the operator timeline and don't send to the tenant.
                </p>
                <Button
                  size="sm"
                  variant="dark"
                  loading={noteMutation.isPending}
                  disabled={!note.trim() || noteMutation.isPending}
                  onClick={() => noteMutation.mutate(note)}
                >
                  {noteMutation.isPending ? "Saving…" : "Add note"}
                </Button>
              </div>
            </div>
          )}
          {mutationError instanceof Error ? (
            <p className="mt-2 font-body text-[12px] text-error">{mutationError.message}</p>
          ) : null}
        </div>
      </div>

      {/* Right rail */}
      <aside className="min-h-0 overflow-y-auto bg-bg px-4 py-4 space-y-3">
        <section className="rounded-sm border border-border bg-surface p-3.5">
          <p className="eyebrow">Triage</p>
          <div className="mt-2.5 space-y-2.5">
            <div>
              <p className="mb-1 font-body text-[11px] uppercase tracking-eyebrow text-fg-subtle">Assignee</p>
              <Select
                compact
                value={availableAssignees.find((item) => item.name === detail.ticket.assignee)?.id ?? ""}
                onChange={(event) => assigneeMutation.mutate(event.target.value || null)}
                disabled={isBusy}
              >
                <option value="">Unassigned</option>
                {availableAssignees.map((assignee) => (
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
                onChange={(event) => statusMutation.mutate(event.target.value as ConversationStatus)}
                disabled={isBusy}
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
                onChange={(event) => priorityMutation.mutate(event.target.value as PriorityLevel)}
                disabled={isBusy}
              >
                {priorities.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </Select>
            </div>

            <div className="rounded-xs bg-surface-2 px-2.5 py-1.5 font-body text-[11px] text-fg-muted">{busyLabel}</div>
          </div>
        </section>

        <section className="rounded-sm border border-border bg-surface p-3.5">
          <p className="eyebrow">Tenant</p>
          <h3 className="mt-1.5 font-body text-[13px] font-semibold text-fg">{detail.customer.name}</h3>
          <p className="font-body text-[12px] text-fg-muted">{detail.customer.company}</p>
          <div className="mt-2.5 grid gap-1.5 font-body text-[12px] text-fg-muted">
            <Row label="Tier" value={detail.customer.tier} />
            <Row label="Health" value={detail.customer.health.replaceAll("_", " ")} />
            <Row label="Last seen" value={detail.customer.lastSeenLabel} />
          </div>
        </section>

        <section className="rounded-sm border border-border bg-surface p-3.5">
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
        </section>

        <section className="rounded-sm border border-border bg-surface p-3.5">
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
        </section>
      </aside>
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
