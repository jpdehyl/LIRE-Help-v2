// Types shared across the concierge integration. The concierge is built on
// Claude Managed Agents — Anthropic runs the agent loop; we provide the
// custom tools (business logic) and the channel adapters.

export type MessageSource = "human" | "ai" | "system";

export type Channel = "email" | "whatsapp" | "sms" | "zoom" | "web";

// Identifiers stable across restarts. Populated by the one-time setup script
// (server/concierge/agent-setup.ts) and read from env on every request.
export interface ConciergeIdentity {
  agentId: string;
  agentVersion: number;
  environmentId: string;
}

// Outbound message handed from the concierge agent (via send_reply custom
// tool) to a channel adapter. The adapter is responsible for provider-specific
// formatting and delivery.
export interface OutboundReply {
  conversationId: string;
  channel: Channel;
  body: string;
  // Optional structured metadata (e.g., Twilio MessageSid, Resend id) that
  // the channel returns post-send; stored on helpMessages.metadataJson.
  providerMetadata?: Record<string, unknown>;
}

// Minimal view of a conversation that the session-runner hands to the agent
// as its opening context. Keeps us from leaking unrelated rows.
export interface ConversationBrief {
  conversationId: string;
  tenantId: string;
  propertyId: string | null;
  channel: Channel;
  tenantName: string | null;
  tenantCompany: string | null;
  propertyName: string | null;
  propertyCode: string | null;
  subject: string;
  latestMessage: string;
  // Concierge run mode. "paused" never reaches the runner — the orchestrator
  // short-circuits. "shadow" runs the agent but every send_reply is forced
  // to low confidence so the reply queues as a draft instead of going out.
  runState?: "live" | "shadow";
}
