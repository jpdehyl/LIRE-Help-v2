# Berkeley Partners Demo Prep — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Get LIRE-Help fully demo-ready for Berkeley Partners (April 6) with Oakland Gateway Industrial Park as Tenant #1, complete with mock contracts, permits, vendors, team, and a working dashboard + AI concierge.

**Architecture:** Three phases — (1) get DB + login working, (2) seed Oakland Gateway as a fully fleshed tenant with rich mock data, (3) build an onboarding wizard adapted for industrial RE. Phase 1-2 are demo-critical. Phase 3 is important but can use a simpler seed-script approach if time is tight.

**Tech Stack:** Express/Node, Drizzle ORM, PostgreSQL (Railway), React/Vite, Claude Haiku API

**Context:** Berkeley Partners (berkeleypartners.com, 280+ investments, 14M+ sq ft) is the target first white-label corporate tenant. If approved, they'd be the first Enterprise tier customer. Regardless of outcome, LIRE-Help development continues. The demo must show a complete, believable industrial property operation.

---

## Phase 1: Get Login + Dashboard Working

### Task 1: Push schema to Railway Postgres

**Files:**
- Existing: `shared/schema.ts` (no changes)
- Existing: `drizzle.config.ts` (no changes)

- [ ] **Step 1: Open Railway shell for LIRE-Help service**

In Railway dashboard: click LIRE-Help service → three dots → "Open Shell"

- [ ] **Step 2: Push Drizzle schema**

```bash
npx drizzle-kit push
```

Expected: Creates 6 tables — tenants, properties, agents, staff_users, platform_knowledge, platform_sessions. Should show "Changes applied" or similar confirmation.

- [ ] **Step 3: Verify tables exist**

```bash
node -e "const p=require('postgres');const s=p(process.env.DATABASE_URL);s\`SELECT tablename FROM pg_tables WHERE schemaname='public'\`.then(r=>{console.log(r.map(t=>t.tablename));process.exit(0)})"
```

Expected: Array containing all 6 table names + staff_sessions (auto-created by connect-pg-simple).

---

### Task 2: Seed superadmin user

**Files:**
- Existing: `scripts/seed-superadmin.ts`

- [ ] **Step 1: Run seed script from Railway shell**

```bash
BOOTSTRAP_ADMIN_EMAIL=<admin-email> \
BOOTSTRAP_ADMIN_PASSWORD=<strong-password> \
npx tsx scripts/seed-superadmin.ts
```

Expected: `Bootstrap admin ready: { id: '...', email: '<admin-email>', role: 'superadmin' }`

- [ ] **Step 2: Verify login works**

Open `lire-help-production.up.railway.app/login` in browser.
Login with the credentials supplied via `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD`
Expected: Redirects to `/dashboard`

---

## Phase 2: Seed Oakland Gateway as Tenant #1

### Task 3: Create comprehensive seed script for Oakland Gateway

**Files:**
- Create: `scripts/seed-oakland-gateway.ts`

This script creates the full demo dataset. Run from Railway shell after Task 2.

- [ ] **Step 1: Write the seed script**

