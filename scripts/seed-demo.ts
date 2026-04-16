// Demo data seed script for Northstar Industrial Group
// Run: npm run db:seed
//
// This script is fully idempotent — re-running it will first delete all
// existing demo helpdesk data for the Northstar tenant, then re-create it
// from scratch. Tenant/property/staff upserts are non-destructive (ON CONFLICT DO UPDATE).

import postgres from "postgres";
import bcrypt from "bcrypt";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const dbUrl = process.env.DATABASE_URL;
const needsSsl = dbUrl.includes("ssl=true") || dbUrl.includes("sslmode=require") || dbUrl.startsWith("postgres://") && !dbUrl.includes("localhost") && !dbUrl.includes("127.0.0.1");

const sql = postgres(dbUrl, {
  ssl: needsSsl ? { rejectUnauthorized: false } : false,
});

const now = new Date();
const h = (hours: number) => new Date(now.getTime() - hours * 60 * 60 * 1000);
const m = (minutes: number) => new Date(now.getTime() - minutes * 60 * 1000);
const d = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

async function upsertTenant() {
  const [row] = await sql`
    INSERT INTO tenants (name, slug, plan, billing_email, phone, country, timezone, is_active)
    VALUES (
      'Northstar Industrial Group',
      'northstar-industrial',
      'enterprise',
      'ops@northstar-industrial.com',
      '+1-510-555-0100',
      'US',
      'America/Los_Angeles',
      true
    )
    ON CONFLICT (slug) DO UPDATE SET
      name = EXCLUDED.name,
      plan = EXCLUDED.plan,
      billing_email = EXCLUDED.billing_email,
      updated_at = now()
    RETURNING id, name
  `;
  console.log("Tenant:", row.name, row.id);
  return row.id as string;
}

async function upsertProperties(tenantId: string) {
  const props = [
    {
      name: "Oakland Distribution Center",
      slug: "northstar-oakland-dc",
      description: "600,000 sq ft Class A distribution center with 52 dock doors, 36 ft clear height, and rail spur access. Primary fulfillment hub for the Bay Area.",
      location: "Oakland, CA",
      lat: 37.8044,
      lng: -122.2711,
      agentName: "Oakland Ops AI",
      agentEmoji: "🏭",
      agentTagline: "Your 24/7 dock-to-desk operations assistant",
      agentGreeting: "Hi, I'm the Oakland DC Ops assistant. I can help with dock scheduling, maintenance requests, lease questions, and anything else you need at the Oakland distribution center.",
      agentPersonality: "Professional, efficient, and highly knowledgeable about industrial operations. Responds quickly and escalates critical issues without hesitation.",
      branding: { primaryColor: "#1e3a5f", secondaryColor: "#f0f4f8" },
    },
    {
      name: "Stockton Cold Storage Facility",
      slug: "northstar-stockton-cold",
      description: "200,000 sq ft refrigerated warehouse with 28°F freezer vaults and 38°F cooler zones. USDA-inspected. 24/7 temperature monitoring.",
      location: "Stockton, CA",
      lat: 37.9577,
      lng: -121.2908,
      agentName: "Stockton Cold AI",
      agentEmoji: "❄️",
      agentTagline: "Cold chain operations support, around the clock",
      agentGreeting: "Hello! I'm here to assist with cold storage operations at the Stockton facility — temperature issues, dock coordination, compliance questions, and more.",
      agentPersonality: "Detail-oriented, calm under pressure. Prioritizes food safety and compliance. Escalates temperature excursions immediately.",
      branding: { primaryColor: "#0f4c75", secondaryColor: "#e8f4f8" },
    },
    {
      name: "Fremont Flex Industrial Park",
      slug: "northstar-fremont-flex",
      description: "Flex industrial campus with 15 units ranging from 8,000 to 22,000 sq ft. Mix of manufacturing, light assembly, and R&D tenants. 100% occupied.",
      location: "Fremont, CA",
      lat: 37.5485,
      lng: -121.9886,
      agentName: "Fremont Flex AI",
      agentEmoji: "🔧",
      agentTagline: "Flex industrial support for every tenant",
      agentGreeting: "Hey there! I manage the Fremont Flex Industrial Park — 15 units, many tenants, lots going on. What can I help you with today?",
      agentPersonality: "Friendly, practical, multi-tenant aware. Knows each tenant's quirks. Good at de-escalating disputes between neighbors.",
      branding: { primaryColor: "#2d5016", secondaryColor: "#f0f7ea" },
    },
  ];

  const ids: string[] = [];
  for (const prop of props) {
    const [row] = await sql`
      INSERT INTO properties (name, slug, description, location, lat, lng, tenant_id,
        agent_name, agent_emoji, agent_tagline, agent_greeting, agent_personality, branding_json)
      VALUES (
        ${prop.name}, ${prop.slug}, ${prop.description}, ${prop.location},
        ${prop.lat}, ${prop.lng}, ${tenantId},
        ${prop.agentName}, ${prop.agentEmoji}, ${prop.agentTagline}, ${prop.agentGreeting}, ${prop.agentPersonality},
        ${JSON.stringify(prop.branding)}
      )
      ON CONFLICT (slug) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        tenant_id = EXCLUDED.tenant_id,
        agent_name = EXCLUDED.agent_name,
        branding_json = EXCLUDED.branding_json,
        updated_at = now()
      RETURNING id, name
    `;
    console.log("Property:", row.name, row.id);
    ids.push(row.id as string);
  }
  return ids;
}

async function upsertDemoStaff(tenantId: string, propertyIds: string[]) {
  const passwordHash = await bcrypt.hash("Demo2026", 12);
  const staffList = [
    {
      email: "demo@northstar.com",
      name: "Jordan Parker",
      role: "owner",
      propertyId: null,
    },
    {
      email: "marcus.chen@northstar.com",
      name: "Marcus Chen",
      role: "manager",
      propertyId: propertyIds[0] ?? null,
    },
    {
      email: "priya.nair@northstar.com",
      name: "Priya Nair",
      role: "manager",
      propertyId: propertyIds[1] ?? null,
    },
    {
      email: "travis.ortega@northstar.com",
      name: "Travis Ortega",
      role: "manager",
      propertyId: propertyIds[2] ?? null,
    },
  ];

  const ids: string[] = [];
  for (const staff of staffList) {
    const [row] = await sql`
      INSERT INTO staff_users (email, password_hash, name, role, tenant_id, property_id, is_active)
      VALUES (${staff.email}, ${passwordHash}, ${staff.name}, ${staff.role}, ${tenantId}, ${staff.propertyId}, true)
      ON CONFLICT (email) DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        name = EXCLUDED.name,
        role = EXCLUDED.role,
        tenant_id = EXCLUDED.tenant_id,
        property_id = EXCLUDED.property_id,
        is_active = true,
        updated_at = now()
      RETURNING id, name, email
    `;
    console.log("Staff:", row.name, "<" + row.email + ">", row.id);
    ids.push(row.id as string);
  }
  return ids;
}

