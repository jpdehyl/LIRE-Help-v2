import { describe, it, expect, beforeEach } from "vitest";
import { seedTenant, seedProperty, truncateAll } from "./helpers/seed.js";
import { assertPropertyInTenant } from "../server/helpers/tenant-scope.js";

describe("assertPropertyInTenant", () => {
  beforeEach(truncateAll);

  it("returns the property when it belongs to tenant", async () => {
    const t = await seedTenant("acme");
    const p = await seedProperty(t.id, "warehouse-1");
    const result = await assertPropertyInTenant(p.id, t.id);
    expect(result.id).toBe(p.id);
  });

  it("throws when property belongs to a different tenant", async () => {
    const a = await seedTenant("acme");
    const b = await seedTenant("bex");
    const p = await seedProperty(b.id, "warehouse-1");
    await expect(assertPropertyInTenant(p.id, a.id)).rejects.toThrow(/not found/);
  });

  it("throws when property does not exist", async () => {
    const a = await seedTenant("acme");
    await expect(assertPropertyInTenant("00000000-0000-0000-0000-000000000000", a.id)).rejects.toThrow(/not found/);
  });
});