```typescript
// Run: npx tsx scripts/seed-oakland-gateway.ts
import postgres from "postgres";
import bcrypt from "bcrypt";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error("DATABASE_URL required"); process.exit(1); }

const sql = postgres(DATABASE_URL, {
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
});

async function main() {
  console.log("Seeding Oakland Gateway Industrial Park...\n");

  // ═══════════════════════════════════════════════════
  // 1. TENANT — Berkeley Partners (parent org)
  // ═══════════════════════════════════════════════════
  const [tenant] = await sql`
    INSERT INTO tenants (name, slug, plan, billing_email, phone, country, timezone)
    VALUES (
      'Berkeley Partners',
      'berkeley',
      'enterprise',
      'operations@berkeleypartners.com',
      '+1 (510) 555-0100',
      'US',
      'America/Los_Angeles'
    )
    ON CONFLICT (slug) DO UPDATE SET
      name = EXCLUDED.name,
      plan = EXCLUDED.plan,
      updated_at = now()
    RETURNING id, name, slug
  `;
  console.log("Tenant:", tenant);

  // ═══════════════════════════════════════════════════
  // 2. PROPERTY — Oakland Gateway Industrial Park
  // ═══════════════════════════════════════════════════
  const [property] = await sql`
    INSERT INTO properties (name, slug, description, location, lat, lng, tenant_id, agent_name, agent_emoji, branding_json)
    VALUES (
      'Oakland Gateway Industrial Park',
      'oakland-gateway',
      'Multi-tenant light industrial / warehouse complex — 185,000 sq ft across 12 units. Loading docks, 24/7 security, gated entry.',
      '1200 Maritime Street, Oakland, CA 94607',
      37.7955,
      -122.2822,
      ${tenant.id},
      'Gateway Concierge',
      'LH',
      ${sql.json({
        primaryColor: "#0F2942",
        secondaryColor: "#2563EB",
        fontFamily: "Inter",
        darkMode: true
      })}
    )
    ON CONFLICT (slug) DO UPDATE SET
      name = EXCLUDED.name,
      tenant_id = EXCLUDED.tenant_id,
      updated_at = now()
    RETURNING id, name, slug
  `;
  console.log("Property:", property);

  // ═══════════════════════════════════════════════════
  // 3. AGENT — AI Concierge for Oakland Gateway
  // ═══════════════════════════════════════════════════
  const [agent] = await sql`
    INSERT INTO agents (property_id, tenant_id, name, emoji, tagline, greeting, personality, is_active)
    VALUES (
      ${property.id},
      ${tenant.id},
      'Gateway Concierge',
      'LH',
      'Your 24/7 industrial property assistant',
      'Welcome to Oakland Gateway Industrial Park! I''m your property concierge. I can help with maintenance requests, dock scheduling, lease questions, and building info. How can I help?',
      'You are the Oakland Gateway Concierge — professional, efficient, knowledgeable about all 12 units, loading dock procedures, and building operations. You respond concisely (2-3 sentences) unless detail is needed. You know every lease term, every vendor, every emergency protocol. You are the digital property manager that never sleeps.',
      true
    )
    ON CONFLICT (property_id) DO UPDATE SET
      name = EXCLUDED.name,
      greeting = EXCLUDED.greeting,
      personality = EXCLUDED.personality,
      updated_at = now()
    RETURNING id, name
  `;
  console.log("Agent:", agent);

  // ═══════════════════════════════════════════════════
  // 4. STAFF USERS — Property management team
  // ═══════════════════════════════════════════════════
  const teamMembers = [
    { email: "sarah.chen@oaklandgateway.com", name: "Sarah Chen", role: "manager", title: "Property Manager" },
    { email: "mike.torres@oaklandgateway.com", name: "Mike Torres", role: "staff", title: "Leasing Director" },
    { email: "james.wilson@oaklandgateway.com", name: "James Wilson", role: "staff", title: "Maintenance Supervisor" },
    { email: "lisa.park@oaklandgateway.com", name: "Lisa Park", role: "staff", title: "Compliance Officer" },
    { email: "demo@berkeleypartners.com", name: "Berkeley Demo", role: "owner", title: "Portfolio Director" },
  ];

  const defaultHash = await bcrypt.hash(process.env.DEMO_TEAM_PASSWORD!, 12);

  for (const member of teamMembers) {
    const [user] = await sql`
      INSERT INTO staff_users (email, password_hash, name, role, tenant_id, property_id, is_active)
      VALUES (${member.email}, ${defaultHash}, ${member.name}, ${member.role}, ${tenant.id}, ${property.id}, true)
      ON CONFLICT (email) DO UPDATE SET
        name = EXCLUDED.name,
        role = EXCLUDED.role,
        updated_at = now()
      RETURNING id, email, role
    `;
    console.log(`Staff [${member.title}]:`, user);
  }

  // ═══════════════════════════════════════════════════
  // 5. KNOWLEDGE BASE — Full property operations manual
  // ═══════════════════════════════════════════════════
  const kbEntries = [
    {
      section: "property_overview",
      title: "Property Overview — Oakland Gateway Industrial Park",
      content: `**Address:** 1200 Maritime Street, Oakland, CA 94607
