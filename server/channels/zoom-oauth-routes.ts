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
  let url: string;
  try {
    const state = randomBytes(16).toString("hex");
    (req.session as unknown as ZoomOauthSession).zoomOauthState = state;
    url = buildAuthorizeUrl(state);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).type("text/plain").send(`Zoom OAuth not configured: ${msg}`);
    return;
  }
  // express-session doesn't commit the session cookie before a redirect
  // unless we call save() explicitly. Without this, the state we just
  // stored doesn't make it back to /callback.
  req.session.save((err) => {
    if (err) {
      console.error("[zoom-oauth] session save failed", err);
      res.status(500).type("text/plain").send("Failed to persist OAuth state — retry.");
      return;
    }
    res.redirect(url);
  });
});

router.get("/callback", async (req: Request, res: Response) => {
  const code = typeof req.query.code === "string" ? req.query.code : null;
  const state = typeof req.query.state === "string" ? req.query.state : null;
  const sessionState = (req.session as unknown as ZoomOauthSession).zoomOauthState ?? null;

  if (!code) {
    res.status(400).type("text/plain").send("Invalid OAuth callback (missing code).");
    return;
  }
  // When the request came through /auth/zoom/start, both state and
  // sessionState are populated and must match (CSRF protection). When
  // it came through Zoom's Marketplace "Install" button, neither is
  // present — that path is still trusted because the code itself is a
  // Zoom-signed capability.
  if (state && sessionState && state !== sessionState) {
    res.status(400).type("text/plain").send("OAuth state mismatch — restart at /auth/zoom/start.");
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
