import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { MessageSquare } from "lucide-react";
import { helpdeskApi } from "../../lib/helpdesk";
import type { ConversationDetail, ConversationRow, ConversationStatus, PriorityLevel } from "./types";
import {
  Badge,
  Button,
  EmptyState,
  Eyebrow,
  Heading,
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

const timelineClasses = {
  customer: "border-blue-200 bg-blue-50",
  teammate: "border-slate-200 bg-white",
  internal_note: "border-amber-200 bg-amber-50",
  system: "border-violet-200 bg-violet-50",
} as const;

const statuses: ConversationStatus[] = ["open", "pending", "waiting_on_customer", "resolved"];
const priorities: PriorityLevel[] = ["low", "medium", "high", "urgent"];

export function ConversationDetailPane({ conversation, detail, detailLoading = false, onMutated }: ConversationDetailProps) {
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
        description="The right pane is reserved for the active work surface: conversation record, ticket state, notes, and action rail."
      />
    );
  }

  const mutationError = assigneeMutation.error ?? statusMutation.error ?? priorityMutation.error ?? noteMutation.error;
  const isBusy = assigneeMutation.isPending || statusMutation.isPending || priorityMutation.isPending || noteMutation.isPending;

  return (
    <section className="grid h-full min-h-0 grid-cols-1 bg-[#f6f8fa] 2xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="flex min-h-0 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Eyebrow>Active conversation</Eyebrow>
              <Heading level={2} className="mt-1">{detail.title}</Heading>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">{detail.summary}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={detail.ticket.status} size="md" />
              <PriorityBadge priority={detail.ticket.priority} size="md" />
              <SlaBadge sla={detail.ticket.slaState} size="md" />
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
              <p className="eyebrow">Assignee</p>
              <p className="mt-1 text-sm font-medium text-slate-900">{detail.ticket.assignee ?? "Unassigned"}</p>
              <p className="mt-1 text-xs text-slate-500">Team: {detail.ticket.team}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
              <p className="eyebrow">Ticket</p>
              <p className="mt-1 text-sm font-medium text-slate-900">{detail.ticket.id}</p>
              <p className="mt-1 text-xs text-slate-500">{detail.ticket.nextMilestone}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
              <p className="eyebrow">Tags</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {detail.ticket.tags.length > 0 ? detail.ticket.tags.map((tag) => (
                  <Badge key={tag} tone="slate">{tag}</Badge>
                )) : <span className="text-xs text-slate-500">No tags yet</span>}
              </div>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-5">
          {detail.timeline.length > 0 ? detail.timeline.map((item) => (
            <article key={item.id} className={`rounded-2xl border p-4 ${timelineClasses[item.type]}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="eyebrow">{item.type.replaceAll("_", " ")}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{item.author}</p>
                </div>
                <span className="text-xs text-slate-500">{item.createdAtLabel}</span>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{item.body}</p>
            </article>
          )) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
              No message history yet. Add an internal note to capture next steps.
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 bg-[#f8fafb] px-5 py-4">
          <div className="flex items-center gap-2">
            {(["reply", "note"] as const).map((mode) => (
              <Button
                key={mode}
                size="sm"
                variant={composerMode === mode ? "primary" : "secondary"}
                onClick={() => setComposerMode(mode)}
              >
                {mode === "reply" ? "Reply" : "Internal note"}
              </Button>
            ))}
          </div>
          {composerMode === "reply" ? (
            <div className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
              Outbound reply sending is still intentionally restrained in this phase. Use internal notes for handoff context while triage controls are live.
            </div>
          ) : (
            <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
              <Textarea
                compact
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Add context for the next operator, manager, or specialist…"
                className="min-h-28"
              />
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-xs text-slate-500">Internal notes stay in the operator timeline and do not send to the customer.</p>
                <Button
                  size="sm"
                  loading={noteMutation.isPending}
                  disabled={!note.trim() || noteMutation.isPending}
                  onClick={() => noteMutation.mutate(note)}
                >
                  {noteMutation.isPending ? "Saving…" : "Add note"}
                </Button>
              </div>
            </div>
          )}
          {mutationError instanceof Error && <p className="mt-3 text-xs text-red-600">{mutationError.message}</p>}
        </div>
      </div>

      <aside className="min-h-0 overflow-y-auto bg-[#f6f8fa] px-4 py-4">
        <div className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="eyebrow">Triage controls</p>
            <div className="mt-3 space-y-3">
              <div>
                <p className="mb-1 text-xs font-medium text-slate-500">Assignee</p>
                <Select
                  compact
                  value={availableAssignees.find((item) => item.name === detail.ticket.assignee)?.id ?? ""}
                  onChange={(event) => assigneeMutation.mutate(event.target.value || null)}
                  disabled={isBusy}
                >
                  <option value="">Unassigned</option>
                  {availableAssignees.map((assignee) => (
                    <option key={assignee.id} value={assignee.id}>{assignee.name} · {assignee.role}</option>
                  ))}
                </Select>
              </div>

              <div>
                <p className="mb-1 text-xs font-medium text-slate-500">Status</p>
                <Select
                  compact
                  value={detail.ticket.status}
                  onChange={(event) => statusMutation.mutate(event.target.value as ConversationStatus)}
                  disabled={isBusy}
                >
                  {statuses.map((status) => (
                    <option key={status} value={status}>{status.replaceAll("_", " ")}</option>
                  ))}
                </Select>
              </div>

              <div>
                <p className="mb-1 text-xs font-medium text-slate-500">Priority</p>
                <Select
                  compact
                  value={detail.ticket.priority}
                  onChange={(event) => priorityMutation.mutate(event.target.value as PriorityLevel)}
                  disabled={isBusy}
                >
                  {priorities.map((priority) => (
                    <option key={priority} value={priority}>{priority}</option>
                  ))}
                </Select>
              </div>

              <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
                {busyLabel}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="eyebrow">Customer context</p>
            <h3 className="mt-2 text-sm font-semibold text-slate-900">{detail.customer.name}</h3>
            <p className="text-sm text-slate-500">{detail.customer.company}</p>
            <div className="mt-3 grid gap-2 text-xs text-slate-500">
              <p>Tier: <span className="font-medium capitalize text-slate-700">{detail.customer.tier}</span></p>
              <p>Health: <span className="font-medium capitalize text-slate-700">{detail.customer.health.replaceAll("_", " ")}</span></p>
              <p>Last seen: <span className="font-medium text-slate-700">{detail.customer.lastSeenLabel}</span></p>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="eyebrow">Suggested next actions</p>
            <div className="mt-3 space-y-3">
              {detail.suggestedActions.length > 0 ? detail.suggestedActions.map((action) => (
                <div key={action.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <p className="text-sm font-medium text-slate-900">{action.label}</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">{action.detail}</p>
                </div>
              )) : <p className="text-sm text-slate-500">No suggested actions yet.</p>}
            </div>
          </section>
        </div>
      </aside>
    </section>
  );
}