**Type:** Multi-tenant light industrial / warehouse complex
**Total Area:** 185,000 sq ft across 12 units (8,000–25,000 sq ft each)
**Loading Docks:** 18 grade-level doors + 6 dock-high positions
**Clear Height:** 24 ft
**Power:** 400A 3-phase per unit
**Parking:** 120 spaces + 8 trailer staging positions
**Security:** 24/7 camera surveillance, gated entry with key card access
**Year Built:** 2008 | **Last Renovated:** 2023`
    },
    {
      section: "team_contacts",
      title: "Property Management Team",
      content: `**Property Manager:** Sarah Chen — sarah.chen@oaklandgateway.com — (510) 555-0101
**Leasing Director:** Mike Torres — mike.torres@oaklandgateway.com — (510) 555-0102
**Maintenance Supervisor:** James Wilson — james.wilson@oaklandgateway.com — (510) 555-0103
**Compliance Officer:** Lisa Park — lisa.park@oaklandgateway.com — (510) 555-0104
**Emergency Maintenance (24/7):** (510) 555-0142
**Security Dispatch:** (510) 555-0150`
    },
    {
      section: "loading_dock",
      title: "Loading Dock Rules & Procedures",
      content: `**Dock Hours:** Monday–Saturday, 6:00 AM – 10:00 PM
**Overnight Trailer Parking:** Requires 48-hour advance notice via concierge or portal
**Maximum Trailer Dwell Time:** 4 hours at dock positions
**Shared Dock Scheduling:** Via tenant portal or AI concierge
**No Idling:** Engines off beyond 5 minutes (BAAQMD regulation)
**Dock Assignment:** Units 1-6 share docks D1-D12 (grade-level), Units 7-12 share docks H1-H6 (dock-high)
**Forklift Traffic:** Designated lanes marked in yellow. Max speed 5 mph in shared areas.`
    },
    {
      section: "lease_info",
      title: "Lease & Billing Information",
      content: `**Lease Type:** NNN (Triple Net) — tenant pays base rent + proportional share of taxes, insurance, and CAM
**CAM Charges Include:** Landscaping, parking lot maintenance, security, common area utilities, property management fee
**Rent Due:** 1st of each month, 5-day grace period
**Payment Methods:** Online portal (portal.oaklandgateway.com), ACH, or check
**Late Fee:** 5% after the 5th
**Lease Renewal:** Management reaches out 180 days before expiration
**TI Requests:** Submit via property manager, typical approval 2–4 weeks
**Insurance Required:** $1M general liability, $2M aggregate, Oakland Gateway listed as additional insured`
    },
    {
      section: "maintenance",
      title: "Maintenance Schedules & Procedures",
      content: `**HVAC Preventive Maintenance:** Quarterly (Jan, Apr, Jul, Oct) — 7-day advance notice
**Roof Inspections:** Semi-annual (March, September)
**Fire Sprinkler Testing:** Annual (February) — requires clear 18" below sprinkler heads
**Parking Lot Sweeping:** Weekly (Sundays, 6–9 AM)
**Landscaping:** Bi-weekly (Tuesdays)
**Pest Control:** Monthly (first Wednesday) — interior treatment available on request

**Request Urgency Levels:**
- **Routine:** 5 business days (lighting, cosmetic, non-critical)
- **Urgent:** 24 hours (HVAC failure, plumbing, dock door malfunction)
- **Emergency:** Immediate (water leak/flood, fire, power outage, security breach)`
    },
    {
      section: "emergency",
      title: "Emergency Contacts & Protocols",
      content: `**Fire/Police/Medical:** 911
**Property Emergency Line (24/7):** (510) 555-0142
**Water Leak / Flooding:** Call emergency line → maintenance dispatched within 30 min
**Power Outage:** Check PG&E outage map first → if building-specific, call emergency line
**Security Concern:** Call emergency line + activate panic button at main entrance
**Gas Smell:** Evacuate immediately → call 911 → then property emergency line
**After-Hours Lockout:** Call (510) 555-0150 for security escort`
    },
    {
      section: "compliance",
      title: "Compliance & Safety Requirements",
      content: `**Fire Safety:** Annual sprinkler test (Feb), extinguisher inspection (quarterly), clear 18" below sprinkler heads at all times
