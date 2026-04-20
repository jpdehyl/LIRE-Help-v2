import { db } from "./db.js";
import { tokenUsage } from "../shared/schema.js";

// H17: keep every model the pipelines actually call in this table. A missing
// entry falls through to Haiku rates, which silently under-reports Opus cost
// by ~15× on every memo draft. Prices are per-1M tokens in USD; verify against
// Anthropic's current pricing page before deploy.
export const MODEL_PRICING: Record<string, { inputPer1M: number; outputPer1M: number }> = {
  "claude-haiku-4-5-20251001": { inputPer1M: 0.80, outputPer1M: 4.00 },
  "claude-sonnet-4-20250514": { inputPer1M: 3.00, outputPer1M: 15.00 },
  "claude-sonnet-4-6": { inputPer1M: 3.00, outputPer1M: 15.00 },
  "claude-opus-4-7": { inputPer1M: 15.00, outputPer1M: 75.00 },
};

export function calculateCost(model: string, inputTokens: number, outputTokens: number): string {
  const pricing = MODEL_PRICING[model] ?? MODEL_PRICING["claude-haiku-4-5-20251001"]!;
  const cost = (inputTokens / 1_000_000) * pricing.inputPer1M + (outputTokens / 1_000_000) * pricing.outputPer1M;
  return cost.toFixed(6);
}

interface LogTokenParams {
  tenantId?: string | null;
  propertyId?: string | null;
  sessionId?: string | null;
  operation: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export function logTokenUsage(params: LogTokenParams): void {
  const costUsd = calculateCost(params.model, params.inputTokens, params.outputTokens);
  db.insert(tokenUsage)
    .values({
      tenantId: params.tenantId ?? null,
      propertyId: params.propertyId ?? null,
      sessionId: params.sessionId ?? null,
      operation: params.operation,
      model: params.model,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      costUsd,
    })
    .then(() => {})
    .catch((err) => { console.error("[token-logger] Failed:", err); });
}
