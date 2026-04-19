// ─── LIRE Help — App Factory ────────────────────────────────────────────────
// Builds and returns the configured Express app (no .listen call).
// Used by server.ts (main entrypoint) and by the test harness.

import express, { type Request, type Response } from "express";
import helmet from "helmet";
import path from "path";
import { z } from "zod";
import { isCorsOriginAllowed, parseAllowedHosts } from "./platform/cors.js";
import { redact } from "./helpers/redact.js";

export type BuildAppOptions = {
  rootDir?: string;
};

export async function buildApp(options: BuildAppOptions = {}): Promise<express.Express> {
  // bundleDir resolves to <repo>/server in dev (ESM via tsx, import.meta.url points
  // at this file) or <repo>/dist in prod (CJS via esbuild, __dirname is the bundle
  // output dir). In both cases the repo root is exactly one level up.
  const bundleDir = typeof __dirname !== "undefined" ? __dirname : path.dirname(new URL(import.meta.url).pathname);
  const root = options.rootDir ?? path.resolve(bundleDir, "..");

  const app = express();
  const nodeEnv = process.env.NODE_ENV ?? "development";
  const isProd = nodeEnv === "production";
  const isTest = nodeEnv === "test";
  const isDev = !isProd && !isTest;
  const sessionSecret = process.env.SESSION_SECRET;
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

  if (!sessionSecret && isProd) {
    throw new Error("SESSION_SECRET is required in production");
  }

  if (!ANTHROPIC_API_KEY) {
    console.warn("[startup] ANTHROPIC_API_KEY is not set — AI concierge (/api/chat) will return a graceful 'not configured' response.");
  } else {
    console.log("[startup] ANTHROPIC_API_KEY configured — AI concierge is active.");
  }

  // Trust Railway's reverse proxy (needed for secure cookies)
  app.set("trust proxy", 1);

  // ─── Security & parsing ───────────────────────────────────────────────────

  // B9: strict Content-Security-Policy in production. Kept off in dev so the Vite
  // middleware + HMR websockets + inline scripts keep working. Once Azure Blob is
  // in play, add the storage account hostname to img-src / connect-src via env.
  app.use(
    helmet({
      contentSecurityPolicy: isProd
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", "data:", "https://*.lire-help.com", "https://*.blob.core.windows.net"],
              connectSrc: ["'self'", "https://*.lire-help.com"],
              frameAncestors: ["'none'"],
              objectSrc: ["'none'"],
              baseUri: ["'self'"],
            },
          }
        : false,
      crossOriginEmbedderPolicy: false,
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    }),
  );
  // H15: bound the global JSON parser. Matches express's historical default but
  // is stated explicitly so a future dep bump can't silently widen it. Reuse a
  // single parser instance to avoid per-request allocation.
  const defaultJsonParser = express.json({ limit: "100kb" });
  app.use((req, res, next) => {
    // B7 carve-out: the credit upload route mounts its own 35MB parser.
    if (req.path === "/api/pilots/credit/documents/upload") return next();
    return defaultJsonParser(req, res, next);
  });

  // ─── CORS ─────────────────────────────────────────────────────────────────

  const extraAllowedHosts = parseAllowedHosts(process.env.CORS_ALLOWED_HOSTS);

  app.use((req, res, next) => {
    const origin = req.headers.origin ?? "";
    const allowed = isCorsOriginAllowed(origin, { isProd, extraAllowedHosts });
    if (allowed) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Access-Control-Allow-Credentials", "true");
      res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
      res.header("Access-Control-Allow-Headers", "Content-Type,Authorization");
    }
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });

  // ─── Session (PostgreSQL-backed) ──────────────────────────────────────────

  const session = (await import("express-session")).default;
  const ConnectPgSimple = (await import("connect-pg-simple")).default;
  const PgSession = ConnectPgSimple(session);

  const pg = await import("pg");
  const sessionPool = new pg.default.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: isProd ? { rejectUnauthorized: false } : undefined,
  });

  if (!isTest) {
    sessionPool.query("SELECT 1 as test").then(() => {
      console.log("[session] pg Pool connected OK");
    }).catch((err: unknown) => {
      console.error("[session] pg Pool connection FAILED:", err);
    });
  }

  await sessionPool.query(`
    CREATE TABLE IF NOT EXISTS staff_sessions (
      sid varchar NOT NULL COLLATE "default",
      sess json NOT NULL,
      expire timestamp(6) NOT NULL,
      CONSTRAINT staff_sessions_pkey PRIMARY KEY (sid)
    )
  `);
  await sessionPool.query(`
    CREATE INDEX IF NOT EXISTS idx_staff_sessions_expire ON staff_sessions (expire)
  `);

  app.use(
    session({
      store: new PgSession({
        pool: sessionPool,
        tableName: "staff_sessions",
        createTableIfMissing: false,
      }),
      secret: sessionSecret ?? "lire-help-secret-dev",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: isProd,
        httpOnly: true,
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
        domain: process.env.COOKIE_DOMAIN || undefined,
      },
    }),
  );

  // ─── API route modules ────────────────────────────────────────────────────

  const { default: authRoutes } = await import("./auth-routes.js");
  const { default: propertiesRoutes } = await import("./properties-routes.js");
  const { default: agentsRoutes } = await import("./agents-routes.js");
  const { default: staffRoutes } = await import("./staff-routes.js");
  const { default: knowledgeRoutes } = await import("./knowledge-routes.js");
  const { default: platformSessionsRoutes } = await import("./platform-sessions-routes.js");
  const { default: helpdeskRoutes } = await import("./helpdesk-routes.js");
  const { logTokenUsage } = await import("./token-logger.js");
  const { default: metricsRoutes } = await import("./metrics-routes.js");
  const { default: leasingRoutes } = await import("./pilots/leasing/routes.js");
  const { default: creditRoutes } = await import("./pilots/credit/routes.js");
  const { default: twilioRoutes } = await import("./channels/twilio-routes.js");

  app.use("/api/auth", authRoutes);
  app.use("/api/properties", propertiesRoutes);
  app.use("/api/agents", agentsRoutes);
  app.use("/api/staff", staffRoutes);
  app.use("/api/knowledge", knowledgeRoutes);
  app.use("/api/platform-sessions", platformSessionsRoutes);
  app.use("/api/helpdesk", helpdeskRoutes);
  app.use("/api/admin/metrics", metricsRoutes);
  app.use("/api/pilots/leasing", leasingRoutes);
  app.use("/api/pilots/credit", creditRoutes);
  // Twilio posts form-encoded, not JSON — the route mounts its own
  // urlencoded parser so we don't widen the global one.
  app.use("/webhooks/twilio", twilioRoutes);

  // ─── /api/public/brand ────────────────────────────────────────────────────

  app.get("/api/public/brand", async (req: Request, res: Response) => {
    const host = (req.query.host as string) || req.hostname || "";
    const parts = host.split(".");
    const subdomain = parts.length >= 3 ? parts[0] : "";
    const isTenantLogin = subdomain && subdomain !== "app" && subdomain !== "www";

    if (!isTenantLogin) {
      return res.json({
        name: "LIRE Help",
        agentName: "LIRE Agent",
        primaryColor: "#0F2942",
      });
    }

    try {
      const { db } = await import("./db.js");
      const { properties } = await import("../shared/schema.js");
      const { ilike } = await import("drizzle-orm");

      const [prop] = await db
        .select({
          name: properties.name,
          agentName: properties.agentName,
          brandingJson: properties.brandingJson,
        })
        .from(properties)
        .where(ilike(properties.slug, subdomain))
        .limit(1);

      if (prop) {
        return res.json({
          name: prop.name,
          agentName: prop.agentName ?? "LIRE Agent",
          primaryColor: prop.brandingJson?.primaryColor ?? "#0F2942",
          logoUrl: prop.brandingJson?.logoUrl ?? null,
        });
      }

      return res.json({
        name: "LIRE Help",
        agentName: "LIRE Agent",
        primaryColor: "#0F2942",
      });
    } catch (err) {
      console.error("Brand lookup error:", err);
      return res.json({
        name: "LIRE Help",
        agentName: "LIRE Agent",
        primaryColor: "#0F2942",
      });
    }
  });

  // ─── System Prompt (concierge) — base instructions + dynamic KB ───────────

  async function resolveTenantIdFromHost(req: Request): Promise<string | null> {
    const host = (req.headers.host ?? "").toLowerCase();
    if (!host) return null;
    const hostname = host.split(":")[0] ?? "";
    const parts = hostname.split(".");
    const sub = parts.length >= 3 ? parts[0] : "";
    if (!sub || sub === "app" || sub === "www") return null;
    try {
      const { db } = await import("./db.js");
      const { tenants } = await import("../shared/schema.js");
      const { eq } = await import("drizzle-orm");
      const [row] = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.slug, sub)).limit(1);
      return row?.id ?? null;
    } catch (err) {
      console.error("[chat] tenant resolve error:", err);
      return null;
    }
  }

  async function buildSystemPrompt(tenantId: string | null): Promise<string> {
    let kbContent = "";
    if (tenantId) {
      try {
        const { getPlatformKnowledge } = await import("./storage.js");
        const entries = await getPlatformKnowledge(tenantId);
        if (entries.length > 0) {
          kbContent = "\n\nPROPERTY KNOWLEDGE BASE (from database — this is your source of truth):\n\n" +
            entries.map(e => `## ${e.title}\n${e.content}`).join("\n\n");
        }
      } catch (err) {
        console.error("[chat] KB fetch error:", err);
      }
    }

    return `You are the LIRE Help Concierge — an AI-powered tenant assistant for light industrial real estate properties.

REAL-WORLD CONTEXT:
Today's date: ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
Platform: ${process.env.PLATFORM_NAME || "LIRE-Help — AI-powered Industrial Property Management"}
Target market: ${process.env.PLATFORM_MARKET || "Industrial/commercial real estate (warehouses, logistics, manufacturing facilities)"}
Region: ${process.env.PLATFORM_REGION || "North America (US and Canada)"}
Timezone: ${process.env.PLATFORM_TIMEZONE || "America/New_York"}

CRITICAL: Only reference real property management concepts and industry practices. Never invent tenant names, lease details, or property data not in the system.

Your mission: help tenants get answers fast, submit maintenance requests, and navigate their lease and property details — 24/7, without waiting on hold or sending emails into a void.

${kbContent ? "IMPORTANT: Use the PROPERTY KNOWLEDGE BASE below as your primary source of truth. If info is in the KB, use it. If not in the KB, say you don't have that specific information and offer to escalate." : ""}

ABOUT LIRE HELP:
- LIRE Help (Light Industrial Real Estate Help) is an AI operations platform for property managers
- Each property gets its own trained concierge that knows its specific rules, contacts, and procedures
- Available 24/7/365 via web chat — tenants never wait
- Property managers maintain full oversight through a real-time dashboard
- Complex issues escalate to the right person, fast

TYPES OF PROPERTIES SERVED:
LIRE Help serves light industrial property managers and owners across the US, focused on:
- Warehouses and distribution centers (10,000–100,000 sq ft)
- Flex industrial spaces (office + warehouse combos)
- Last-mile logistics facilities
- Cold storage and specialty industrial

KEY SERVICES YOU PROVIDE:

1. Maintenance Requests
   - Accept and log maintenance requests with full details (location, urgency, description, photos)
   - Provide ticket numbers and estimated response times
   - Track request status and follow up proactively
   - Emergency protocols for after-hours urgent issues (water leaks, power outages, security)

2. Property Information
   - Loading dock hours and procedures
   - Parking rules and assigned spaces
   - Building access (key cards, gates, after-hours access)
   - Shared amenities (break rooms, restrooms, conference rooms)
   - Waste management and recycling schedules

3. Lease & Billing FAQ
   - NNN (triple net) lease structure explanation
   - CAM (Common Area Maintenance) charges breakdown
   - Rent payment portal and methods
   - Tenant improvement (TI) allowance process
   - Lease renewal timelines and contacts

4. Compliance & Safety
   - Fire safety and emergency evacuation routes
   - OSHA compliance reminders for industrial tenants
   - Hazardous materials storage and disposal rules
   - ADA accessibility information
   - Insurance requirements (COI submissions)

5. Community & Communication
   - Property-wide announcements and notices
   - Scheduled maintenance windows
   - Neighbor contact protocols (noise, shared spaces)
   - Property management team directory

${kbContent}

TONE AND STYLE:
- Professional but approachable — think "helpful building manager who actually responds"
- Clear and direct — no corporate jargon
- Responses should be concise: 2–3 sentences max unless the tenant asks for detail
- Use specific details when available (hours, contacts, procedures)
- Always confirm what action you're taking or recommend as a next step
- For maintenance requests, always collect: unit number, description, urgency level (routine/urgent/emergency)

FORMATTING RULES:
- When you need to ask the user multiple questions or collect several pieces of information, ALWAYS use a numbered list — never put all questions in one run-on sentence
- Example (GOOD):
  To log this, I need a few details:
  1. Which unit are you in?
  2. Which door — loading dock, entry, or interior?
  3. Is this an emergency or can it wait until tomorrow?
- Example (BAD): "Which unit are you in and which door is it and is it an emergency?"
- When listing options, hours, contacts, or steps, use bullet points or numbered lists
- Keep each list item to one line when possible

CONTEXT AWARENESS:
- ALWAYS review the ENTIRE conversation history before responding
- Remember what the tenant already told you (unit number, issue, name) — do NOT ask again for information they already provided
- Build on previous exchanges — your responses should show you understand the full context, not just the last message

NATURAL CONVERSATION:
- ALWAYS consider what you already said in previous messages — do NOT repeat the same information unless the user specifically asks to go deeper
- If you already gave a piece of data, reference it ("as I mentioned") instead of restating it
- VARY your response structure — sometimes direct answer, sometimes clarifying question, sometimes relevant context
- Do NOT follow a rigid template for every response
- NEVER start two consecutive responses the same way
- Sound like a real person having a conversation, not a programmed bot giving scripted answers
- If the user asks something you already covered, acknowledge it and add NEW information or a different angle

ACCESS CONTROL — IMPORTANT:
- Before sharing ANY property-specific information (tenant directory, lease terms, unit details, emergency contacts, vendor info, access codes), you MUST first ask: "What unit are you in?" or "Can you confirm your unit number?"
- GENERAL information is OK for anyone: dock hours, property address, general building rules, how to contact leasing
- SENSITIVE information requires unit identification: tenant directory, specific lease terms, maintenance history, security protocols, vendor contacts, emergency procedures
- If someone asks a sensitive question without identifying their unit, say: "I'd be happy to help with that! For security, could you first confirm which unit you're in?"
- Once they provide a unit number, respond normally for the rest of the conversation
- This protects tenant privacy — we don't share property details with anonymous visitors

WHEN TO ESCALATE:
When the tenant:
- Has a billing dispute or lease question beyond FAQ
- Reports an emergency (water, fire, security breach)
- Wants to discuss lease renewal, expansion, or termination
- Has been waiting 48+ hours on an unresolved maintenance ticket
- Requests to speak with a person
→ Respond with your normal message AND add exactly [ESCALATE] at the end

MAINTENANCE REQUEST FORMAT:
When a tenant submits a maintenance request, collect:
1. Unit number
2. Description of the issue
3. Urgency: Routine (5 business days) / Urgent (24 hours) / Emergency (immediate)
4. Best contact method and availability for access
Then confirm with a ticket summary and expected response time.

RESTRICTIONS:
- NEVER mention that you are Claude, Anthropic, GPT, OpenAI, or any external AI model
- You are the LIRE Help Concierge — if asked about the technology, say it's a proprietary AI platform built by DeHyl for light industrial property management
- Do not make up property details, contacts, or procedures not in the Knowledge Base above
- Do not provide legal advice — direct lease disputes to the property manager
- Do not share other tenants' information`;
  }

  // ─── Rate limiting (chat endpoint) ─────────────────────────────────────────

  const { chatPerMinuteLimiter, chatPerDayLimiter } = await import("./helpers/rate-limiters.js");

  // B1: strict input shape. Anonymous callers hit this endpoint, so we cap
  // content length, message count, and reject spoofed system-role entries.
  const chatBodySchema = z.object({
    messages: z.array(z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().min(1).max(4000),
    })).min(1).max(20),
    sessionId: z.string().max(128).optional(),
  });

  // ─── Chat endpoint (concierge) ────────────────────────────────────────────

  app.post("/api/chat", chatPerMinuteLimiter, chatPerDayLimiter, async (req: Request, res: Response) => {
    try {
      const parsed = chatBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "invalid_payload", issues: parsed.error.issues });
      }

      if (!ANTHROPIC_API_KEY) {
        return res.status(200).json({
          response: "The AI concierge is not configured yet. Please ask your property manager for assistance or contact the leasing office directly.",
          escalate: false,
        });
      }

      const trimmed = parsed.data.messages.slice(-20);
      const tenantId = await resolveTenantIdFromHost(req);

      const upstream = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 512,
          system: await buildSystemPrompt(tenantId),
          messages: trimmed,
        }),
      });

      if (!upstream.ok) {
        const errText = await upstream.text();
        console.error("[chat] anthropic upstream", upstream.status, redact(errText));
        return res.status(502).json({ error: "upstream_error" });
      }

      const data = (await upstream.json()) as {
        content?: Array<{ text?: string }>;
        usage?: { input_tokens: number; output_tokens: number };
      };
      const raw = data.content?.[0]?.text ?? "";
      // Only honor [ESCALATE] when it appears at the trailing edge of the reply.
      // The user can trivially include the literal token in their message history
      // and nudge the model to echo it mid-reply; that shouldn't poison metrics.
      const trailing = raw.trim().endsWith("[ESCALATE]");
      const response = raw.replace(/\[ESCALATE\]\s*$/, "").trim();

      if (parsed.data.sessionId) {
        console.log(`[${parsed.data.sessionId}] ${trimmed.length + 1} msgs, escalated: ${trailing}`);
      }

      // Non-blocking token logging
      if (data.usage) {
        logTokenUsage({
          tenantId: tenantId ?? null,
          sessionId: parsed.data.sessionId ?? null,
          operation: "concierge_chat",
          model: "claude-haiku-4-5-20251001",
          inputTokens: data.usage.input_tokens,
          outputTokens: data.usage.output_tokens,
        });
      }

      res.json({ response, escalate: trailing });
    } catch (err: unknown) {
      console.error("[chat]", err instanceof Error ? err.message : err);
      res.status(500).json({ error: "chat_failed" });
    }
  });

  // ─── Health check ─────────────────────────────────────────────────────────

  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", service: "lire-help" });
  });

  // ─── Setup endpoint hard-disabled ──────────────────────────────────────────

  app.all("/api/setup", (_req: Request, res: Response) => {
    return res.status(410).json({
      error: "setup_endpoint_disabled",
      message: "Bootstrap via migrations and env-driven scripts only.",
    });
  });

  // ─── Static file serving ──────────────────────────────────────────────────
  // Skipped entirely in tests so we don't need a build artifact and we don't
  // pull in the Vite dev middleware.

  // The SPA owns "/" (marketing landing) as well as the authenticated app
  // surfaces. public/index.html (the old static design prototype) is no longer
  // served; static middleware runs with { index: false } so it can't shadow
  // the SPA at "/".

  if (isTest) {
    // no-op
  } else if (isDev) {
    app.use(express.static(path.join(root, "public"), { index: false }));
    const { setupVite } = await import("./vite.js");
    await setupVite(app);
  } else {
    const adminDir = path.join(root, "dist", "admin");
    const marketingDir = path.join(root, "public");
    const spaRoutePrefixes = [
      "/login",
      "/dashboard",
      "/inbox",
      "/tickets",
      "/customers",
      "/settings",
      "/leasing",
      "/credit-review",
      "/platform-dashboard",
    ] as const;

    const isSpaRoute = (pathname: string) => (
      pathname === "/" ||
      spaRoutePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
    );

    app.use("/app", express.static(adminDir));
    app.use(express.static(marketingDir, { index: false }));

    app.get("*", (req: Request, res: Response, next) => {
      if (req.path.startsWith("/api/") || req.path.startsWith("/app/") || path.extname(req.path)) {
        return next();
      }

      if (!isSpaRoute(req.path)) {
        return next();
      }

      return res.sendFile(path.join(adminDir, "index.html"));
    });
  }

  return app;
}
