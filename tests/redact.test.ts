import { describe, it, expect } from "vitest";
import { redact } from "../server/helpers/redact.js";

describe("redact (B12)", () => {
  it("masks header-colon credentials", () => {
    expect(redact("X-API-Key: sk-abc123def")).toBe("X-API-Key: [redacted]");
    expect(redact("authorization: mySecret")).toBe("authorization: [redacted]");
    expect(redact("api_key=foobar")).toBe("api_key=[redacted]");
  });

  it("masks JSON-shape credentials", () => {
    expect(redact(`{"authorization":"Bearer xyz"}`)).toBe(`{"authorization":"[redacted]"}`);
    expect(redact(`{"x-api-key":"sk-abc"}`)).toBe(`{"x-api-key":"[redacted]"}`);
  });

  it("masks bare Bearer token", () => {
    expect(redact("bearer abcdef")).toBe("bearer [redacted]");
    expect(redact("Bearer TOKEN-123")).toBe("Bearer [redacted]");
  });

  it("truncates past maxLen", () => {
    const long = "x".repeat(500);
    const out = redact(long, 50);
    expect(out.length).toBeLessThanOrEqual(50 + "…[truncated]".length);
    expect(out.endsWith("…[truncated]")).toBe(true);
  });

  it("stringifies non-string values safely", () => {
    expect(redact({ authorization: "Bearer hideme" })).toContain("[redacted]");
    expect(redact(new Error("boom")).includes("Error")).toBe(true);
  });

  it("returns empty string as-is", () => {
    expect(redact("")).toBe("");
  });
});
