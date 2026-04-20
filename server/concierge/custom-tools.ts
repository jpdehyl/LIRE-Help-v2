// Custom tool definitions for the concierge Managed Agent.
//
// These are declared on the agent config (once, via agent-setup.ts). The
// Managed Agent loop runs on Anthropic; when the agent calls one of these
// tools, an `agent.custom_tool_use` event arrives on the SSE stream and
// session-runner.ts dispatches it to the handler below, then sends the
// result back as `user.custom_tool_result`.

export const CONCIERGE_CUSTOM_TOOLS = [
  {
    type: "custom" as const,
    name: "send_reply",
    description:
      "Send a reply back to the tenant on the original channel (email, SMS, WhatsApp, Zoom). Use this once you have a complete, confident answer that resolves the customer's question or provides clear next steps. Do NOT use this for clarifying questions — prefer short, direct replies.",
    input_schema: {
      type: "object" as const,
      properties: {
        body: {
          type: "string",
          description:
            "The plain-text reply body. For email, supports basic Markdown; SMS/WhatsApp strips formatting.",
        },
        confidence: {
          type: "string",
          enum: ["high", "medium", "low"],
          description:
            "Your confidence in the reply. 'low' triggers human review before send.",
        },
      },
      required: ["body", "confidence"],
    },
  },
  {
    type: "custom" as const,
    name: "escalate_to_human",
    description:
      "Escalate this conversation to a human operator. Use when the request is outside your authority (pricing, legal, incident), when you lack data to answer confidently, or when the tenant explicitly asks for a person.",
    input_schema: {
      type: "object" as const,
      properties: {
        reason: {
          type: "string",
          description:
            "Short reason shown in the internal note and the human's inbox ('needs pricing approval', 'HVAC incident — vendor must confirm').",
        },
        suggested_next_step: {
          type: "string",
          description: "What the human should do next.",
        },
      },
      required: ["reason"],
    },
  },
  {
    type: "custom" as const,
    name: "add_internal_note",
    description:
      "Attach an internal note to the conversation (visible to staff, not sent to the tenant). Use for audit trail or handoff context — NOT as a substitute for send_reply.",
    input_schema: {
      type: "object" as const,
      properties: {
        body: { type: "string", description: "Note text." },
      },
      required: ["body"],
    },
  },
  {
    type: "custom" as const,
    name: "lookup_property_context",
    description:
      "Fetch structured context for the property this conversation belongs to: address, current open tickets, recent incident history, key contacts. Use before answering any property-specific question.",
    input_schema: {
      type: "object" as const,
      properties: {
        property_id: {
          type: "string",
          description:
            "Property UUID. Use the one on the ConversationBrief; only override if the tenant clearly means a different property.",
        },
      },
      required: ["property_id"],
    },
  },
  {
    type: "custom" as const,
    name: "lookup_knowledge",
    description:
      "Search the operator's knowledge base for policies, procedures, FAQs, AND uploaded documents (lease templates, policy PDFs, drawings, vendor SOWs). Call this BEFORE answering any policy/procedure or document-specific question — the KB is the source of truth. Returns two sections: `entries` (text-KB rows matching section/substring) and `documents` (semantically-similar chunks from uploaded files, with `title`, `kind`, `page_label`, and `similarity` score 0-1). When quoting document content, cite the document title in your reply so the tenant can ask follow-ups. If `documents_reason` is set, semantic search was unavailable — fall back to `entries` only.",
    input_schema: {
      type: "object" as const,
      properties: {
        section: {
          type: "string",
          description:
            "Optional section filter (exact match, case-insensitive) — e.g. 'leasing', 'maintenance', 'billing'. Omit to search across sections.",
        },
        query: {
          type: "string",
          description:
            "Optional keyword (case-insensitive substring match on title + content) — e.g. 'pet', 'late fee', 'HVAC'.",
        },
      },
    },
  },
  {
    type: "custom" as const,
    name: "update_ticket",
    description:
      "Update the linked ticket's status, priority, or next milestone. Call this when your reply resolves the question ('resolved') or when you need to mark urgency differently than the default.",
    input_schema: {
      type: "object" as const,
      properties: {
        status: {
          type: "string",
          enum: ["open", "pending", "waiting_on_customer", "resolved"],
        },
        priority: {
          type: "string",
          enum: ["low", "medium", "high", "urgent"],
        },
        next_milestone: {
          type: "string",
          description: "Short human-readable milestone label.",
        },
      },
    },
  },
];

export type ConciergeToolName =
  | "send_reply"
  | "escalate_to_human"
  | "add_internal_note"
  | "lookup_property_context"
  | "lookup_knowledge"
  | "update_ticket";