async function upsertInboxes(tenantId: string, propertyIds: string[]) {
  const defs = [
    { slug: "support", name: "Support", description: "General support queue", isDefault: true, propertyId: null },
    { slug: "escalations", name: "Escalations", description: "Manager and specialist review", isDefault: false, propertyId: null },
    { slug: "billing", name: "Billing", description: "Billing, invoices, and financial disputes", isDefault: false, propertyId: null },
    { slug: "vip", name: "VIP", description: "High-value and strategic accounts", isDefault: false, propertyId: null },
  ];

  const ids: string[] = [];
  for (const def of defs) {
    let [existing] = await sql`SELECT id FROM help_inboxes WHERE tenant_id = ${tenantId} AND slug = ${def.slug} LIMIT 1`;
    if (!existing) {
      [existing] = await sql`
        INSERT INTO help_inboxes (tenant_id, property_id, slug, name, description, channel, is_default, is_active)
        VALUES (${tenantId}, ${def.propertyId}, ${def.slug}, ${def.name}, ${def.description}, 'email', ${def.isDefault}, true)
        RETURNING id, name
      `;
    }
    if (existing) ids.push(existing.id as string);
  }
  return ids;
}

async function upsertTags(tenantId: string) {
  const tags = [
    { name: "dock-equipment", slug: "dock-equipment", color: "#f59e0b" },
    { name: "hvac", slug: "hvac", color: "#3b82f6" },
    { name: "billing", slug: "billing", color: "#8b5cf6" },
    { name: "lease-renewal", slug: "lease-renewal", color: "#10b981" },
    { name: "insurance", slug: "insurance", color: "#6366f1" },
    { name: "security", slug: "security", color: "#ef4444" },
    { name: "prospective-tenant", slug: "prospective-tenant", color: "#f97316" },
    { name: "maintenance", slug: "maintenance", color: "#64748b" },
    { name: "cold-chain", slug: "cold-chain", color: "#0ea5e9" },
    { name: "pest-control", slug: "pest-control", color: "#84cc16" },
    { name: "renewal", slug: "renewal", color: "#10b981" },
    { name: "pricing", slug: "pricing", color: "#8b5cf6" },
    { name: "escalation", slug: "escalation", color: "#ef4444" },
  ];

  const tagMap: Record<string, string> = {};
  for (const tag of tags) {
    let [row] = await sql`SELECT id FROM help_tags WHERE tenant_id = ${tenantId} AND slug = ${tag.slug} LIMIT 1`;
    if (!row) {
      [row] = await sql`
        INSERT INTO help_tags (tenant_id, name, slug, color)
        VALUES (${tenantId}, ${tag.name}, ${tag.slug}, ${tag.color})
        RETURNING id
      `;
    }
    tagMap[tag.slug] = row.id as string;
  }
  return tagMap;
}

async function upsertCustomers(tenantId: string, propertyIds: string[]) {
  const customers = [
    {
      externalId: "cust-amazon-oak",
      name: "Marcus Webb",
      email: "marcus.webb@amazon-logistics.com",
      company: "Amazon Logistics",
      tier: "strategic",
      health: "stable",
      propertyId: propertyIds[0] ?? null,
    },
    {
      externalId: "cust-dhl-oak",
      name: "Sandra Yee",
      email: "s.yee@dhl-supply.com",
      company: "DHL Supply Chain",
      tier: "priority",
      health: "stable",
      propertyId: propertyIds[0] ?? null,
    },
    {
      externalId: "cust-sysco-stock",
      name: "Carlos Reyes",
      email: "c.reyes@sysco-west.com",
      company: "Sysco Western Region",
      tier: "strategic",
      health: "watch",
      propertyId: propertyIds[1] ?? null,
    },
    {
      externalId: "cust-usfoods-stock",
      name: "Bethany Moss",
      email: "bmoss@us-foods.com",
      company: "US Foods",
      tier: "priority",
      health: "stable",
      propertyId: propertyIds[1] ?? null,
    },
    {
      externalId: "cust-tesla-frm",
      name: "Derek Chang",
      email: "derek.chang@tesla.com",
      company: "Tesla Components",
      tier: "strategic",
      health: "stable",
      propertyId: propertyIds[2] ?? null,
    },
    {
      externalId: "cust-lam-frm",
      name: "Nadia Patel",
      email: "n.patel@lam-research.com",
      company: "Lam Research",
      tier: "priority",
      health: "at_risk",
      propertyId: propertyIds[2] ?? null,
    },
    {
      externalId: "cust-prospect-tech",
      name: "Robert Kim",
      email: "rkim@prospectlogistics.io",
      company: "Prospect Logistics (prospective)",
      tier: "standard",
      health: "stable",
      propertyId: propertyIds[0] ?? null,
    },
    {
      externalId: "cust-frito-oak",
      name: "Layla Torres",
      email: "ltorres@frito-lay.com",
      company: "Frito-Lay Distribution",
      tier: "priority",
      health: "stable",
      propertyId: propertyIds[0] ?? null,
    },
  ];

  const ids: Record<string, string> = {};
  for (const customer of customers) {
    let [row] = await sql`SELECT id FROM help_customers WHERE tenant_id = ${tenantId} AND external_id = ${customer.externalId} LIMIT 1`;
    if (!row) {
      [row] = await sql`
        INSERT INTO help_customers (tenant_id, property_id, external_id, name, email, company, tier, health, last_seen_at)
        VALUES (${tenantId}, ${customer.propertyId}, ${customer.externalId}, ${customer.name}, ${customer.email}, ${customer.company}, ${customer.tier}, ${customer.health}, now())
        RETURNING id
      `;
    }
    ids[customer.externalId] = row.id as string;
  }
  return ids;
}

interface ConversationSeed {
  externalId: string;
  subject: string;
  status: string;
  priority: string;
  assignmentState: string;
  assigneeIndex: number | null;
  propertyIndex: number;
  inboxSlug: string;
  customerId: string;
  preview: string;
  tags: string[];
  slaOffsetHours: number;
  slaBreached: boolean;
  slaAtRisk: boolean;
  createdAgo: number;
  messages: Array<{
    type: string;
    author: string;
    body: string;
    minutesAfterCreation: number;
  }>;
}

