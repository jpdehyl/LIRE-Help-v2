import { describe, it, expect } from "vitest";
import { createClient } from "./helpers/request.js";

describe("app factory", () => {
  it("serves /api/health", async () => {
    const client = await createClient();
    const res = await client.get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});
