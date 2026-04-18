import { describe, expect, it } from "vitest";
import { isCorsOriginAllowed, parseAllowedHosts } from "../server/platform/cors.js";

describe("CORS allowlist (A6)", () => {
  describe("production", () => {
    const opts = { isProd: true, extraAllowedHosts: [] as string[] };

    it("allows *.lire-help.com", () => {
      expect(isCorsOriginAllowed("https://berkeley.lire-help.com", opts)).toBe(true);
      expect(isCorsOriginAllowed("https://app.lire-help.com", opts)).toBe(true);
    });

    it("rejects *.replit.dev in production", () => {
      expect(isCorsOriginAllowed("https://abc123.replit.dev", opts)).toBe(false);
      expect(isCorsOriginAllowed("https://evil.replit.dev", opts)).toBe(false);
    });

    it("rejects *.replit.app in production", () => {
      expect(isCorsOriginAllowed("https://foo.replit.app", opts)).toBe(false);
    });

    it("rejects localhost in production", () => {
      expect(isCorsOriginAllowed("http://localhost:3000", opts)).toBe(false);
      expect(isCorsOriginAllowed("http://127.0.0.1:3000", opts)).toBe(false);
    });

    it("allows explicit CORS_ALLOWED_HOSTS entries including wildcards", () => {
      const withExtra = { isProd: true, extraAllowedHosts: ["*.berkeley-azure.com", "partner.example.io"] };
      expect(isCorsOriginAllowed("https://pilot.berkeley-azure.com", withExtra)).toBe(true);
      expect(isCorsOriginAllowed("https://partner.example.io", withExtra)).toBe(true);
      expect(isCorsOriginAllowed("https://attacker.example.com", withExtra)).toBe(false);
    });

    it("rejects empty origin", () => {
      expect(isCorsOriginAllowed("", opts)).toBe(false);
    });
  });

  describe("development", () => {
    const opts = { isProd: false, extraAllowedHosts: [] as string[] };

    it("still allows *.replit.dev outside prod", () => {
      expect(isCorsOriginAllowed("https://abc123.replit.dev", opts)).toBe(true);
    });

    it("still allows localhost outside prod", () => {
      expect(isCorsOriginAllowed("http://localhost:5173", opts)).toBe(true);
      expect(isCorsOriginAllowed("http://127.0.0.1:5173", opts)).toBe(true);
    });

    it("allows *.lire-help.com outside prod too", () => {
      expect(isCorsOriginAllowed("https://berkeley.lire-help.com", opts)).toBe(true);
    });
  });

  describe("parseAllowedHosts", () => {
    it("splits a comma list", () => {
      expect(parseAllowedHosts("a.com, b.com ,c.com")).toEqual(["a.com", "b.com", "c.com"]);
    });

    it("returns empty array for undefined or empty", () => {
      expect(parseAllowedHosts(undefined)).toEqual([]);
      expect(parseAllowedHosts("")).toEqual([]);
    });
  });
});