function buildConversations(
  staffIds: string[],
  customerIds: Record<string, string>,
): ConversationSeed[] {
  return [
    {
      externalId: "conv-oakland-dock-failure",
      subject: "Dock Door #14 hydraulic failure — bay 3 completely blocked",
      status: "open",
      priority: "urgent",
      assignmentState: "assigned",
      assigneeIndex: 1,
      propertyIndex: 0,
      inboxSlug: "escalations",
      customerId: customerIds["cust-amazon-oak"]!,
      preview: "Hydraulic seal blew on dock door 14 at 6:45 AM. Trailer cannot exit, blocking 3 other bays. Amazon staging window closes in 90 minutes.",
      tags: ["dock-equipment", "escalation"],
      slaOffsetHours: -1,
      slaBreached: true,
      slaAtRisk: false,
      createdAgo: 4,
      messages: [
        {
          type: "customer",
          author: "Marcus Webb",
          body: "Hydraulic seal blew on dock door 14 at 6:45 AM. The trailer cannot exit and is blocking bays 12, 13, and 15. Amazon's pickup window closes at 10:30 AM — if we miss it we're looking at a $40K delay charge. This is urgent.",
          minutesAfterCreation: 0,
        },
        {
          type: "teammate",
          author: "AI Concierge",
          body: "Hi Marcus — I've flagged this as an emergency maintenance ticket (TKT-2847). Our on-call facilities team has been paged. Estimated technician arrival is 45–60 minutes. I'm also notifying Marcus Chen, your property manager, to coordinate directly with you on the Amazon timeline.",
          minutesAfterCreation: 3,
        },
        {
          type: "internal_note",
          author: "Marcus Chen",
          body: "Called Able Hydraulics — they have a tech in Oakland who can be on-site by 8:15 AM. Parts in stock. I also reached out to Amazon dispatch to request a 2-hour window extension. Waiting on their reply. Will update once confirmed.",
          minutesAfterCreation: 25,
        },
        {
          type: "customer",
          author: "Marcus Webb",
          body: "Amazon granted the extension to 12:30 PM. That buys us time. Please make sure the tech goes directly to bay 3 loading area — I'll have someone waiting. Also need a formal incident report for our insurance.",
          minutesAfterCreation: 40,
        },
        {
          type: "internal_note",
          author: "Marcus Chen",
          body: "Tech confirmed on-site at 8:20 AM. Starting repairs now. Incident report template prepped — will send once door is operational. Estimated completion 9:45 AM.",
          minutesAfterCreation: 95,
        },
      ],
    },
    {
      externalId: "conv-stockton-hvac-emergency",
      subject: "URGENT: Freezer vault temp rising — sensor alarm triggered",
      status: "open",
      priority: "urgent",
      assignmentState: "assigned",
      assigneeIndex: 2,
      propertyIndex: 1,
      inboxSlug: "escalations",
      customerId: customerIds["cust-sysco-stock"]!,
      preview: "Vault B temperature alarm triggered at 31°F and rising. Product at risk. USDA compliance window is 4 hours.",
      tags: ["cold-chain", "escalation", "hvac"],
      slaOffsetHours: 0.5,
      slaBreached: false,
      slaAtRisk: true,
      createdAgo: 2,
      messages: [
        {
          type: "customer",
          author: "Carlos Reyes",
          body: "Temperature alarm just triggered on Vault B — reading 31°F and trending up. We have $280,000 of Sysco perishables in there. USDA product integrity window is 4 hours at this temp. Need eyes on this NOW.",
          minutesAfterCreation: 0,
        },
        {
          type: "teammate",
          author: "AI Concierge",
          body: "This is a Priority 1 cold chain alert. I've immediately notified Priya Nair (Stockton Facility Manager) and dispatched our refrigeration contractor, Arctic Systems. I'm also logging a real-time temperature incident report. Carlos, please confirm: is the compressor running? Any unusual sounds from the mechanical room?",
          minutesAfterCreation: 2,
        },
        {
          type: "customer",
          author: "Carlos Reyes",
          body: "Compressor is running but there's a grinding sound from the mech room. Could be the condenser fan motor. Temp is now at 33°F. We need the contractor here in the next hour or we start moving product.",
          minutesAfterCreation: 8,
        },
        {
          type: "internal_note",
          author: "Priya Nair",
          body: "Arctic Systems has a tech 15 min out. I've also placed a backup call to FrostPro in case it's a refrigerant leak (need HVAC cert for that). Telling Carlos to start preparing emergency transfer protocol just in case — we have 2 available freezer units on the west side. Current temp: 34°F. This is moving fast.",
          minutesAfterCreation: 18,
        },
      ],
    },
    {
      externalId: "conv-oakland-cam-dispute",
      subject: "CAM reconciliation dispute — Q4 charges 34% above estimate",
      status: "waiting_on_customer",
      priority: "high",
      assignmentState: "assigned",
      assigneeIndex: 1,
      propertyIndex: 0,
      inboxSlug: "billing",
      customerId: customerIds["cust-dhl-oak"]!,
      preview: "DHL is disputing $47,200 in Q4 CAM charges. Corrected reconciliation sent — waiting for DHL's written acceptance before closing.",
      tags: ["billing", "escalation"],
      slaOffsetHours: 6,
      slaBreached: false,
      slaAtRisk: false,
      createdAgo: 8,
      messages: [
        {
          type: "customer",
          author: "Sandra Yee",
          body: "We received the Q4 CAM reconciliation and we're disputing $47,200 of the $139,600 total. The charges appear to include exterior signage renovations and lobby upgrades — neither of which are in our lease scope. Please provide a full line-item breakdown with vendor invoices before we authorize any payment.",
          minutesAfterCreation: 0,
        },
        {
          type: "teammate",
          author: "AI Concierge",
          body: "Hi Sandra — I've logged your CAM dispute (case #FIN-0391) and will route it to your property manager and our accounting team. Per your lease, CAM disputes must be submitted within 90 days of reconciliation (you're within that window). You can expect a full line-item audit response within 5 business days. Is there a preferred contact for our accounting team to reach?",
          minutesAfterCreation: 15,
        },
        {
          type: "internal_note",
          author: "Marcus Chen",
          body: "Pulled the Q4 CAM pool. Sandra is right — the exterior signage ($18k) and lobby ADA upgrade ($29.2k) were mis-allocated from the common area pool. These should have been direct landlord expenses. I'm working with accounting to issue a corrected reconciliation. Expected turnaround: 3 business days. Need to notify DHL proactively.",
          minutesAfterCreation: 180,
        },
        {
          type: "customer",
          author: "Sandra Yee",
          body: "Thank you for the quick initial response. Please ensure the corrected statement includes the calculation methodology — our lease requires full CAM transparency. Also, we will be withholding the disputed amount from next month's payment until this is resolved.",
          minutesAfterCreation: 240,
        },
      ],
    },
    {
      externalId: "conv-fremont-lease-renewal",
      subject: "Unit 7 lease renewal — expansion interest for Unit 8",
      status: "pending",
      priority: "high",
      assignmentState: "assigned",
      assigneeIndex: 3,
      propertyIndex: 2,
      inboxSlug: "vip",
      customerId: customerIds["cust-tesla-frm"]!,
      preview: "Tesla Components wants to renew Unit 7 (18,000 sq ft) and is expressing interest in adjacent Unit 8 if it comes available before June.",
      tags: ["lease-renewal", "renewal", "pricing"],
      slaOffsetHours: 24,
      slaBreached: false,
      slaAtRisk: false,
      createdAgo: 24,
      messages: [
        {
          type: "customer",
          author: "Derek Chang",
          body: "Our lease on Unit 7 expires September 30. We want to renew for another 3 years. We've also been told Unit 8 may come available — we'd like a right-of-first-refusal on that space. Our operations are expanding and we need to know our options by Q2. Who do I speak to about lease economics?",
          minutesAfterCreation: 0,
        },
        {
          type: "teammate",
          author: "AI Concierge",
          body: "Hi Derek — great to hear Tesla Components wants to continue at Fremont Flex! I've flagged this for Travis Ortega, your property manager, to discuss renewal terms and Unit 8 availability. He'll reach out within 24 hours. In the meantime, can you confirm your planned headcount and any operational changes we should factor into the space planning?",
          minutesAfterCreation: 10,
        },
        {
          type: "internal_note",
          author: "Travis Ortega",
          body: "Tesla is our anchor tenant here — we absolutely want to keep them. Unit 8 is on month-to-month with Alvarez Manufacturing; their renewal interest is low (they're looking in Hayward). I think we can present a 3+2 option to Tesla with Unit 8 ROFR starting July 1. Need to run the numbers with ownership first. Will schedule call with Derek by EOW.",
          minutesAfterCreation: 90,
        },
        {
          type: "customer",
          author: "Derek Chang",
          body: "Appreciate the responsiveness. A couple of priorities for the renewal: (1) we need 24/7 access to the mech yard expanded, (2) fiber uptime SLA needs to be in the lease, (3) we'll need a small TI allowance for a cleanroom addition. Happy to discuss all on a call — Thursday afternoon works.",
          minutesAfterCreation: 360,
        },
      ],
    },
    {
      externalId: "conv-stockton-coi-submission",
      subject: "COI expiration notice — insurance cert renewal required",
      status: "waiting_on_customer",
      priority: "medium",
      assignmentState: "assigned",
      assigneeIndex: 2,
      propertyIndex: 1,
      inboxSlug: "support",
      customerId: customerIds["cust-usfoods-stock"]!,
      preview: "US Foods certificate of insurance expired 3 days ago. Must receive updated COI within 7 days per lease terms or access to loading docks will be restricted.",
      tags: ["insurance"],
      slaOffsetHours: 48,
      slaBreached: false,
      slaAtRisk: false,
      createdAgo: 48,
      messages: [
        {
          type: "system",
          author: "Workflow",
          body: "Automated compliance alert: Certificate of Insurance on file for US Foods (policy #ZQRS-441-2024) expired 3 days ago. Tenant has been notified via automated email. Escalation window: 7 days.",
          minutesAfterCreation: 0,
        },
        {
          type: "teammate",
          author: "AI Concierge",
          body: "Hi Bethany — our records show your certificate of insurance on file expired on April 13. Per Section 12.4 of your lease, we need an updated COI naming Northstar Industrial Group as additional insured within 7 days. Can you submit the updated certificate or connect us with your insurance broker?",
          minutesAfterCreation: 30,
        },
        {
          type: "customer",
          author: "Bethany Moss",
          body: "Hi — apologies for the delay. Our broker, Marsh, is processing the renewal. I'm told the updated cert will be ready by Friday. I'll forward it to you as soon as I receive it. Do you have a portal for uploads or should I email it?",
          minutesAfterCreation: 120,
        },
        {
          type: "internal_note",
          author: "Priya Nair",
          body: "Bethany confirmed broker is Marsh — we have their contact on file. If we don't receive the COI by Friday EOD, I'll reach out to Marsh directly. No access restriction yet — we're within the 7-day grace period. Monitoring.",
          minutesAfterCreation: 140,
        },
      ],
    },
    {
      externalId: "conv-oakland-security-incident",
      subject: "After-hours trespassing incident — lot A, east perimeter",
      status: "waiting_on_customer",
      priority: "high",
      assignmentState: "assigned",
      assigneeIndex: 1,
      propertyIndex: 0,
      inboxSlug: "escalations",
      customerId: customerIds["cust-frito-oak"]!,
      preview: "Security incident documented. Footage sent to OPD. Waiting for Frito-Lay to confirm co-funding proposal for perimeter lighting upgrade.",
      tags: ["security", "escalation"],
      slaOffsetHours: 6,
      slaBreached: false,
      slaAtRisk: false,
      createdAgo: 12,
      messages: [
        {
          type: "customer",
          author: "Layla Torres",
          body: "Our night shift supervisor just flagged this: security cameras caught 3 individuals cutting through the east perimeter fence of Lot A at 2:14 AM. One of our trailers was blocked for about 40 minutes. We filed a police report (report #OPD-2024-83741). I need to know what Northstar is doing about the perimeter and if there's surveillance footage we can share with PD.",
          minutesAfterCreation: 0,
        },
        {
          type: "teammate",
          author: "AI Concierge",
          body: "Hi Layla — I'm escalating this immediately to Marcus Chen and our security coordinator. This is a serious incident. We will pull CCTV footage from our system and coordinate with OPD. Can you confirm: was any property damaged or taken? Were any Frito-Lay employees present during the incident?",
          minutesAfterCreation: 5,
        },
        {
          type: "internal_note",
          author: "Marcus Chen",
          body: "Pulled footage from cameras 7, 8, 9 (east perimeter). Got clear faces. Sending to OPD contact tomorrow AM. The fence cut is in the NE corner — about 4 ft section. Called SecureNet to patch fence today. Also pricing permanent fence upgrade for that stretch. Frito-Lay is our most vocal tenant — handle with care, full transparency.",
          minutesAfterCreation: 60,
        },
        {
          type: "customer",
          author: "Layla Torres",
          body: "No employees were present and nothing was taken from our trailers. But this is concerning — this is the second perimeter breach in 6 months. We need to talk about a permanent solution: additional lighting, camera upgrades, or a guard schedule for graveyard shift. Happy to co-fund if Northstar agrees to a matching contribution.",
          minutesAfterCreation: 120,
        },
      ],
    },
    {
      externalId: "conv-fremont-prospective-tenant",
      subject: "Inquiry: Unit 11 availability — 15,000 sq ft flex space",
      status: "open",
      priority: "medium",
      assignmentState: "unassigned",
      assigneeIndex: null,
      propertyIndex: 2,
      inboxSlug: "support",
      customerId: customerIds["cust-prospect-tech"]!,
      preview: "Prospect Logistics inquiring about Unit 11 at Fremont Flex — 15,000 sq ft for last-mile fulfillment. Move-in target Q3 2026. Strong financials.",
      tags: ["prospective-tenant"],
      slaOffsetHours: 3,
      slaBreached: false,
      slaAtRisk: false,
      createdAgo: 6,
      messages: [
        {
          type: "customer",
          author: "Robert Kim",
          body: "Hi — I'm the Head of Real Estate at Prospect Logistics. We're looking for 12,000–18,000 sq ft of flex industrial space in the Fremont/Union City area for a last-mile fulfillment center. Move-in target is Q3 2026. I saw your Fremont Flex listing on LoopNet. Is Unit 11 still available? Can we schedule a tour?",
          minutesAfterCreation: 0,
        },
        {
          type: "teammate",
          author: "AI Concierge",
          body: "Hi Robert — thanks for reaching out about Fremont Flex Industrial Park! Unit 11 (14,800 sq ft) is currently available and well-suited for last-mile operations. It features 2 grade-level doors, 18 ft clear height, and 200A 3-phase power. I'll connect you with Travis Ortega, our leasing manager, to schedule a tour and discuss terms. What's the best number to reach you?",
          minutesAfterCreation: 12,
        },
        {
          type: "internal_note",
          author: "AI Concierge",
          body: "New prospective tenant — Prospect Logistics. Requesting Unit 11. Last-mile fulfillment use case. Q3 2026 target. Robert Kim is decision-maker (Head of Real Estate). Needs assignment to Travis for follow-up. Strong lead — no tenant in this segment currently at Fremont.",
          minutesAfterCreation: 13,
        },
      ],
    },
    {
      externalId: "conv-fremont-pest-control",
      subject: "Pest control complaint — Unit 9 reporting rodent activity",
      status: "open",
      priority: "high",
      assignmentState: "assigned",
      assigneeIndex: 3,
      propertyIndex: 2,
      inboxSlug: "support",
      customerId: customerIds["cust-lam-frm"]!,
      preview: "Lam Research Unit 9 reporting rodent activity near the utility room. BayShield inspection completed — remediation plan sent. Monitoring follow-up.",
      tags: ["pest-control", "maintenance", "escalation"],
      slaOffsetHours: 6,
      slaBreached: false,
      slaAtRisk: false,
      createdAgo: 3,
      messages: [
        {
          type: "customer",
          author: "Nadia Patel",
          body: "We found rodent droppings near the utility room in Unit 9 this morning. This is unacceptable — we have food-grade chemical storage and precision equipment. If this isn't addressed today, we'll have no choice but to notify the health department and document the condition for lease non-compliance purposes.",
          minutesAfterCreation: 0,
        },
        {
          type: "teammate",
          author: "AI Concierge",
          body: "Hi Nadia — I completely understand the severity, especially with food-grade equipment present. I'm escalating this to Priority 1 and notifying Travis Ortega immediately. Our pest control contractor, BayShield, is on a quarterly contract for Fremont Flex — I'm requesting an emergency same-day inspection. Travis will reach out to you within the hour.",
          minutesAfterCreation: 8,
        },
        {
          type: "internal_note",
          author: "Travis Ortega",
          body: "Called BayShield — they can be on-site by 2 PM today. Also checked — Unit 9's last service was 6 weeks ago. The gap between the utility room wall and the HVAC chase is a known entry point (flagged in last inspection). Should have been sealed. Handling that today. Nadia needs a formal written response acknowledging the issue for their records.",
          minutesAfterCreation: 35,
        },
        {
          type: "customer",
          author: "Nadia Patel",
          body: "Thank you for the quick response. Please send a written acknowledgment and the inspection report after BayShield completes their visit. We'll also need documentation of the remediation steps for our internal compliance files. If this is a recurring issue with the building, we'd like to discuss it during our upcoming lease review.",
          minutesAfterCreation: 55,
        },
      ],
    },
    {
      externalId: "conv-stockton-power-outage",
      subject: "Partial power outage — panels B and C offline",
      status: "open",
      priority: "urgent",
      assignmentState: "assigned",
      assigneeIndex: 2,
      propertyIndex: 1,
      inboxSlug: "escalations",
      customerId: customerIds["cust-sysco-stock"]!,
      preview: "Electrical panels B and C tripped during peak load. PG&E restored power — full system check in progress.",
      tags: ["escalation", "cold-chain"],
      slaOffsetHours: 6,
      slaBreached: false,
      slaAtRisk: false,
      createdAgo: 5,
      messages: [
        {
          type: "customer",
          author: "Carlos Reyes",
          body: "Panels B and C went offline 20 minutes ago during peak load. We've got 2 refrigeration units running on backup generator but generator capacity is at 85%. PG&E says 4–6 hours to restore. We need a contingency plan if the generator can't hold — we have $400K in temperature-sensitive product.",
          minutesAfterCreation: 0,
        },
        {
          type: "internal_note",
          author: "Priya Nair",
          body: "PG&E ticket #3841029 filed. Our electrician (Bright Electric) is on-site now diagnosing the panel trip. Generator is ours — capacity is rated for 6 units but currently running 5 (2 Sysco + 3 US Foods). Should hold but margins are tight. Called in a backup portable generator from United Rentals — arrives in 90 min. Coordinating with Carlos.",
          minutesAfterCreation: 15,
        },
        {
          type: "teammate",
          author: "AI Concierge",
          body: "Carlos — I've confirmed with Priya that a backup portable generator is en route (ETA 90 minutes) to ensure full redundancy. Your current generator should hold based on load calculations. Bright Electric is on-site diagnosing the root cause. We'll update you every 30 minutes. Do you need to notify any of your downstream partners about potential delays?",
          minutesAfterCreation: 20,
        },
        {
          type: "customer",
          author: "Carlos Reyes",
          body: "Yes — if this drags past 6 hours we'll have to notify 3 restaurant chains of potential delivery delays. We have a call with our logistics team at 3 PM. Please send a written incident summary by 2:30 PM that we can use internally and with clients. Include timeline, root cause (if known), and restoration ETA.",
          minutesAfterCreation: 45,
        },
      ],
    },
    {
      externalId: "conv-oakland-dock-scheduling",
      subject: "Dock scheduling conflict — overlapping appointments Monday AM",
      status: "pending",
      priority: "medium",
      assignmentState: "assigned",
      assigneeIndex: 1,
      propertyIndex: 0,
      inboxSlug: "support",
      customerId: customerIds["cust-amazon-oak"]!,
      preview: "Amazon has 4 concurrent dock appointments scheduled for Monday 6–8 AM. Building dock capacity is 3 concurrent. Need re-scheduling or dock priority override.",
      tags: ["dock-equipment"],
      slaOffsetHours: 6,
      slaBreached: false,
      slaAtRisk: false,
      createdAgo: 18,
      messages: [
        {
          type: "customer",
          author: "Marcus Webb",
          body: "I just noticed our dock management system shows 4 concurrent appointments for Monday 6–8 AM window: carriers UPS, FedEx, XPO, and Old Dominion. Building capacity is 3 concurrent docks. One of these needs to be pushed to 8–10 AM. Can you confirm dock 14 is fully operational by then (following Friday's repair)?",
          minutesAfterCreation: 0,
        },
        {
          type: "teammate",
          author: "AI Concierge",
          body: "Hi Marcus — I've flagged the scheduling conflict. Good news: Dock 14 is confirmed operational as of Friday 11:30 AM (hydraulic repair completed, tested and certified). For Monday's overlap, I'll reach out to the building coordinator to activate the overflow protocol — we can use dock 16 for the 4th carrier. I'll confirm the resolution by end of day Friday.",
          minutesAfterCreation: 20,
        },
        {
          type: "internal_note",
          author: "Marcus Chen",
          body: "Activated dock 16 for overflow — it's been in standby but all systems functional. Dock 14 repair cert attached to file. Will send Marcus Webb a confirmed schedule update by 5 PM today. Monitor Monday morning just in case.",
          minutesAfterCreation: 120,
        },
      ],
    },
    {
      externalId: "conv-fremont-hvac-unit3",
      subject: "HVAC not cooling — Unit 3 office section overheating",
      status: "waiting_on_customer",
      priority: "medium",
      assignmentState: "unassigned",
      assigneeIndex: null,
      propertyIndex: 2,
      inboxSlug: "support",
      customerId: customerIds["cust-tesla-frm"]!,
      preview: "Tesla Components HVAC filter replaced. Awaiting confirmation from Derek that temperatures are back to normal after 24-hour monitoring window.",
      tags: ["hvac", "maintenance"],
      slaOffsetHours: 6,
      slaBreached: false,
      slaAtRisk: false,
      createdAgo: 36,
      messages: [
        {
          type: "customer",
          author: "Derek Chang",
          body: "The office section of Unit 3 (our overflow space) has been above 82°F for the past two days. The HVAC unit is running but it's not cooling. We have engineers working in there — this is affecting productivity. Can we get someone to look at it this week?",
          minutesAfterCreation: 0,
        },
        {
          type: "teammate",
          author: "AI Concierge",
          body: "Hi Derek — I've logged a maintenance request for the HVAC in Unit 3 office section (ticket #MNT-1192). Given the temperatures, I've flagged this as high priority for our HVAC contractor. You should receive a call to schedule access within 24 hours. Is there a preferred time for the technician to visit?",
          minutesAfterCreation: 25,
        },
        {
          type: "internal_note",
          author: "AI Concierge",
          body: "Unit 3 HVAC — office section. Tesla reporting 82°F+ for 2 days. HVAC running but not cooling (likely refrigerant low or compressor issue). Needs assignment to Travis for contractor dispatch. Not escalated yet but could become urgent if temps continue rising.",
          minutesAfterCreation: 26,
        },
      ],
    },
    {
      externalId: "conv-oakland-billing-overcharge",
      subject: "Incorrect overage charge — parking lot invoice discrepancy",
      status: "resolved",
      priority: "low",
      assignmentState: "assigned",
      assigneeIndex: 1,
      propertyIndex: 0,
      inboxSlug: "billing",
      customerId: customerIds["cust-frito-lay"] ?? customerIds["cust-frito-oak"]!,
      preview: "Frito-Lay was billed for 18 parking spaces in March invoice. Lease covers 12 reserved spaces. $840 overcharge confirmed and credit issued.",
      tags: ["billing"],
      slaOffsetHours: 72,
      slaBreached: false,
      slaAtRisk: false,
      createdAgo: 72,
      messages: [
        {
          type: "customer",
          author: "Layla Torres",
          body: "Our March invoice shows 18 parking spaces billed at $70/space = $1,260. Our lease covers 12 reserved spaces = $840. We're being overcharged $420. Please review and issue a credit to next month's invoice.",
          minutesAfterCreation: 0,
        },
        {
          type: "internal_note",
          author: "Marcus Chen",
          body: "Confirmed — billing system error. The parking module pulled from an old allocation before the amendment. Corrected in the system. Credit of $420 will appear on next month's invoice. Notifying Layla.",
          minutesAfterCreation: 90,
        },
        {
          type: "teammate",
          author: "Marcus Chen",
          body: "Hi Layla — you are absolutely correct. We identified the billing error in our parking module (it was using a pre-amendment allocation). A credit of $420 will appear on your April invoice. I've also corrected the underlying record to prevent recurrence. Sorry for the inconvenience.",
          minutesAfterCreation: 95,
        },
        {
          type: "customer",
          author: "Layla Torres",
          body: "Thank you for the quick resolution. Appreciated. Please make sure the correction is permanent — we had a similar issue in Q2 last year.",
          minutesAfterCreation: 240,
        },
      ],
    },
    {
      externalId: "conv-stockton-dock-expansion",
      subject: "Lease amendment request — additional dock door access",
      status: "waiting_on_customer",
      priority: "medium",
      assignmentState: "assigned",
      assigneeIndex: 2,
      propertyIndex: 1,
      inboxSlug: "vip",
      customerId: customerIds["cust-usfoods-stock"]!,
      preview: "US Foods dock expansion proposal sent with revised Q3 pricing. Awaiting US Foods signature on the lease amendment addendum.",
      tags: ["lease-renewal", "pricing"],
      slaOffsetHours: 12,
      slaBreached: false,
      slaAtRisk: false,
      createdAgo: 30,
      messages: [
        {
          type: "customer",
          author: "Bethany Moss",
          body: "Our Q3 volume projections are 35% above Q2. We currently have access to docks 4 and 5 under our lease. We'd like to amend the lease to add docks 6 and 7 on a priority basis from July 1 through September 30. We're prepared to pay a reasonable premium for this. Can you confirm availability and pricing?",
          minutesAfterCreation: 0,
        },
        {
          type: "teammate",
          author: "AI Concierge",
          body: "Hi Bethany — thank you for the advance notice on Q3 volumes. I've flagged this expansion request for Priya Nair to review dock 6 and 7 availability. Given your COI renewal is also in process, I'll make sure Priya addresses both items together. You can expect a response within 48 hours.",
          minutesAfterCreation: 30,
        },
        {
          type: "internal_note",
          author: "Priya Nair",
          body: "Docks 6 and 7 are available Q3 — Sysco has first right on dock 6 per their lease but only exercises it 60% of the time. Need to check with Carlos before committing to US Foods. Pricing: suggesting $1,800/dock/month for temporary priority access (premium over standard allocation rate). Will present to Bethany once confirmed.",
          minutesAfterCreation: 120,
        },
      ],
    },
    {
      externalId: "conv-fremont-parking-dispute",
      subject: "Parking encroachment — Unit 12 vs Unit 13 conflict",
      status: "waiting_on_customer",
      priority: "medium",
      assignmentState: "unassigned",
      assigneeIndex: null,
      propertyIndex: 2,
      inboxSlug: "support",
      customerId: customerIds["cust-lam-frm"]!,
      preview: "Lam Research (Unit 12) reports Unit 13 vehicles regularly blocking their allocated loading zone. Conflict resolution letter sent — awaiting Unit 13 written acknowledgement.",
      tags: ["maintenance"],
      slaOffsetHours: 8,
      slaBreached: false,
      slaAtRisk: false,
      createdAgo: 18,
      messages: [
        {
          type: "customer",
          author: "Nadia Patel",
          body: "This is an ongoing issue. Unit 13 trucks are blocking our loading zone almost every morning from 7–9 AM. We have documented it with photos. This is starting to affect our daily operations.",
          minutesAfterCreation: 0,
        },
        {
          type: "teammate",
          author: "AI Concierge",
          body: "Thank you for documenting this, Nadia. I've flagged it as a neighbor conflict dispute and sent a formal courtesy notice to Unit 13 management. Our property team will follow up with both parties. Can you share the photos so we can attach them to the formal record?",
          minutesAfterCreation: 4,
        },
        {
          type: "internal_note",
          author: "Travis Ortega",
          body: "Sent conflict resolution letter to Unit 13 (Matson Logistics). They acknowledged the problem and said they'd brief their drivers. Waiting on their written confirmation before closing.",
          minutesAfterCreation: 240,
        },
      ],
    },
    {
      externalId: "conv-oakland-hvac-zone-b",
      subject: "HVAC complaint — Zone B warehouse temperature spike",
      status: "open",
      priority: "medium",
      assignmentState: "unassigned",
      assigneeIndex: null,
      propertyIndex: 0,
      inboxSlug: "support",
      customerId: customerIds["cust-frito-oak"]!,
      preview: "Frito-Lay Zone B warehouse reaching 91°F during afternoon hours. Submitted 3 days ago — needs assignment to facilities team.",
      tags: ["hvac", "maintenance"],
      slaOffsetHours: 5,
      slaBreached: false,
      slaAtRisk: false,
      createdAgo: 48,
      messages: [
        {
          type: "customer",
          author: "Layla Torres",
          body: "Zone B is getting uncomfortably hot in the afternoons — our temperature sensors are reading 91°F. This is above acceptable limits for our packaging equipment. We need this looked at before Friday.",
          minutesAfterCreation: 0,
        },
        {
          type: "teammate",
          author: "AI Concierge",
          body: "Noted, Layla. A maintenance ticket has been created for the HVAC system in Zone B. Our facilities team will contact you to schedule an inspection. In the meantime, are there specific hours when the temperature peaks? This will help narrow down the cause.",
          minutesAfterCreation: 5,
        },
        {
          type: "customer",
          author: "Layla Torres",
          body: "Yes — it spikes between 1 PM and 4 PM. Worst on south-facing units. Please send someone this week.",
          minutesAfterCreation: 30,
        },
      ],
    },
    {
      externalId: "conv-oakland-roof-drainage",
      subject: "Roof drainage blockage — Unit 18 northeast corner",
      status: "open",
      priority: "medium",
      assignmentState: "assigned",
      assigneeIndex: 1,
      propertyIndex: 0,
      inboxSlug: "support",
      customerId: customerIds["cust-amazon-oak"]!,
      preview: "Amazon DC reports standing water accumulating on the Unit 18 roof after last week's rain. Clogged drain suspected — roofing contractor inspection scheduled.",
      tags: ["maintenance"],
      slaOffsetHours: 7,
      slaBreached: false,
      slaAtRisk: false,
      createdAgo: 24,
      messages: [
        {
          type: "customer",
          author: "Marcus Webb",
          body: "After last week's rain we noticed significant standing water on the Unit 18 roof visible from our mezzanine. There's a drain on the northeast corner that may be clogged. We're concerned about leaks.",
          minutesAfterCreation: 0,
        },
        {
          type: "teammate",
          author: "AI Concierge",
          body: "Thank you for flagging this, Marcus. Standing water on a flat roof can cause structural stress and potential leaks if unaddressed. I've created a maintenance work order and notified Marcus Chen. Our roofing contractor will be scheduled for an inspection within 48 hours.",
          minutesAfterCreation: 6,
        },
        {
          type: "internal_note",
          author: "Marcus Chen",
          body: "Scheduled BayRoofing for Thursday 8 AM. Unit 18 roof drain likely packed with debris from the March storm. Will confirm with Marcus Webb once contractor is confirmed.",
          minutesAfterCreation: 90,
        },
      ],
    },
    {
      externalId: "conv-stockton-annual-inspection",
      subject: "Annual property inspection — Q2 scheduling request",
      status: "pending",
      priority: "low",
      assignmentState: "assigned",
      assigneeIndex: 2,
      propertyIndex: 1,
      inboxSlug: "support",
      customerId: customerIds["cust-sysco-stock"]!,
      preview: "Sysco requesting Q2 annual inspection to be scheduled before June 30. Coordinating preferred access windows across their 3 units.",
      tags: ["maintenance"],
      slaOffsetHours: 24,
      slaBreached: false,
      slaAtRisk: false,
      createdAgo: 72,
      messages: [
        {
          type: "customer",
          author: "Carlos Reyes",
          body: "Can we get the Q2 annual inspection scheduled? Our lease requires it before June 30. We'd prefer a Monday or Tuesday before 10 AM to minimize disruption to receiving operations.",
          minutesAfterCreation: 0,
        },
        {
          type: "teammate",
          author: "AI Concierge",
          body: "Noted, Carlos. I've passed your scheduling preferences to Priya Nair, your Stockton Facility Manager. She'll confirm the exact date within 48 hours. Annual inspections typically cover fire safety systems, dock equipment, HVAC, and roof drainage.",
          minutesAfterCreation: 10,
        },
        {
          type: "internal_note",
          author: "Priya Nair",
          body: "Proposed June 9 (Monday), 8–11 AM. Need to confirm with the inspection vendor (CalProp Inspections) before sending final confirmation to Carlos. Checking vendor calendar now.",
          minutesAfterCreation: 1440,
        },
      ],
    },
    {
      externalId: "conv-fremont-early-termination",
      subject: "Early termination notice — Unit 5, 90-day clause",
      status: "pending",
      priority: "high",
      assignmentState: "assigned",
      assigneeIndex: 3,
      propertyIndex: 2,
      inboxSlug: "vip",
      customerId: customerIds["cust-tesla-frm"]!,
      preview: "Tesla Components invoking 90-day early termination clause on Unit 5. Reviewing lease terms and evaluating re-leasing timeline. High-value replacement tenant being sourced.",
      tags: ["lease-renewal", "escalation"],
      slaOffsetHours: 10,
      slaBreached: false,
      slaAtRisk: false,
      createdAgo: 48,
      messages: [
        {
          type: "customer",
          author: "Derek Chang",
          body: "We are initiating early termination on Unit 5 per Section 18.3 of our lease agreement. Our effective date would be 90 days from today. Please confirm receipt and advise on the next steps for a clean handover.",
          minutesAfterCreation: 0,
        },
        {
          type: "teammate",
          author: "AI Concierge",
          body: "Received, Derek. I've forwarded your early termination notice to Travis Ortega, your account manager, and our legal team. Per your lease terms, the 90-day notice period is being logged. Travis will reach out to discuss the move-out timeline and security deposit process.",
          minutesAfterCreation: 8,
        },
        {
          type: "internal_note",
          author: "Travis Ortega",
          body: "Reviewing lease Section 18.3. Tesla's 90-day notice appears valid. Unit 5 is 8,200 sq ft — should be straightforward to re-lease given Fremont market demand. Will draft a prospective tenant outreach for this space. Flagging for Jordan's awareness given revenue impact.",
          minutesAfterCreation: 120,
        },
      ],
    },
    {
      externalId: "conv-stockton-badge-access",
      subject: "New employee badge access — 4 additional team members",
      status: "open",
      priority: "low",
      assignmentState: "assigned",
      assigneeIndex: 2,
      propertyIndex: 1,
      inboxSlug: "support",
      customerId: customerIds["cust-usfoods-stock"]!,
      preview: "US Foods requesting facility badge access for 4 new hires starting Monday. Access Control form submitted — processing with security vendor.",
      tags: ["security"],
      slaOffsetHours: 8,
      slaBreached: false,
      slaAtRisk: false,
      createdAgo: 16,
      messages: [
        {
          type: "customer",
          author: "Bethany Moss",
          body: "We have 4 new team members starting Monday who need badge access to the facility. I've filled out your access control form and emailed it to operations. Can you confirm the processing timeline? We need access active by 6 AM Monday.",
          minutesAfterCreation: 0,
        },
        {
          type: "teammate",
          author: "AI Concierge",
          body: "Got it, Bethany. Badge provisioning requests typically take 1–2 business days. I've forwarded your request to Priya Nair and our security vendor (SecureLogix). Priya will confirm activation before end of business Friday.",
          minutesAfterCreation: 7,
        },
        {
          type: "internal_note",
          author: "Priya Nair",
          body: "Submitted to SecureLogix. They confirmed 24-hour turnaround. Badges will be ready Friday by 3 PM. Will send activation confirmation to Bethany then.",
          minutesAfterCreation: 60,
        },
      ],
    },
  ];
}

