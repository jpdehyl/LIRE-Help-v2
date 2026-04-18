import { afterAll, afterEach, beforeAll } from "vitest";

if (!process.env.DATABASE_URL) {
  throw new Error("Tests require DATABASE_URL (use a dedicated test DB, e.g. postgres://...lire_help_test).");
}
if (!process.env.DATABASE_URL.includes("test")) {
  throw new Error("Refusing to run tests against a non-test DATABASE_URL. Include the substring 'test' in the URL.");
}

process.env.NODE_ENV = "test";
process.env.SESSION_SECRET = process.env.SESSION_SECRET ?? "test-secret-not-used-in-prod";

beforeAll(async () => {
  const { truncateAll } = await import("./helpers/seed.js");
  await truncateAll();
});

afterEach(async () => {
  const { truncateAll } = await import("./helpers/seed.js");
  await truncateAll();
});

afterAll(async () => {
  const { closeDb } = await import("./helpers/seed.js");
  await closeDb();
});
