import type {
  ConversationStatus,
  PriorityLevel,
  SlaState,
} from "../../../../shared/helpdesk";
import { Badge, type BadgeTone } from "./badge";

const statusTone: Record<ConversationStatus, BadgeTone> = {
  open: "success",
  pending: "info",
  waiting_on_occupant: "violet",
  resolved: "neutral",
};

const statusLabel: Partial<Record<ConversationStatus, string>> = {
  waiting_on_occupant: "waiting on tenant",
};

const priorityTone: Record<PriorityLevel, BadgeTone> = {
  low: "neutral",
  medium: "warning",
  high: "orange",
  urgent: "danger",
};

const slaTone: Record<SlaState, BadgeTone> = {
  healthy: "success",
  at_risk: "warning",
  breached: "danger",
};

function humanize(value: string): string {
  return value.replaceAll("_", " ");
}

export function StatusBadge({ status, size = "sm" }: { status: ConversationStatus; size?: "sm" | "md" }) {
  return <Badge tone={statusTone[status]} size={size}>{statusLabel[status] ?? humanize(status)}</Badge>;
}

export function PriorityBadge({ priority, size = "sm" }: { priority: PriorityLevel; size?: "sm" | "md" }) {
  return <Badge tone={priorityTone[priority]} size={size}>{priority}</Badge>;
}

export function SlaBadge({ sla, size = "sm" }: { sla: SlaState; size?: "sm" | "md" }) {
  return <Badge tone={slaTone[sla]} size={size}>SLA {humanize(sla)}</Badge>;
}