interface BuiltConversation {
  seed: ConversationSeed;
  staffIds: string[];
  inboxIds: string[];
  propertyIds: string[];
}

async function seedConversations(
  tenantId: string,
  propertyIds: string[],
  staffIds: string[],
  inboxIds: string[],
  customerIds: Record<string, string>,
  tagMap: Record<string, string>,
) {
  const conversations = buildConversations(staffIds, customerIds);
  const inboxSlugs = ["support", "escalations", "billing", "vip"];

  for (const conv of conversations) {
    const existingConv = await sql`SELECT id FROM help_conversations WHERE tenant_id = ${tenantId} AND external_thread_id = ${conv.externalId} LIMIT 1`;
    if (existingConv.length > 0) {
      console.log("Skip (exists):", conv.subject.slice(0, 60));
      continue;
    }

    const propertyId = propertyIds[conv.propertyIndex] ?? null;
    const assigneeStaffId = conv.assigneeIndex !== null ? (staffIds[conv.assigneeIndex] ?? null) : null;
    const inboxSlugIndex = inboxSlugs.indexOf(conv.inboxSlug);
    const inboxId = inboxIds[inboxSlugIndex] ?? inboxIds[0] ?? null;

    const createdAt = h(conv.createdAgo);
    const lastMessageAt = m(5);

    const dueAt = conv.slaBreached
      ? h(1)
      : conv.slaAtRisk
        ? new Date(now.getTime() + 30 * 60 * 1000)
        : new Date(now.getTime() + 4 * 60 * 60 * 1000);

    const [convRow] = await sql`
      INSERT INTO help_conversations (
        tenant_id, property_id, inbox_id, customer_id, external_thread_id,
        subject, status, priority, assignment_state, assignee_staff_id,
        channel, preview, unread_count, message_count,
        first_response_due_at, next_response_due_at, resolution_due_at,
        last_customer_message_at, last_message_at,
        closed_at, created_at, updated_at
      )
      VALUES (
        ${tenantId}, ${propertyId}, ${inboxId}, ${conv.customerId}, ${conv.externalId},
        ${conv.subject}, ${conv.status}, ${conv.priority}, ${conv.assignmentState}, ${assigneeStaffId},
        'email', ${conv.preview}, ${conv.status !== "resolved" ? 1 : 0}, ${conv.messages.length},
        ${dueAt}, ${new Date(dueAt.getTime() + 60 * 60 * 1000)}, ${new Date(dueAt.getTime() + 24 * 60 * 60 * 1000)},
        ${lastMessageAt}, ${lastMessageAt},
        ${conv.status === "resolved" ? h(1) : null}, ${createdAt}, ${lastMessageAt}
      )
      RETURNING id
    `;

    const convId = convRow.id as string;

    const ticketNumber = `NIG-${String(Math.floor(Math.random() * 9000) + 1000)}`;
    await sql`
      INSERT INTO help_tickets (
        tenant_id, property_id, conversation_id, ticket_number, status, priority,
        team, assignee_staff_id, next_milestone,
        resolved_at, created_at, updated_at
      )
      VALUES (
        ${tenantId}, ${propertyId}, ${convId}, ${ticketNumber}, ${conv.status}, ${conv.priority},
        ${conv.inboxSlug === "billing" ? "Billing" : conv.inboxSlug === "vip" ? "VIP" : conv.inboxSlug === "escalations" ? "Escalations" : "Support"},
        ${assigneeStaffId},
        ${conv.status === "resolved" ? "Resolved" : conv.slaBreached ? "SLA breached — urgent response needed" : conv.slaAtRisk ? "Respond within 30 minutes" : "Monitor and respond"},
        ${conv.status === "resolved" ? h(1) : null},
        ${createdAt}, ${lastMessageAt}
      )
    `;

    for (const tagSlug of conv.tags) {
      const tagId = tagMap[tagSlug];
      if (!tagId) continue;
      await sql`
        INSERT INTO help_conversation_tags (tenant_id, property_id, conversation_id, tag_id)
        VALUES (${tenantId}, ${propertyId}, ${convId}, ${tagId})
        ON CONFLICT DO NOTHING
      `;
    }

    for (let i = 0; i < conv.messages.length; i++) {
      const msg = conv.messages[i]!;
      const msgCreatedAt = new Date(createdAt.getTime() + msg.minutesAfterCreation * 60 * 1000);
      const isStaff = msg.type === "teammate" || msg.type === "internal_note" || msg.type === "system";
      await sql`
        INSERT INTO help_messages (
          tenant_id, property_id, conversation_id, author_staff_id,
          message_type, author_label, body, metadata_json, created_at
        )
        VALUES (
          ${tenantId}, ${propertyId}, ${convId},
          ${isStaff ? assigneeStaffId : null},
          ${msg.type}, ${msg.author}, ${msg.body}, '{}', ${msgCreatedAt}
        )
      `;
    }

    console.log("Seeded:", conv.subject.slice(0, 60));
  }
}