**OSHA:** Tenants responsible for unit-specific OSHA compliance; property manages common area safety
**Hazardous Materials:** Must be declared and stored per Oakland Fire code. No unauthorized storage.
**ADA:** Common areas fully compliant. Tenant responsible for unit interior compliance.
**Insurance COI:** Must be on file and current. Renewal tracked automatically — 60/30/15/7 day reminders.
**Environmental:** BAAQMD air quality compliance (no idling >5 min), stormwater management plan on file`
    },
    {
      section: "vendors",
      title: "Approved Vendor Directory",
      content: `**HVAC:** Bay Area Climate Control — (510) 555-0200 — 4-hour emergency response SLA
**Plumbing:** Pacific Plumbing Solutions — (510) 555-0210 — 2-hour emergency SLA
**Electrical:** Volt Electric Inc. — (510) 555-0220 — 24/7 availability
**Dock Doors:** Bay Area Dock Services — (510) 555-0230 — specializes in industrial dock equipment
**Roofing:** Summit Commercial Roofing — (510) 555-0240 — warranty repairs included
**Pest Control:** Terminix Commercial — monthly contract, first Wednesday each month
**Janitorial (Common Areas):** CleanPro Industrial — weekly service Tue/Thu
**Security:** Allied Universal — 24/7 patrol + monitoring
**Landscaping:** GreenEdge Landscape — bi-weekly Tuesdays
**Fire & Safety:** FireWatch Systems — annual inspections + emergency service`
    },
    {
      section: "tenants_directory",
      title: "Current Tenant Directory",
      content: `| Unit | Tenant | Sq Ft | Lease Expires | Contact |
|------|--------|-------|---------------|---------|
| 1 | West Coast Logistics | 25,000 | 2027-06-30 | ops@wclogistics.com |
| 2 | Bay Fulfillment Co. | 20,000 | 2027-03-15 | manager@bayfulfill.com |
| 3 | Pacific Cold Storage | 18,000 | 2028-01-31 | facility@pacificcold.com |
| 4 | QuickShip Distribution | 15,000 | 2026-12-31 | dock@quickship.io |
| 5 | Harbor Packaging | 12,000 | 2027-09-30 | ops@harborpkg.com |
| 6 | Metro Parts Warehouse | 10,000 | 2026-08-15 | admin@metroparts.com |
| 7 | Titan Freight Forwarding | 22,000 | 2028-06-30 | ops@titanfreight.com |
| 8 | EcoStore Solutions | 15,000 | 2027-11-30 | warehouse@ecostorage.com |
| 9 | Golden Gate Auto Parts | 12,000 | 2027-04-30 | facility@ggautoparts.com |
| 10 | NorCal Building Supply | 10,000 | 2026-10-31 | office@norcalbuild.com |
| 11 | Apex Industrial Services | 8,000 | 2027-08-31 | manager@apexind.com |
| 12 | — VACANT — | 8,000 | — | Contact Mike Torres for leasing |

**Occupancy:** 92% (11 of 12 units leased)
**Total Leased Area:** 167,000 sq ft`
    },
    {
      section: "permits_licenses",
      title: "Active Permits & Licenses",
      content: `| Document | Number | Issued | Expires | Status |
|----------|--------|--------|---------|--------|
| Business License (Oakland) | BL-2024-08421 | 2024-01-15 | 2026-12-31 | Active |
| Fire Occupancy Permit | FP-2023-1200M | 2023-03-01 | 2026-03-01 | **RENEWAL DUE** |
| Environmental Compliance (BAAQMD) | ENV-2024-3392 | 2024-06-01 | 2027-06-01 | Active |
| Elevator Permit (Freight) | ELV-2024-0088 | 2024-09-15 | 2026-09-15 | Active |
| Stormwater Discharge Permit | SW-2023-1200 | 2023-11-01 | 2028-11-01 | Active |
| Commercial Insurance Policy | POL-CGL-2024-9912 | 2024-01-01 | 2026-12-31 | Active |
| Workers Comp Certificate | WC-2024-44210 | 2024-01-01 | 2026-12-31 | Active |

