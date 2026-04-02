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
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

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

  const { Pool } = await import("pg");
  const sessionPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: !isDev ? { rejectUnauthorized: false } : undefined,
  });

  app.use(
    session({
      store: new PgSession({
        pool: sessionPool,
        tableName: "staff_sessions",
        createTableIfMissing: true,
      }),
      secret: process.env.SESSION_SECRET ?? "lire-help-secret-dev",
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

  app.use("/api/auth", authRoutes);
  app.use("/api/properties", propertiesRoutes);
  app.use("/api/agents", agentsRoutes);
  app.use("/api/staff", staffRoutes);
  app.use("/api/knowledge", knowledgeRoutes);
  app.use("/api/platform-sessions", platformSessionsRoutes);

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

  // ─── System Prompt (concierge) ────────────────────────────────────────────

  const SYSTEM_PROMPT = `You are the LIRE Help Concierge — an AI-powered tenant assistant for light industrial real estate properties.

Your mission: help tenants get answers fast, submit maintenance requests, and navigate their lease and property details — 24/7, without waiting on hold or sending emails into a void.

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

DEMO PROPERTY — OAKLAND GATEWAY INDUSTRIAL PARK:
- Address: 1200 Maritime Street, Oakland, CA 94607
- Type: Multi-tenant light industrial / warehouse complex
- Total area: 185,000 sq ft across 12 units (8,000–25,000 sq ft each)
- Loading docks: 18 grade-level doors + 6 dock-high positions
- Clear height: 24 ft
- Power: 400A 3-phase per unit
- Parking: 120 spaces + 8 trailer staging positions
- Security: 24/7 camera surveillance, gated entry with key card access
- Property Manager: Sarah Chen (sarah@oaklandgateway.com)
- Emergency Maintenance: (510) 555-0142
- Leasing: Mike Torres (mike@oaklandgateway.com)

LOADING DOCK RULES:
- Dock hours: Monday–Saturday, 6:00 AM – 10:00 PM
- Overnight parking of trailers requires 48-hour advance notice
- Maximum trailer dwell time: 4 hours at dock positions
- Shared dock scheduling via the tenant portal or this concierge
- No idling engines beyond 5 minutes (BAAQMD regulation)

HVAC & MAINTENANCE SCHEDULES:
- HVAC preventive maintenance: quarterly (Jan, Apr, Jul, Oct) — tenants notified 7 days in advance
- Roof inspections: semi-annual (March, September)
- Fire sprinkler testing: annual (February) — requires clear 18" below sprinkler heads
- Parking lot sweeping: weekly (Sundays, 6–9 AM)
- Landscaping: bi-weekly (Tuesdays)
- Pest control: monthly (first Wednesday) — interior treatment available on request

EMERGENCY CONTACTS:
- Fire/Police/Medical: 911
- Property Emergency Line (24/7): (510) 555-0142
- Water leak / flooding: Call emergency line → maintenance dispatched within 30 min
- Power outage: Check PG&E outage map first → if building-specific, call emergency line
- Security concern: Call emergency line + activate panic button at main entrance

RENT & LEASE INFO:
- Lease type: NNN (Triple Net) — tenant pays base rent + proportional share of taxes, insurance, and CAM
- CAM charges typically include: landscaping, parking lot maintenance, security, common area utilities, property management fee
- Rent due: 1st of each month, 5-day grace period
- Payment: Online portal (portal.oaklandgateway.com), ACH, or check
- Late fee: 5% after the 5th
- Lease renewal: management reaches out 180 days before expiration
- TI requests: submit via property manager, typical approval 2–4 weeks

PEST CONTROL:
- Exterior perimeter treatment: monthly
- Interior treatment: available on request (schedule via this concierge)
- Rodent bait stations: checked monthly at all dock doors
- Tenant responsibility: keep dock doors closed when not in active use, no food storage in warehouse areas
- Report pest sightings immediately — we respond within 24 hours

TONE AND STYLE:
- Professional but approachable — think "helpful building manager who actually responds"
- Clear and direct — no corporate jargon
- Responses should be concise: 2–3 sentences max unless the tenant asks for detail
- Use specific details when available (hours, contacts, procedures)
- Always confirm what action you're taking or recommend as a next step
- For maintenance requests, always collect: unit number, description, urgency level (routine/urgent/emergency)

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
- Do not make up property details, contacts, or procedures not in this prompt
- Do not provide legal advice — direct lease disputes to the property manager
- Do not share other tenants' information`;

  // ─── Chat endpoint (concierge) ────────────────────────────────────────────

  app.post("/api/chat", async (req: Request, res: Response) => {
    try {
      const { messages, sessionId } = req.body;

      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: "messages required" });
      }

      if (!ANTHROPIC_API_KEY) {
        return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });
      }

      const trimmed = messages.slice(-10);

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
          system: SYSTEM_PROMPT,
          messages: trimmed,
        }),
      });

      if (!upstream.ok) {
        const err = await upstream.text();
        console.error("Anthropic error:", err);
        return res.status(502).json({ error: "upstream_error" });
      }

      const data = (await upstream.json()) as {
        content?: Array<{ text?: string }>;
      };
      const raw = data.content?.[0]?.text ?? "";
      const escalate = raw.includes("[ESCALATE]");
      const response = raw.replace("[ESCALATE]", "").trim();

      if (sessionId) {
        console.log(`[${sessionId}] ${trimmed.length + 1} msgs, escalated: ${escalate}`);
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

  // ─── One-time setup (push schema + seed superadmin) ───────────────────────
  // Hit /api/setup?key=LIRE2026 once, then remove this endpoint.

  app.get("/api/setup", async (req: Request, res: Response) => {
    if (req.query.key !== "LIRE2026") return res.status(403).json({ error: "forbidden" });

    const results: string[] = [];
    try {
      const pg = (await import("postgres")).default;
      const bcrypt = (await import("bcrypt")).default;
      const sql = pg(process.env.DATABASE_URL!, { ssl: { rejectUnauthorized: false } });

      // 1. Create all tables
      await sql`CREATE TABLE IF NOT EXISTS tenants (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, plan TEXT NOT NULL DEFAULT 'starter',
        billing_email TEXT, phone TEXT, country TEXT DEFAULT 'US', timezone TEXT DEFAULT 'America/Los_Angeles',
        is_active BOOLEAN NOT NULL DEFAULT true, trial_ends_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT now(), updated_at TIMESTAMP NOT NULL DEFAULT now()
      )`;
      results.push("tenants table OK");

      await sql`CREATE TABLE IF NOT EXISTS properties (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, description TEXT, location TEXT,
        lat DOUBLE PRECISION, lng DOUBLE PRECISION, tenant_id VARCHAR REFERENCES tenants(id),
        agent_name TEXT, agent_emoji TEXT, agent_tagline TEXT, agent_greeting TEXT, agent_personality TEXT,
        branding_json JSONB DEFAULT '{}',
        created_at TIMESTAMP NOT NULL DEFAULT now(), updated_at TIMESTAMP NOT NULL DEFAULT now()
      )`;
      results.push("properties table OK");

      await sql`CREATE TABLE IF NOT EXISTS agents (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        property_id VARCHAR NOT NULL UNIQUE REFERENCES properties(id), tenant_id VARCHAR REFERENCES tenants(id),
        name TEXT NOT NULL DEFAULT 'LIRE Agent', emoji TEXT NOT NULL DEFAULT 'LH',
        tagline TEXT, greeting TEXT, personality TEXT, is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT now(), updated_at TIMESTAMP NOT NULL DEFAULT now()
      )`;
      results.push("agents table OK");

      await sql`CREATE TABLE IF NOT EXISTS staff_users (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'readonly', tenant_id VARCHAR, property_id VARCHAR,
        is_active BOOLEAN NOT NULL DEFAULT true, whatsapp_number TEXT, last_login_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT now(), updated_at TIMESTAMP NOT NULL DEFAULT now()
      )`;
      results.push("staff_users table OK");

      await sql`CREATE TABLE IF NOT EXISTS platform_knowledge (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        section TEXT NOT NULL, title TEXT NOT NULL, content TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT now(), updated_at TIMESTAMP NOT NULL DEFAULT now()
      )`;
      results.push("platform_knowledge table OK");

      await sql`CREATE TABLE IF NOT EXISTS platform_sessions (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id TEXT NOT NULL UNIQUE, messages JSONB DEFAULT '[]',
        message_count INTEGER NOT NULL DEFAULT 0, escalated_to_wa BOOLEAN NOT NULL DEFAULT false,
        is_analyzed BOOLEAN NOT NULL DEFAULT false, summary TEXT,
        tipo_consulta TEXT, intencion TEXT, tags JSONB DEFAULT '[]',
        is_lead BOOLEAN NOT NULL DEFAULT false, property_type TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT now(), last_message_at TIMESTAMP NOT NULL DEFAULT now()
      )`;
      results.push("platform_sessions table OK");

      // 2. Seed superadmin
      const hash = await bcrypt.hash("LIREhelp2026", 12);
      await sql`
        INSERT INTO staff_users (email, password_hash, name, role)
        VALUES ('mune100g@gmail.com', ${hash}, 'Alejandro Dominguez', 'superadmin')
        ON CONFLICT (email) DO UPDATE SET password_hash = ${hash}, role = 'superadmin', updated_at = now()
      `;
      results.push("superadmin seeded OK");

      await sql.end();
      res.json({ status: "ok", results });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      results.push(`ERROR: ${msg}`);
      res.status(500).json({ status: "error", results });
    }
  });

  // ─── Static file serving ──────────────────────────────────────────────────

  if (isDev) {
    const { setupVite } = await import("./server/vite.js");
    await setupVite(app);
    app.use(express.static(path.join(root, "public")));
  } else {
    const adminDir = path.join(root, "dist", "admin");
    app.use("/app", express.static(adminDir));

    const spaFallback = (_req: Request, res: Response) => {
      res.sendFile(path.join(adminDir, "index.html"));
    };
    app.get("/login", spaFallback);
    app.get("/dashboard", spaFallback);
    app.get("/dashboard/*", spaFallback);

    app.use(express.static(path.join(root, "public")));
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
