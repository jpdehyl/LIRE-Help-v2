import { describe, it, expect } from "vitest";
import { MODEL_PRICING, calculateCost } from "../server/token-logger.js";

describe("MODEL_PRICING (H17)", () => {
  it("covers every model the pipelines call", () => {
    // If a pipeline adds a new model, add it here and to MODEL_PRICING.
    const expected = [
      "claude-haiku-4-5-20251001",
      "claude-sonnet-4-20250514",
      "claude-sonnet-4-6",
      "claude-opus-4-7",
    ];
    for (const model of expected) expect(MODEL_PRICING[model]).toBeDefined();
  });

  it("charges Opus 4.7 at the actual Opus rate, not Haiku fallback", () => {
    const opus = calculateCost("claude-opus-4-7", 1_000_000, 0);
    const haiku = calculateCost("claude-haiku-4-5-20251001", 1_000_000, 0);
    // Opus should be much more expensive than Haiku for identical input volume.
    expect(parseFloat(opus)).toBeGreaterThan(parseFloat(haiku) * 10);
  });

  it("falls back to Haiku when the model is unknown (for cost safety)", () => {
    const unknown = calculateCost("not-a-real-model", 1_000_000, 0);
    expect(parseFloat(unknown)).toBeGreaterThan(0);
  });
});