**Note:** Fire Occupancy Permit expired 2026-03-01 — renewal submitted, pending city inspection (scheduled 2026-04-10).`
    },
    {
      section: "contracts",
      title: "Active Service Contracts",
      content: `| Vendor | Service | Contract # | Monthly Cost | Expires | Auto-Renew |
|--------|---------|------------|-------------|---------|------------|
| Bay Area Climate Control | HVAC Full Service | HVAC-2024-001 | $4,200 | 2027-01-31 | Yes (annual) |
| Allied Universal | Security Patrol + Monitoring | SEC-2024-001 | $8,500 | 2026-12-31 | Yes (annual) |
| Terminix Commercial | Pest Control | PEST-2024-001 | $850 | 2026-06-30 | Yes (6-mo) |
| CleanPro Industrial | Common Area Janitorial | JAN-2024-001 | $2,100 | 2026-12-31 | Yes (annual) |
| GreenEdge Landscape | Landscaping & Snow | LAND-2024-001 | $1,800 | 2026-12-31 | Yes (annual) |
| Pacific Plumbing Solutions | Emergency Retainer | PLB-2024-001 | $500 | 2027-03-31 | No |
| FireWatch Systems | Fire Safety Inspection | FIRE-2024-001 | $350 | 2027-02-28 | Yes (annual) |
| Summit Commercial Roofing | Warranty + Inspection | ROOF-2023-001 | $0 (warranty) | 2028-06-30 | No |