async function seedPlatformKnowledge(_tenantId: string) {
  const demoTitles = [
    "Dock Operating Hours & Procedures",
    "Building Contacts",
    "Temperature Monitoring & Compliance",
    "Unit Directory & Tenant Guide",
    "CAM Charges & Lease Basics",
  ];
  await sql`DELETE FROM platform_knowledge WHERE title = ANY(${demoTitles})`;

  const entries = [
    {
      section: "Oakland Distribution Center",
      title: "Dock Operating Hours & Procedures",
      content: `The Oakland Distribution Center operates 24/7 with staffed dock management Mon–Fri 5 AM–10 PM and Sat 6 AM–4 PM.

Dock doors 1–26 (west side) are standard 48" x 96" with hydraulic levelers. Doors 27–52 (east side) include 4 high-dock doors (27–30) for container offload.

Scheduling: All dock appointments must be booked 24 hours in advance via the tenant portal or by calling (510) 555-0140.

Emergency dock access: For after-hours emergencies, call the on-call line at (510) 555-0199.`,
    },
    {
      section: "Oakland Distribution Center",
      title: "Building Contacts",
      content: `Property Manager: Marcus Chen — marcus.chen@northstar-industrial.com — (510) 555-0101
Maintenance Hotline: (510) 555-0102 (24/7 for emergencies)
Security Office: (510) 555-0103
Leasing: Jordan Parker — demo@northstar.com — (510) 555-0100`,
    },
    {
      section: "Stockton Cold Storage",
      title: "Temperature Monitoring & Compliance",
      content: `The Stockton Cold Storage Facility maintains USDA-compliant temperature monitoring 24/7.

Vault temperatures:
- Freezer vaults (A–D): Maintained at 0°F to 10°F
- Cooler zones (E–J): Maintained at 34°F to 38°F
- Dock staging area: Maintained at 45°F

Temperature alarms are monitored by our central control room. Any excursion triggers an automatic notification to the Facility Manager and the affected tenant within 5 minutes.

Emergency protocol: If temperatures rise above 38°F in freezer vaults, the emergency generator automatically kicks in and Arctic Systems (refrigeration contractor) is dispatched.`,
    },
    {
      section: "Fremont Flex Industrial Park",
      title: "Unit Directory & Tenant Guide",
      content: `Fremont Flex Industrial Park — 15 Units

Units 1–5: 8,000–10,000 sq ft (smaller flex spaces)
Units 6–10: 12,000–15,000 sq ft (mid-size flex)
Units 11–15: 16,000–22,000 sq ft (large flex)

Current Tenants:
- Unit 7 & shared overflow: Tesla Components (Derek Chang)
- Unit 9: Lam Research (Nadia Patel)
- Unit 11: Available

Shared amenities: Conference room (Building A), EV charging (8 stations), shared restrooms per building cluster.

Park Manager: Travis Ortega — travis.ortega@northstar-industrial.com — (510) 555-0104`,
    },
    {
      section: "General Policies",
      title: "CAM Charges & Lease Basics",
      content: `All Northstar Industrial Group leases are triple-net (NNN). Tenants are responsible for their proportionate share of:
- Property taxes
- Building insurance premiums
- Common area maintenance (CAM) costs

CAM reconciliation: Annual, sent by March 31. Tenants have 90 days to dispute.

CAM exclusions (typical): Capital improvements, management fees above 5% of CAM pool, costs recoverable from insurance.

Rent payment: Due 1st of month. 5-day grace period. Late fee: 5% of monthly rent after grace period.`,
    },
  ];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;
    await sql`
      INSERT INTO platform_knowledge (section, title, content, sort_order)
      VALUES (${entry.section}, ${entry.title}, ${entry.content}, ${i})
    `;
    console.log("Knowledge entry:", entry.title);
  }
}

