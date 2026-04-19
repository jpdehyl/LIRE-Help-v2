# AI Concierge integration — phased plan

Real inbound channels (email, WhatsApp, SMS, Zoom) feeding an **autonomous replying agent** built on **Claude Managed Agents**. Managed Agents gives us the agent loop, the durable session log, and tool-result routing for free — we supply tools, channel adapters, and a write path into `helpMessages`.

## Architectural shape

```
inbound webhook (email / SMS / WhatsApp / Zoom)
        │
        ▼
  channel adapter  ──▶  helpConversations upsert (existing or new)
        │                        │
        ▼                        ▼
  concierge session-runner ──────┤
        │                        │
        ▼                        │
  Anthropic Managed Agent loop   │
        │                        │
        │ agent.custom_tool_use  │
        ▼                        │
  custom tools (our code):       │
    send_reply ─────────▶ channel adapter ─▶ provider send
    update_ticket ──────▶ helpTickets
    escalate_to_human ──▶ helpTickets + internal note
    lookup_property ────▶ helpCustomers / properties
    add_internal_note ──▶ helpMessages (messageType=internal_note)
        │                        │
        ▼                        ▼
  helpMessages (messageSource = "ai" | "human" | "system")
  helpTickets.firstResponseAt, responseLatencyMs
```

One agent per tenant, created once via setup script. Sessions created per conversation-turn and resumed as new messages arrive.

## Phases

Each phase is one PR.

### Phase 1 — Foundation (this PR)
- Bump `@anthropic-ai/sdk` to ≥0.88.0 for Managed Agents beta support
- Schema: `help_messages.message_source` (`"human" | "ai" | "system"`), `help_tickets.response_latency_ms`
- `server/concierge/` scaffold: `agent-setup.ts`, `session-runner.ts`, `custom-tools.ts`, `types.ts`
- Setup script that idempotently creates the Managed Agent + Environment, writing IDs to a config file
- Dashboard metrics: compute real `% autonomous` and `avg response` from `message_source` + `response_latency_ms`
- **No real channels yet** — scaffold only

### Phase 2 — First channel: Twilio SMS
- Twilio inbound webhook → channel adapter → session-runner
- `send_reply` custom tool → Twilio outbound
- Phone number ↔ `helpCustomers` matching (+ new customer on unknown number)
- Dashboard numbers light up with real data

### Phase 3 — Email
- Resend/Postmark inbound parsing webhook
- Thread-id tracking for reply chains (`externalThreadId` on `helpConversations` already exists)
- Email outbound via the same provider

### Phase 4 — WhatsApp via Twilio
- Same webhook shape as SMS, different Twilio number
- Reuse phone→customer mapping

### Phase 5 — Zoom (chat or phone — decide before building)
- Zoom Team Chat webhook if users want that, or Zoom Phone if it's voicemail/SMS

### Phase 6 — Guardrails
- Confidence threshold: escalate to human if agent uses `escalate_to_human` or hesitates
- Rate limits per tenant/channel
- Audit log: every AI reply captures session ID + event span IDs for traceability
- Cost tracking via `span.model_request_end` events

## Things we won't build ourselves (per user direction)
- The agent loop — Managed Agents runs it
- Context compaction, extended thinking, prompt caching — Managed Agents handles them
- Tool-execution sandbox for bash/file ops — we don't need it; our "tools" are all custom (business logic)

## Open questions
- Which email provider (Resend vs Postmark vs SendGrid Parse) — lean Resend for simplicity
- Zoom: chat or phone
- How to scope agents per tenant (one global agent vs one per tenant). Start with one global agent keyed by tenant_id via system prompt; revisit if we need per-tenant personas
