import { describe, it, expect } from "vitest";
import supertest from "supertest";
import { buildApp } from "../server/app-factory.js";

describe("CSP in production (B9)", () => {
  it("sets a strict Content-Security-Policy header in production", async () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const app = await buildApp();
      const r = await supertest(app).get("/api/health");
      const csp = r.headers["content-security-policy"] ?? "";
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("object-src 'none'");
    } finally {
      if (prev !== undefined) process.env.NODE_ENV = prev; else delete process.env.NODE_ENV;
    }
  });

  it("sets a strict Referrer-Policy header", async () => {
    const app = await buildApp();
    const r = await supertest(app).get("/api/health");
    expect(r.headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  });

  it("does NOT set CSP in test/dev mode (so Vite HMR works)", async () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "test";
    try {
      const app = await buildApp();
      const r = await supertest(app).get("/api/health");
      expect(r.headers["content-security-policy"]).toBeUndefined();
    } finally {
      if (prev !== undefined) process.env.NODE_ENV = prev; else delete process.env.NODE_ENV;
    }
  });
});