async function clearHelpdeskData(tenantId: string): Promise<void> {
  console.log("Clearing existing helpdesk data for tenant…");
  await sql`DELETE FROM help_conversation_tags WHERE tenant_id = ${tenantId}`;
  await sql`DELETE FROM help_messages WHERE tenant_id = ${tenantId}`;
  await sql`DELETE FROM help_tickets WHERE tenant_id = ${tenantId}`;
  await sql`DELETE FROM help_conversations WHERE tenant_id = ${tenantId}`;
  await sql`DELETE FROM help_customers WHERE tenant_id = ${tenantId}`;
  console.log("Helpdesk data cleared.");
}

async function main() {
  console.log("=== Northstar Industrial Group — Demo Seed ===\n");

  const tenantId = await upsertTenant();
  const propertyIds = await upsertProperties(tenantId);
  const staffIds = await upsertDemoStaff(tenantId, propertyIds);
  const inboxIds = await upsertInboxes(tenantId, propertyIds);

  await clearHelpdeskData(tenantId);

  const tagMap = await upsertTags(tenantId);
  const customerIds = await upsertCustomers(tenantId, propertyIds);

  await seedConversations(tenantId, propertyIds, staffIds, inboxIds, customerIds, tagMap);
  await seedPlatformKnowledge(tenantId);

  console.log("\n=== Seed complete ===");
  console.log("Demo login: demo@northstar.com / Demo2026");
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
