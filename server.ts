// ─── LIRE Help — Full-Stack Express Server ──────────────────────────────────
// Thin entrypoint that builds the app via buildApp() and binds it to a port.

import { buildApp } from "./server/app-factory.js";

async function main() {
  const app = await buildApp();
  const PORT = process.env.PORT || 5000;
  const isDev = process.env.NODE_ENV !== "production";
  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`LIRE Help running on port ${PORT} (${isDev ? "development" : "production"})`);
  });
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
