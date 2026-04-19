// One-time bootstrap for the Managed Agent + Environment backing the
// concierge. Run via `npm run concierge:setup`. Outputs agent/env IDs that
// should be committed to the team's env config (Railway vars) so every
// deploy reuses the same agent.
//
// Why one-time: agents are persistent, versioned Anthropic resources —
// creating them in the request path piles up orphans and pays the creation
// latency on every invocation. See
// https://platform.claude.com/docs/en/managed-agents/overview

import Anthropic from "@anthropic-ai/sdk";
import { CONCIERGE_CUSTOM_TOOLS } from "./custom-tools.js";

const CONCIERGE_AGENT_NAME = "LIRE Help concierge";
const CONCIERGE_ENVIRONMENT_NAME = "lire-help-concierge";

// Loaded from process.env at runtime by session-runner.ts. Publishing the
// const names here keeps a single source of truth for the env-var contract.
export const CONCIERGE_ENV_KEYS = {
  agentId: "CONCIERGE_AGENT_ID",
  agentVersion: "CONCIERGE_AGENT_VERSION",
  environmentId: "CONCIERGE_ENVIRONMENT_ID",
} as const;

const SYSTEM_PROMPT = `You are the LIRE Help concierge — the first responder for tenants at the properties your operator manages. You reply directly to tenants over the channel they wrote in on (email, SMS, WhatsApp, Zoom).

Ground rules:
- Be brief. Tenants want answers, not essays. Aim for 2–4 sentences unless a longer explanation genuinely helps.
- Never invent facts about a property, lease, bill, or vendor. Call lookup_property_context first when a question is property-specific.
- If you are not confident, call escalate_to_human rather than guess.
- Once you have a complete, confident reply, call send_reply with confidence="high" or "medium". Use confidence="low" when a human should review before it goes out.
- Match the channel's register: concise and warm on SMS/WhatsApp; slightly more formal on email.
- Sign emails "— LIRE Help" (no personal name). Do not sign SMS/WhatsApp.

Escalation triggers (non-exhaustive): pricing/renewal decisions, legal questions, urgent maintenance with life-safety impact, anything that requires a decision outside the knowledge base, or the tenant explicitly asking for a human.

Always end your turn with a tool call: send_reply, escalate_to_human, or (rarely) add_internal_note. Don't finish a turn without taking one of those actions.`;

async function main() {
  const client = new Anthropic();

  // Environment — Anthropic-managed container used as the agent's workspace.
  // We use unrestricted networking because our custom tools reach our own
  // backend; no sandboxed bash/code is invoked.
  const existingEnvs = await client.beta.environments.list();
  const env =
    existingEnvs.data.find((e) => e.name === CONCIERGE_ENVIRONMENT_NAME) ??
    (await client.beta.environments.create({
      name: CONCIERGE_ENVIRONMENT_NAME,
      config: { type: "cloud", networking: { type: "unrestricted" } },
    }));

  // Agent — one per deployment (tenant scoping handled via system prompt
  // injection at session-create time, in Phase 2). If the named agent
  // already exists, update it so repeated runs of this script reconverge
  // the config rather than spawning duplicates.
  const existingAgents = await client.beta.agents.list();
  const match = existingAgents.data.find((a) => a.name === CONCIERGE_AGENT_NAME);

  const agent = match
    ? await client.beta.agents.update(match.id, {
        version: match.version,
        system: SYSTEM_PROMPT,
        tools: CONCIERGE_CUSTOM_TOOLS,
      })
    : await client.beta.agents.create({
        name: CONCIERGE_AGENT_NAME,
        model: "claude-opus-4-7",
        system: SYSTEM_PROMPT,
        tools: CONCIERGE_CUSTOM_TOOLS,
      });

  console.log("Concierge agent ready.");
  console.log(`  ${CONCIERGE_ENV_KEYS.agentId}=${agent.id}`);
  console.log(`  ${CONCIERGE_ENV_KEYS.agentVersion}=${agent.version}`);
  console.log(`  ${CONCIERGE_ENV_KEYS.environmentId}=${env.id}`);
  console.log("\nSet those three env vars on the server (Railway) before enabling concierge traffic.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error("Concierge setup failed:", err);
    process.exit(1);
  });
}