**Total Monthly Service Costs:** ~$18,300`
    },
  ];

  for (let i = 0; i < kbEntries.length; i++) {
    const entry = kbEntries[i]!;
    await sql`
      INSERT INTO platform_knowledge (section, title, content, sort_order)
      VALUES (${entry.section}, ${entry.title}, ${entry.content}, ${i})
    `;
    console.log(`KB [${i}]: ${entry.title}`);
  }

  // ═══════════════════════════════════════════════════
  // 6. MOCK PLATFORM SESSIONS — Recent tenant conversations
  // ═══════════════════════════════════════════════════
  const sessions = [
    {
      sessionId: "demo-session-001",
      messages: [
        { role: "user", content: "Loading dock 3 door is jammed, can't close it. Unit 4." },
        { role: "assistant", content: "I'm logging this as an urgent maintenance request for Unit 4 — jammed loading dock door (Dock 3). I've contacted Bay Area Dock Services and they'll be dispatched within 4 hours. Ticket #MX-0417 created. Can you confirm if the door is stuck in the open or closed position?" },
        { role: "user", content: "It's stuck open about 3 feet. Cold air coming in." },
        { role: "assistant", content: "Understood — partially open, causing temperature issues. I've escalated the priority given the cold air infiltration. Bay Area Dock Services ETA is 2:00 PM today. In the meantime, I'd recommend using the dock curtains stored in the common area supply room (Room C-2, key from security desk) as a temporary barrier. I'll update you when the technician is en route." }
      ],
      intencion: "maintenance_request",
      tipoConsulta: "urgent_maintenance",
      tags: ["dock-door", "unit-4", "vendor-dispatched"],
      isLead: false,
    },
    {
      sessionId: "demo-session-002",
      messages: [
        { role: "user", content: "Hi, I'm looking at industrial space in Oakland. Do you have any units available?" },
        { role: "assistant", content: "Welcome! Yes, we currently have one unit available at Oakland Gateway Industrial Park — Unit 12, 8,000 sq ft with 24 ft clear height, grade-level dock door, and 400A 3-phase power. The park offers 24/7 security, gated entry, and shared loading dock facilities. Would you like to schedule a tour with our Leasing Director, Mike Torres?" },
        { role: "user", content: "What's the asking rate?" },
        { role: "assistant", content: "I'd be happy to connect you with Mike Torres for current pricing — rates depend on lease term and TI requirements. He can walk you through our NNN structure and CAM charges. Shall I have him reach out? His direct line is (510) 555-0102 or mike.torres@oaklandgateway.com." }
      ],
      intencion: "cliente_potencial",
      tipoConsulta: "leasing_inquiry",
      tags: ["prospective-tenant", "unit-12", "leasing"],
      isLead: true,
    },
    {
      sessionId: "demo-session-003",
      messages: [
        { role: "user", content: "Our insurance certificate is expiring next week. Where do I send the renewal?" },
        { role: "assistant", content: "You can send your updated Certificate of Insurance to our Compliance Officer, Lisa Park at lisa.park@oaklandgateway.com. Please ensure Oakland Gateway Industrial Park is listed as an additional insured with minimum $1M general liability / $2M aggregate coverage. If you need the exact certificate requirements, I can pull those up for you." }
      ],
      intencion: "compliance_question",
      tipoConsulta: "insurance",
      tags: ["insurance", "compliance", "coi"],
      isLead: false,
    },
  ];

  for (const sess of sessions) {
    await sql`
      INSERT INTO platform_sessions (session_id, messages, message_count, intencion, tipo_consulta, tags, is_lead)
      VALUES (
        ${sess.sessionId},
        ${sql.json(sess.messages)},
        ${sess.messages.length},
        ${sess.intencion},
        ${sess.tipoConsulta},
        ${sql.json(sess.tags)},
        ${sess.isLead}
      )
    `;
    console.log(`Session: ${sess.sessionId} (${sess.intencion})`);
  }

  console.log("\n═══════════════════════════════════════");
  console.log("Oakland Gateway seeded successfully!");
  console.log("═══════════════════════════════════════");
  console.log(`Tenant: ${tenant.name} (${tenant.slug})`);
  console.log(`Property: ${property.name}`);
  console.log(`Agent: ${agent.name}`);
  console.log(`Staff: ${teamMembers.length} team members`);
  console.log(`KB: ${kbEntries.length} entries`);
  console.log(`Sessions: ${sessions.length} demo conversations`);
  console.log("\nDemo logins:");
  console.log("  Platform admin:  from BOOTSTRAP_ADMIN_EMAIL / BOOTSTRAP_ADMIN_PASSWORD");
  console.log("  Berkeley demo:   seeded with DEMO_TEAM_PASSWORD");
  console.log("  Property mgr:    seeded with DEMO_TEAM_PASSWORD");

  await sql.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Run the seed script from Railway shell**

```bash
npx tsx scripts/seed-oakland-gateway.ts
```

Expected: All records created with confirmation messages.

- [ ] **Step 3: Verify in dashboard**

Login as the bootstrap admin account. Dashboard should show:
- 1 tenant (Berkeley Partners)
- 1 property (Oakland Gateway)
- 1 active agent
- 5 staff members
- 11 KB entries
- 3 demo conversations

- [ ] **Step 4: Commit the seed script**

```bash
git add scripts/seed-oakland-gateway.ts
git commit -m "feat: add Oakland Gateway demo seed with full mock data"
```

---

### Task 4: Make the AI concierge use property-specific knowledge base

**Files:**
- Modify: `server.ts` (the `/api/chat` endpoint, ~lines 282-335)

Currently the system prompt is hardcoded. It should pull from the knowledge base so the demo shows the platform actually working.

- [ ] **Step 1: Update chat endpoint to pull KB dynamically**

Replace the hardcoded `SYSTEM_PROMPT` constant and update the `/api/chat` endpoint to:
1. Fetch all `platform_knowledge` entries from DB
2. Concatenate them into the system prompt
3. Prepend the concierge personality/instructions

- [ ] **Step 2: Test the concierge**

Open the live chat widget on the landing page. Ask:
- "What are the dock hours?" → Should answer from KB
- "Who's the property manager?" → Should return Sarah Chen
- "I have a water leak in Unit 7" → Should initiate maintenance flow
- "Do you have any vacant units?" → Should mention Unit 12

- [ ] **Step 3: Commit**

```bash
git add server.ts
git commit -m "feat: chat endpoint pulls KB dynamically instead of hardcoded prompt"
```

---

## Phase 3: Onboarding Wizard (Industrial Adaptation)

### Task 5: Add industrial fields to schema

**Files:**
- Modify: `shared/schema.ts`

Add these fields to the `properties` table for industrial RE:

```typescript
// After existing properties fields, add:
sqFt: integer("sq_ft"),
unitCount: integer("unit_count"),
loadingDocks: integer("loading_docks"),
clearHeight: text("clear_height"),        // e.g. "24 ft"
power: text("power"),                     // e.g. "400A 3-phase"
parkingSpaces: integer("parking_spaces"),
trailerStaging: integer("trailer_staging"),
securityType: text("security_type"),      // e.g. "24/7 camera + gated"
propertyType: text("property_type"),      // warehouse, flex, cold-storage, etc.
yearBuilt: integer("year_built"),
lastRenovated: integer("last_renovated"),
```

- [ ] **Step 1: Add fields to schema.ts**
- [ ] **Step 2: Push updated schema to Railway** (`npx drizzle-kit push` from Railway shell)
- [ ] **Step 3: Commit**

---

### Task 6: Build the onboarding wizard

**Files:**
- Create: `client/src/pages/onboarding.tsx` (~800 lines)
- Modify: `client/src/App.tsx` (add /onboarding route)

**6-step wizard adapted from Host-Help:**

| Step | Name | Fields |
|------|------|--------|
| 1 | Auth | Admin verification (superadmin session) |
| 2 | Facility | name, slug, location, sqFt, unitCount, loadingDocks, clearHeight, power, parking, security, propertyType, yearBuilt |
| 3 | Agent | name, emoji, tagline, greeting, personality |
| 4 | Compliance | permits list, insurance requirements, key dates |
| 5 | Team | property manager + staff setup (email, role, password) |
| 6 | Done | Success screen with dashboard links |

**Note:** Rates step removed (industrial uses stable leases, not seasonal pricing). Compliance step replaces RNT with generic permit/insurance tracking. Team step is new — creates staff users.

- [ ] **Step 1: Build wizard component with all 6 steps**
- [ ] **Step 2: Wire up API calls (create tenant → property → agent → staff)**
- [ ] **Step 3: Add auto-seed KB entries from wizard data**
- [ ] **Step 4: Add route in App.tsx**
- [ ] **Step 5: Test full flow**
- [ ] **Step 6: Commit**

---

## Demo Day Checklist (April 6)

Before the demo, verify:

- [ ] Landing page loads cleanly (EN + ES + theme toggle)
- [ ] Live chat widget works — AI responds with property-specific knowledge
- [ ] Login works for all demo accounts
- [ ] Dashboard shows Berkeley Partners tenant with Oakland Gateway property
- [ ] KB panel shows all 11 entries (browsable, editable)
- [ ] Sessions panel shows demo conversations with intent classification
- [ ] Agent configuration is visible and editable
- [ ] Staff directory shows team members with roles

**Demo flow suggestion:**
1. Show the landing page → live chat (ask about dock hours, submit maintenance request)
2. Login as Sarah Chen (property manager) → show dashboard
3. Show the KB panel — "this is what the AI knows"
4. Show sessions — "these are real tenant conversations, auto-classified"
5. Show the agent config — "each property gets its own trained concierge"
6. Mention the 90/10 principle — "90% autonomous, 10% human escalation"
7. If Berkeley wants to proceed → "we onboard your first property in days, not months"

---

## Priority Order

| Priority | Task | Time Estimate | Demo-Critical? |
|----------|------|--------------|----------------|
| 1 | Task 1: db:push | 5 min | YES |
| 2 | Task 2: Seed superadmin | 2 min | YES |
| 3 | Task 3: Seed Oakland Gateway | 15 min | YES |
| 4 | Task 4: Dynamic KB in chat | 30 min | YES |
| 5 | Task 5: Industrial schema fields | 15 min | Nice-to-have |
| 6 | Task 6: Onboarding wizard | 3-4 hours | Post-demo OK |
