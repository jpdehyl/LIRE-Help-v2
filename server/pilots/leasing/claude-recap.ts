import { logTokenUsage } from "../../token-logger.js";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MODEL_RECAP = "claude-haiku-4-5-20251001";

const RECAP_SYSTEM = `You write concise tour recaps for commercial real estate brokers.
Given a broker's raw notes, produce a structured recap in Markdown with these sections:
- **Prospect needs** — what the prospect is looking for
- **Unit fit** — which units or features match (or don't)
- **Next steps** — concrete actions with implied owner + timeline
- **Open questions** — items the broker should clarify before advancing the deal

Keep the recap under 180 words. Do not invent facts beyond what the broker supplied.
If notes are too thin to fill a section, write "—" for that section. No preamble.`;

export async function draftTourRecap(params: {
  tenantId: string;
  prospectCompany: string;
  unitLabel: string | null;
  brokerNotes: string;
}): Promise<{ recap: string; model: string }> {
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

  const user = [
    `Prospect: ${params.prospectCompany}`,
    `Unit toured: ${params.unitLabel ?? "unspecified"}`,
    ``,
    `Broker notes:`,
    params.brokerNotes,
  ].join("\n");

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: MODEL_RECAP,
      max_tokens: 600,
      system: RECAP_SYSTEM,
      messages: [{ role: "user", content: user }],
    }),
  });

  if (!res.ok) {
    throw new Error(`Tour recap failed: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as {
    content?: Array<{ text?: string }>;
    usage?: { input_tokens: number; output_tokens: number };
  };
  const recap = (data.content?.[0]?.text ?? "").trim();

  if (data.usage) {
    logTokenUsage({
      tenantId: params.tenantId,
      operation: "leasing.tour_recap",
      model: MODEL_RECAP,
      inputTokens: data.usage.input_tokens,
      outputTokens: data.usage.output_tokens,
    });
  }

  return { recap, model: MODEL_RECAP };
}
