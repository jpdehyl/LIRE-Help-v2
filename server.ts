// ─── LIRE Help — Full-Stack Express Server ──────────────────────────────────
// Serves admin SPA, landing page, API routes, and /api/chat concierge endpoint.

import express, { type Request, type Response } from "express";
import helmet from "helmet";
import path from "path";

// In CJS (esbuild output): __dirname = dist/, so resolve project root one level up
const bundleDir = typeof __dirname !== "undefined" ? __dirname : path.dirname(new URL(import.meta.url).pathname);
const root = path.resolve(bundleDir, "..");

async function main() {
  const app = express();
  const PORT = process.env.PORT || 3000;
  const isDev = process.env.NODE_ENV !== "production";
  const sessionSecret = process.env.SESSION_SECRET;
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

  if (!sessionSecret && !isDev) {
    throw new Error("SESSION_SECRET is required in production");
  }

  // Trust Railway's reverse proxy (needed for secure cookies)
  app.set("trust proxy", 1);

  // ─── Security & parsing ───────────────────────────────────────────────────

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(express.json());

  // ─── CORS ─────────────────────────────────────────────────────────────────

  app.use((req, res, next) => {
    const origin = req.headers.origin ?? "";
    const allowed =
      /\.lire-help\.com$/.test(origin) ||
      origin.startsWith("http://localhost") ||
      origin.startsWith("http://127.0.0.1");

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
    ssl: !isDev ? { rejectUnauthorized: false } : undefined,
  });

  // Debug: test session pool on startup
  sessionPool.query("SELECT 1 as test").then(() => {
    console.log("[session] pg Pool connected OK");
  }).catch((err: unknown) => {
    console.error("[session] pg Pool connection FAILED:", err);
  });

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
        secure: !isDev,
        httpOnly: true,
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
        domain: process.env.COOKIE_DOMAIN || undefined,
      },
    }),
  );

  // ─── API route modules ────────────────────────────────────────────────────

  const { default: authRoutes } = await import("./server/auth-routes.js");
  const { default: propertiesRoutes } = await import("./server/properties-routes.js");
  const { default: agentsRoutes } = await import("./server/agents-routes.js");
  const { default: staffRoutes } = await import("./server/staff-routes.js");
  const { default: knowledgeRoutes } = await import("./server/knowledge-routes.js");
  const { default: platformSessionsRoutes } = await import("./server/platform-sessions-routes.js");
  const { default: helpdeskRoutes } = await import("./server/helpdesk-routes.js");
  const { logTokenUsage } = await import("./server/token-logger.js");
  const { default: metricsRoutes } = await import("./server/metrics-routes.js");

  app.use("/api/auth", authRoutes);
  app.use("/api/properties", propertiesRoutes);
  app.use("/api/agents", agentsRoutes);
  app.use("/api/staff", staffRoutes);
  app.use("/api/knowledge", knowledgeRoutes);
  app.use("/api/platform-sessions", platformSessionsRoutes);
  app.use("/api/helpdesk", helpdeskRoutes);
  app.use("/api/admin/metrics", metricsRoutes);

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
      const { db } = await import("./server/db.js");
      const { properties } = await import("./shared/schema.js");
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

  async function buildSystemPrompt(): Promise<string> {
    // Fetch KB entries from database
    let kbContent = "";
    try {
      const { getPlatformKnowledge } = await import("./server/storage.js");
      const entries = await getPlatformKnowledge();
      if (entries.length > 0) {
        kbContent = "\n\nPROPERTY KNOWLEDGE BASE (from database — this is your source of truth):\n\n" +
          entries.map(e => `## ${e.title}\n${e.content}`).join("\n\n");
      }
    } catch (err) {
      console.error("[chat] KB fetch error:", err);
    }

    return `You are the LIRE Help Concierge — an AI-powered tenant assistant for light industrial real estate properties.

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

  const { default: rateLimit } = await import("express-rate-limit");
  const chatLimiter = rateLimit({ windowMs: 60_000, max: 15, message: { error: "Too many requests. Please wait a moment." } });

  // ─── Chat endpoint (concierge) ────────────────────────────────────────────

  app.post("/api/chat", chatLimiter, async (req: Request, res: Response) => {
    try {
      const { messages, sessionId } = req.body;

      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: "messages required" });
      }

      if (!ANTHROPIC_API_KEY) {
        return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });
      }

      const trimmed = messages.slice(-20);

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
          system: await buildSystemPrompt(),
          messages: trimmed,
        }),
      });

      if (!upstream.ok) {
        const err = await upstream.text();
        console.error("Anthropic error:", upstream.status, err);
        return res.status(502).json({ error: "upstream_error", detail: err });
      }

      const data = (await upstream.json()) as {
        content?: Array<{ text?: string }>;
        usage?: { input_tokens: number; output_tokens: number };
      };
      const raw = data.content?.[0]?.text ?? "";
      const escalate = raw.includes("[ESCALATE]");
      const response = raw.replace("[ESCALATE]", "").trim();

      if (sessionId) {
        console.log(`[${sessionId}] ${trimmed.length + 1} msgs, escalated: ${escalate}`);
      }

      // Non-blocking token logging
      if (data.usage) {
        logTokenUsage({
          sessionId: sessionId ?? null,
          operation: "concierge_chat",
          model: "claude-haiku-4-5-20251001",
          inputTokens: data.usage.input_tokens,
          outputTokens: data.usage.output_tokens,
        });
      }

      res.json({ response, escalate });
    } catch (err: unknown) {
      console.error("Chat error:", err);
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: message });
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

  if (isDev) {
    const { setupVite } = await import("./server/vite.js");
    await setupVite(app);
    app.use(express.static(path.join(root, "public")));
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
      "/platform-dashboard",
    ] as const;

    const isSpaRoute = (pathname: string) => (
      spaRoutePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
    );

    app.use("/app", express.static(adminDir));
    app.use(express.static(marketingDir));

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

  // ─── Start ────────────────────────────────────────────────────────────────

  app.listen(PORT, () => {
    console.log(`LIRE Help running on port ${PORT} (${isDev ? "development" : "production"})`);
  });
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
