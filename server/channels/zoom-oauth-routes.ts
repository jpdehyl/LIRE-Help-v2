// Zoom OAuth start + callback. Mounted at /auth/zoom in app-factory.
//
// Flow:
//   1. An operator visits /auth/zoom/start. We redirect to Zoom's consent
//      screen with response_type=code and a CSRF state cookie.
//   2. Zoom redirects the browser back to /auth/zoom/callback?code=...&state=...
//   3. We verify state, POST the code to Zoom for an access + refresh
//      token pair, persist, show a success page.
//
// Hand-rolled instead of an OAuth library because the surface is small
// and we only talk to Zoom — one file is less ceremony than a generic
// OAuth client.

import { Router, type Request, type Response } from "express";
import { randomBytes } from "node:crypto";
import { buildAuthorizeUrl, exchangeAuthorizationCode, saveZoomTokens } from "./zoom-oauth.js";

// CSRF state stashed in express-session. Session middleware is already
// mounted globally in app-factory, so this piggybacks without adding a
// cookie-parser dep.
interface ZoomOauthSession {
  zoomOauthState?: string;
}

const router = Router();

router.get("/start", (req: Request, res: Response) => {
  const state = randomBytes(16).toString("hex");
  (req.session as unknown as ZoomOauthSession).zoomOauthState = state;
  try {
    res.redirect(buildAuthorizeUrl(state));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).type("text/plain").send(`Zoom OAuth not configured: ${msg}`);
  }
});

router.get("/callback", async (req: Request, res: Response) => {
  const code = typeof req.query.code === "string" ? req.query.code : null;
  const state = typeof req.query.state === "string" ? req.query.state : null;
  const sessionState = (req.session as unknown as ZoomOauthSession).zoomOauthState ?? null;

  if (!code || !state || !sessionState || sessionState !== state) {
    res.status(400).type("text/plain").send("Invalid OAuth callback (missing code or state mismatch).");
    return;
  }
  delete (req.session as unknown as ZoomOauthSession).zoomOauthState;

  try {
    const token = await exchangeAuthorizationCode(code);
    await saveZoomTokens(token);
    res
      .status(200)
      .type("text/html")
      .send(
        `<!doctype html><meta charset="utf-8"><title>Zoom connected</title>` +
          `<h1>Zoom connected</h1>` +
          `<p>The concierge can now send replies on Zoom Team Chat. You can close this tab.</p>`,
      );
  } catch (err) {
    console.error("[zoom-oauth] callback failed", err);
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).type("text/plain").send(`Zoom OAuth callback failed: ${msg}`);
  }
});

export default router;
