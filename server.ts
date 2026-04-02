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

  app.use(
    session({
      store: new PgSession({
        pool: sessionPool,
        tableName: "staff_sessions",
        createTableIfMissing: false,
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

  // ─── Diagnostic (temporary) ───────────────────────────────────────────────
  app.get("/api/debug-data", async (_req: Request, res: Response) => {
    try {
      const { db } = await import("./server/db.js");
      const schema = await import("./shared/schema.js");
      const t = await db.select().from(schema.tenants);
      const p = await db.select().from(schema.properties);
      const a = await db.select().from(schema.agents);
      res.json({ tenants: t.length, properties: p.length, agents: a.length, firstTenant: t[0] ?? null });
    } catch (err: unknown) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get("/api/debug-session", async (req: Request, res: Response) => {
    const results: Record<string, unknown> = {};
    try {
      // Test 1: Can pg Pool connect?
      const poolRes = await sessionPool.query("SELECT 1 as connected");
      results.poolConnect = poolRes.rows[0];

      // Test 2: Does staff_sessions table exist?
      const tableCheck = await sessionPool.query(
        "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='staff_sessions')"
      );
      results.staffSessionsTable = tableCheck.rows[0];

      // Test 3: Session object state
      results.sessionID = req.sessionID;
      results.sessionExists = !!req.session;

      // Test 4: Try session save
      (req.session as any).testWrite = Date.now();
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => {
          if (err) {
            results.sessionSaveError = String(err);
            reject(err);
          } else {
            results.sessionSave = "OK";
            resolve();
          }
        });
      });
    } catch (err: unknown) {
      results.error = String(err);
    }
    res.json(results);
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

      await sql`CREATE TABLE IF NOT EXISTS staff_sessions (
        sid VARCHAR NOT NULL COLLATE "default",
        sess JSON NOT NULL,
        expire TIMESTAMP(6) NOT NULL,
        PRIMARY KEY (sid)
      )`;
      await sql`CREATE INDEX IF NOT EXISTS IDX_session_expire ON staff_sessions (expire)`;
      results.push("staff_sessions table OK");

      // 2. Seed superadmin
      const hash = await bcrypt.hash("LIREhelp2026", 12);
      await sql`
        INSERT INTO staff_users (email, password_hash, name, role)
        VALUES ('mune100g@gmail.com', ${hash}, 'Alejandro Dominguez', 'superadmin')
        ON CONFLICT (email) DO UPDATE SET password_hash = ${hash}, role = 'superadmin', updated_at = now()
      `;
      results.push("superadmin seeded OK");

      // 3. Seed Oakland Gateway demo data
      const [tenant] = await sql`
        INSERT INTO tenants (name, slug, plan, billing_email, phone, country, timezone)
        VALUES ('Berkeley Partners', 'berkeley', 'enterprise', 'operations@berkeleypartners.com', '+1 (510) 555-0100', 'US', 'America/Los_Angeles')
        ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, plan = EXCLUDED.plan, updated_at = now()
        RETURNING id, name, slug
      `;
      results.push(`tenant: ${tenant.name}`);

      const [property] = await sql`
        INSERT INTO properties (name, slug, description, location, lat, lng, tenant_id, agent_name, agent_emoji, branding_json)
        VALUES (
          'Oakland Gateway Industrial Park', 'oakland-gateway',
          'Multi-tenant light industrial / warehouse complex — 185,000 sq ft across 12 units. Loading docks, 24/7 security, gated entry.',
          '1200 Maritime Street, Oakland, CA 94607', 37.7955, -122.2822, ${tenant.id},
          'Gateway Concierge', 'LH',
          ${sql.json({ primaryColor: "#0F2942", secondaryColor: "#2563EB", fontFamily: "Inter", darkMode: true })}
        )
        ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, tenant_id = EXCLUDED.tenant_id, updated_at = now()
        RETURNING id, name, slug
      `;
      results.push(`property: ${property.name}`);

      const [agent] = await sql`
        INSERT INTO agents (property_id, tenant_id, name, emoji, tagline, greeting, personality, is_active)
        VALUES (
          ${property.id}, ${tenant.id}, 'Gateway Concierge', 'LH',
          'Your 24/7 industrial property assistant',
          'Welcome to Oakland Gateway Industrial Park! I''m your property concierge. I can help with maintenance requests, dock scheduling, lease questions, and building info. How can I help?',
          'You are the Oakland Gateway Concierge — professional, efficient, knowledgeable about all 12 units, loading dock procedures, and building operations. Respond concisely (2-3 sentences) unless detail is needed.',
          true
        )
        ON CONFLICT (property_id) DO UPDATE SET name = EXCLUDED.name, greeting = EXCLUDED.greeting, personality = EXCLUDED.personality, updated_at = now()
        RETURNING id, name
      `;
      results.push(`agent: ${agent.name}`);

      // Staff team
      const demoHash = await bcrypt.hash("demo2026", 12);
      const team = [
        { email: "sarah.chen@oaklandgateway.com", name: "Sarah Chen", role: "manager" },
        { email: "mike.torres@oaklandgateway.com", name: "Mike Torres", role: "staff" },
        { email: "james.wilson@oaklandgateway.com", name: "James Wilson", role: "staff" },
        { email: "lisa.park@oaklandgateway.com", name: "Lisa Park", role: "staff" },
        { email: "demo@berkeleypartners.com", name: "Berkeley Demo", role: "owner" },
      ];
      for (const m of team) {
        await sql`
          INSERT INTO staff_users (email, password_hash, name, role, tenant_id, property_id, is_active)
          VALUES (${m.email}, ${demoHash}, ${m.name}, ${m.role}, ${tenant.id}, ${property.id}, true)
          ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, updated_at = now()
        `;
      }
      results.push(`staff: ${team.length} members`);

      // Knowledge base
      const kb = [
        { section: "property_overview", title: "Property Overview", content: "**Address:** 1200 Maritime Street, Oakland, CA 94607\n**Type:** Multi-tenant light industrial / warehouse complex\n**Total Area:** 185,000 sq ft across 12 units (8,000-25,000 sq ft each)\n**Loading Docks:** 18 grade-level doors + 6 dock-high positions\n**Clear Height:** 24 ft\n**Power:** 400A 3-phase per unit\n**Parking:** 120 spaces + 8 trailer staging positions\n**Security:** 24/7 camera surveillance, gated entry with key card access" },
        { section: "team_contacts", title: "Property Management Team", content: "**Property Manager:** Sarah Chen — sarah.chen@oaklandgateway.com — (510) 555-0101\n**Leasing Director:** Mike Torres — mike.torres@oaklandgateway.com — (510) 555-0102\n**Maintenance Supervisor:** James Wilson — james.wilson@oaklandgateway.com — (510) 555-0103\n**Compliance Officer:** Lisa Park — lisa.park@oaklandgateway.com — (510) 555-0104\n**Emergency Maintenance (24/7):** (510) 555-0142\n**Security Dispatch:** (510) 555-0150" },
        { section: "loading_dock", title: "Loading Dock Rules & Procedures", content: "**Dock Hours:** Monday-Saturday, 6:00 AM - 10:00 PM\n**Overnight Trailer Parking:** Requires 48-hour advance notice\n**Maximum Trailer Dwell Time:** 4 hours at dock positions\n**No Idling:** Engines off beyond 5 minutes (BAAQMD regulation)\n**Dock Assignment:** Units 1-6 share docks D1-D12 (grade-level), Units 7-12 share docks H1-H6 (dock-high)\n**Forklift Traffic:** Designated lanes, max speed 5 mph in shared areas" },
        { section: "lease_info", title: "Lease & Billing Information", content: "**Lease Type:** NNN (Triple Net) — tenant pays base rent + proportional share of taxes, insurance, and CAM\n**CAM Charges Include:** Landscaping, parking lot maintenance, security, common area utilities, property management fee\n**Rent Due:** 1st of each month, 5-day grace period\n**Payment:** Online portal, ACH, or check\n**Late Fee:** 5% after the 5th\n**Lease Renewal:** Management reaches out 180 days before expiration\n**Insurance Required:** $1M general liability, $2M aggregate, property listed as additional insured" },
        { section: "maintenance", title: "Maintenance Schedules", content: "**HVAC:** Quarterly (Jan, Apr, Jul, Oct) — 7-day advance notice\n**Roof Inspections:** Semi-annual (March, September)\n**Fire Sprinkler Testing:** Annual (February)\n**Parking Lot Sweeping:** Weekly (Sundays, 6-9 AM)\n**Landscaping:** Bi-weekly (Tuesdays)\n**Pest Control:** Monthly (first Wednesday)\n\n**Urgency Levels:**\n- Routine: 5 business days\n- Urgent: 24 hours\n- Emergency: Immediate" },
        { section: "emergency", title: "Emergency Contacts & Protocols", content: "**Fire/Police/Medical:** 911\n**Property Emergency Line (24/7):** (510) 555-0142\n**Water Leak:** Call emergency line → dispatched within 30 min\n**Power Outage:** Check PG&E outage map first → if building-specific, call emergency line\n**Security Concern:** Call emergency line + panic button at main entrance\n**Gas Smell:** Evacuate → 911 → property emergency line" },
        { section: "compliance", title: "Compliance & Safety", content: "**Fire Safety:** Annual sprinkler test (Feb), extinguisher inspection quarterly, clear 18\" below sprinkler heads\n**OSHA:** Tenants responsible for unit-specific compliance; property manages common areas\n**Hazardous Materials:** Must be declared and stored per Oakland Fire code\n**Insurance COI:** Must be on file and current. Auto-tracked with 60/30/15/7 day reminders\n**Environmental:** BAAQMD air quality compliance, stormwater management plan on file" },
        { section: "vendors", title: "Approved Vendor Directory", content: "**HVAC:** Bay Area Climate Control — (510) 555-0200 — 4-hour emergency SLA\n**Plumbing:** Pacific Plumbing Solutions — (510) 555-0210 — 2-hour emergency SLA\n**Electrical:** Volt Electric Inc. — (510) 555-0220 — 24/7\n**Dock Doors:** Bay Area Dock Services — (510) 555-0230\n**Roofing:** Summit Commercial Roofing — (510) 555-0240\n**Pest Control:** Terminix Commercial — monthly contract\n**Janitorial:** CleanPro Industrial — weekly Tue/Thu\n**Security:** Allied Universal — 24/7 patrol\n**Landscaping:** GreenEdge Landscape — bi-weekly\n**Fire & Safety:** FireWatch Systems — annual inspections" },
        { section: "tenants_directory", title: "Current Tenant Directory", content: "| Unit | Tenant | Sq Ft | Lease Expires |\n|------|--------|-------|---------------|\n| 1 | West Coast Logistics | 25,000 | 2027-06-30 |\n| 2 | Bay Fulfillment Co. | 20,000 | 2027-03-15 |\n| 3 | Pacific Cold Storage | 18,000 | 2028-01-31 |\n| 4 | QuickShip Distribution | 15,000 | 2026-12-31 |\n| 5 | Harbor Packaging | 12,000 | 2027-09-30 |\n| 6 | Metro Parts Warehouse | 10,000 | 2026-08-15 |\n| 7 | Titan Freight Forwarding | 22,000 | 2028-06-30 |\n| 8 | EcoStore Solutions | 15,000 | 2027-11-30 |\n| 9 | Golden Gate Auto Parts | 12,000 | 2027-04-30 |\n| 10 | NorCal Building Supply | 10,000 | 2026-10-31 |\n| 11 | Apex Industrial Services | 8,000 | 2027-08-31 |\n| 12 | VACANT | 8,000 | — |\n\n**Occupancy:** 92% (11/12 units)" },
        { section: "permits", title: "Active Permits & Licenses", content: "| Document | Number | Expires | Status |\n|----------|--------|---------|--------|\n| Business License | BL-2024-08421 | 2026-12-31 | Active |\n| Fire Occupancy Permit | FP-2023-1200M | 2026-03-01 | **RENEWAL DUE** |\n| Environmental (BAAQMD) | ENV-2024-3392 | 2027-06-01 | Active |\n| Elevator Permit | ELV-2024-0088 | 2026-09-15 | Active |\n| Stormwater Discharge | SW-2023-1200 | 2028-11-01 | Active |\n| Insurance Policy | POL-CGL-2024-9912 | 2026-12-31 | Active |\n\nFire Occupancy Permit renewal submitted — city inspection scheduled 2026-04-10." },
        { section: "contracts", title: "Active Service Contracts", content: "| Vendor | Service | Monthly | Expires |\n|--------|---------|---------|----------|\n| Bay Area Climate Control | HVAC Full Service | $4,200 | 2027-01 |\n| Allied Universal | Security | $8,500 | 2026-12 |\n| Terminix Commercial | Pest Control | $850 | 2026-06 |\n| CleanPro Industrial | Janitorial | $2,100 | 2026-12 |\n| GreenEdge Landscape | Landscaping | $1,800 | 2026-12 |\n| Pacific Plumbing | Emergency Retainer | $500 | 2027-03 |\n| FireWatch Systems | Fire Safety | $350 | 2027-02 |\n\n**Total Monthly Service Costs:** ~$18,300" },
      ];
      for (let i = 0; i < kb.length; i++) {
        const e = kb[i]!;
        await sql`
          INSERT INTO platform_knowledge (section, title, content, sort_order)
          VALUES (${e.section}, ${e.title}, ${e.content}, ${i})
        `;
      }
      results.push(`knowledge base: ${kb.length} entries`);

      // Demo conversations
      const sessions = [
        { sid: "demo-001", msgs: [{ role: "user", content: "Loading dock 3 door is jammed, can't close it. Unit 4." }, { role: "assistant", content: "I'm logging this as an urgent maintenance request for Unit 4 — jammed loading dock door (Dock 3). Bay Area Dock Services has been contacted, ETA within 4 hours. Ticket #MX-0417 created. Is the door stuck open or closed?" }], intent: "maintenance_request", tipo: "urgent_maintenance", tags: ["dock-door", "unit-4"], isLead: false },
        { sid: "demo-002", msgs: [{ role: "user", content: "Hi, looking at industrial space in Oakland. Any units available?" }, { role: "assistant", content: "Yes! Unit 12 is available — 8,000 sq ft, 24 ft clear height, grade-level dock door, 400A 3-phase power. Want to schedule a tour with our Leasing Director, Mike Torres? (510) 555-0102" }], intent: "cliente_potencial", tipo: "leasing_inquiry", tags: ["prospective-tenant", "unit-12"], isLead: true },
        { sid: "demo-003", msgs: [{ role: "user", content: "Our insurance certificate is expiring. Where do I send the renewal?" }, { role: "assistant", content: "Send your updated COI to Lisa Park at lisa.park@oaklandgateway.com. Oakland Gateway must be listed as additional insured with minimum $1M general liability / $2M aggregate." }], intent: "compliance_question", tipo: "insurance", tags: ["insurance", "compliance"], isLead: false },
      ];
      for (const s of sessions) {
        await sql`
          INSERT INTO platform_sessions (session_id, messages, message_count, intencion, tipo_consulta, tags, is_lead)
          VALUES (${s.sid}, ${sql.json(s.msgs)}, ${s.msgs.length}, ${s.intent}, ${s.tipo}, ${sql.json(s.tags)}, ${s.isLead})
          ON CONFLICT (session_id) DO NOTHING
        `;
      }
      results.push(`sessions: ${sessions.length} demo conversations`);

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
