import { logTokenUsage } from "../../token-logger.js";
import { redact } from "../../helpers/redact.js";

// ─────────────────────────────────────────────────────────────────────────────
// Claude-backed primitives for Pilot B (tenant financial review).
//
// Three pure functions:
//   - classifyDocument()      → what kind of financial doc is this?
//   - extractLineItems()      → pull the values the rubric requires, with cites
//   - draftMemo()             → turn a checklist run + extractions into a memo
//
// Every call logs to token_usage so the metrics module can attribute cost back
// to the Berkeley tenant. All failures surface to the caller — no retries hidden
// inside, because the calling route owns the archive_log entry.
// ─────────────────────────────────────────────────────────────────────────────

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

const MODEL_CLASSIFY = "claude-haiku-4-5-20251001";
const MODEL_EXTRACT = "claude-sonnet-4-6";
const MODEL_MEMO = "claude-opus-4-7";

export type DocumentClassification =
  | "p_and_l"
  | "balance_sheet"
  | "tax_return"
  | "bank_statement"
  | "rent_roll"
  | "aged_receivables"
  | "management_letter"
  | "other";

type ClaudeResponse = {
  content?: Array<{ text?: string }>;
  usage?: { input_tokens: number; output_tokens: number };
};

function requireApiKey(): string {
  const key = process.env["ANTHROPIC_API_KEY"];
  if (!key) throw new Error("ANTHROPIC_API_KEY not configured");
  return key;
}

async function callClaude(params: {
  model: string;
  system: string;
  userContent: string;
  maxTokens: number;
  tenantId: string | null;
  operation: string;
}): Promise<string> {
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": requireApiKey(),
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: params.model,
      max_tokens: params.maxTokens,
      system: params.system,
      messages: [{ role: "user", content: params.userContent }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Claude ${params.model} error: ${res.status} ${redact(body)}`);
  }

  const data = (await res.json()) as ClaudeResponse;
  const text = data.content?.[0]?.text ?? "";

  if (data.usage) {
    logTokenUsage({
      tenantId: params.tenantId,
      operation: params.operation,
      model: params.model,
      inputTokens: data.usage.input_tokens,
      outputTokens: data.usage.output_tokens,
    });
  }

  return text;
}

function parseJsonBlock<T>(raw: string): T {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const payload = (fenced?.[1] ?? raw).trim();
  return JSON.parse(payload) as T;
}

// ─── Classification ─────────────────────────────────────────────────────────

const CLASSIFY_SYSTEM = `You classify financial documents for a credit review pipeline.
Return JSON only, no prose, no code fences. Shape:
{"classification":"<one of: p_and_l|balance_sheet|tax_return|bank_statement|rent_roll|aged_receivables|management_letter|other>","confidence":<0..1>,"reasoning":"<one sentence>"}
Be conservative — use "other" with low confidence rather than guessing.`;

export async function classifyDocument(params: {
  tenantId: string;
  documentText: string;
}): Promise<{ classification: DocumentClassification; confidence: number; reasoning: string }> {
  const raw = await callClaude({
    model: MODEL_CLASSIFY,
    system: CLASSIFY_SYSTEM,
    userContent: `Document excerpt (first ~4000 chars):\n\n${params.documentText.slice(0, 4000)}`,
    maxTokens: 256,
    tenantId: params.tenantId,
    operation: "credit.classify_document",
  });
  return parseJsonBlock(raw);
}

// ─── Extraction ─────────────────────────────────────────────────────────────

const EXTRACT_SYSTEM = `You extract financial line items from source documents for a credit review pipeline.
For each requested line item, return the numeric value, its unit, and a citation pointing to the source (page number + raw text excerpt).
Return JSON only, no prose, no code fences. Shape:
{"extractions":[{"line_item":"<id>","value":"<string>","unit":"<usd|pct|ratio|months|date|null>","page":<int|null>,"raw_text":"<verbatim excerpt>","confidence":<0..1>}]}
If a line item cannot be found, include it with value=null and confidence=0.
Never invent numbers. Every value must be traceable to the raw_text excerpt.`;

export async function extractLineItems(params: {
  tenantId: string;
  documentText: string;
  requestedItems: string[];
}): Promise<{
  extractions: Array<{
    line_item: string;
    value: string | null;
    unit: string | null;
    page: number | null;
    raw_text: string;
    confidence: number;
  }>;
}> {
  const user = [
    `Extract the following line items from the document below. For each, include citations.`,
    ``,
    `Requested items: ${params.requestedItems.join(", ")}`,
    ``,
    `Document (may be truncated):`,
    params.documentText.slice(0, 18000),
  ].join("\n");

  const raw = await callClaude({
    model: MODEL_EXTRACT,
    system: EXTRACT_SYSTEM,
    userContent: user,
    maxTokens: 2048,
    tenantId: params.tenantId,
    operation: "credit.extract_line_items",
  });
  return parseJsonBlock(raw);
}

// ─── Memo drafting ──────────────────────────────────────────────────────────

const MEMO_SYSTEM = `You draft credit memos for a commercial real estate lender's tenant financial review.
You receive: (1) the lessee's name and context, (2) a checklist run with pass/yellow/red results, (3) extracted line items with citations.
You produce a memo using the provided template, substituting every {{placeholder}}.
Every numeric value in the memo must carry a citation of the form [¶{doc_id}:p{page}].
The recommendation section must default to "Analyst review required." — you do not make credit decisions.
Return the filled memo as Markdown only, no code fences, no preamble.`;

export async function draftMemo(params: {
  tenantId: string;
  lesseeName: string;
  rubricVersion: string;
  templateMarkdown: string;
  checklistResults: unknown;
  extractions: unknown;
  documentRefs: unknown;
}): Promise<{ markdown: string; model: string }> {
  const user = [
    `Lessee: ${params.lesseeName}`,
    `Rubric version: ${params.rubricVersion}`,
    ``,
    `TEMPLATE (fill in every {{placeholder}}):`,
    params.templateMarkdown,
    ``,
    `CHECKLIST RESULTS:`,
    JSON.stringify(params.checklistResults, null, 2),
    ``,
    `EXTRACTIONS (use these exact values + citations):`,
    JSON.stringify(params.extractions, null, 2),
    ``,
    `DOCUMENTS:`,
    JSON.stringify(params.documentRefs, null, 2),
  ].join("\n");

  const markdown = await callClaude({
    model: MODEL_MEMO,
    system: MEMO_SYSTEM,
    userContent: user,
    maxTokens: 4096,
    tenantId: params.tenantId,
    operation: "credit.draft_memo",
  });
  return { markdown: markdown.trim(), model: MODEL_MEMO };
}
