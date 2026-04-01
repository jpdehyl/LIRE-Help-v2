# LIRE — Master Plan
**Light Industrial Real Estate Intelligence**
*An AI-Powered 24/7 Property Management Platform*
*Spinoff of Host Help · Built by Dehyl SAS*

---

## 1. Vision & Strategic Premise

> **Growth should not mean linear complexity.**

LIRE is an AI-native operations layer for light industrial property portfolios. Where legacy PM software acts as a passive database requiring constant human input, LIRE operates as an **active digital workforce** — executing routines, surfacing anomalies, and escalating only what requires human judgment.

The core thesis: industrial landlords managing distributed assets face four structural frictions that multiply with scale. LIRE eliminates all four simultaneously, allowing portfolios to grow without proportional growth in headcount or chaos.

**Parent Platform:** Host Help (short-term rental AI ops)
**Target Vertical:** Light industrial — warehouses, distribution centers, flex industrial
**Primary Market:** U.S. institutional and regional landlords (15 target growth markets)
**Scale Signal:** 280+ active investments · 14M+ SQ FT · nationwide distribution

---

## 2. The Problem: Four Frictions of Industrial Scale

| Friction | Current Reality |
|---|---|
| **Reactive Maintenance** | Issues discovered too late. Damage reports lost; repairs are always emergencies, never orchestrated. |
| **24/7 Tenant Demands** | Logistics supply chains never sleep. Human managers forced to answer inquiries on weekends and at midnight. |
| **Compliance Blindspots** | Critical dates for municipal certifications, insurance, and lease expirations tracked manually — and missed. |
| **Fragmented Data** | Legacy systems act as passive storage. Vital knowledge siloed across PDFs and managers' heads. |

These frictions compound: a missed compliance date becomes a legal liability; a 2 AM maintenance call that goes unanswered becomes a tenant churn event.

---

## 3. Core Product Philosophy

**From Passive Database → Active Digital Workforce**

Legacy PM software requires a human to query it before it provides value. LIRE inverts this: the system continuously monitors the portfolio, initiates actions, and surfaces only exceptions that require human oversight.

```
Legacy:    Human → Query → Software → Result
LIRE:      Software → Action → Human (only for high-stakes decisions)
```

**The 90/10 Principle:**
- **90% Routine Work** handled autonomously: tenant FAQs, basic maintenance dispatch, document collection, automated follow-ups
- **10% High-Stakes Escalation** routed to human managers: major structural incidents, lease defaults, payment irregularities, unapproved cost overruns

---

## 4. Product Architecture: The Command Center

LIRE's interface is a single centralized Command Center. The AI orchestrates the daily routine; the manager dictates portfolio strategy.

### 4.1 Core Modules

#### A. Tenant Communication Hub
- Real-time multi-channel inbox (SMS, WhatsApp, Web)
- **Native multilingual:** auto-detects and responds in English, Spanish, and French
- AI drafts and sends responses; human review optional
- Full conversation history per property/tenant

#### B. Maintenance Dispatch Engine
- Automatically receives and categorizes tenant issue reports
- Cross-references tenant lease to determine repair responsibility
- Assigns authorized local vendors with strict resolution SLAs
- Logs all repair costs and tracks real-time progress — zero manual intervention
- Live tracking of vendor assignments and costs in Command Center

#### C. Portfolio Compliance Timeline
- Automated calendar of all upcoming lease and municipal deadlines
- **4-trigger escalation ladder:**
  - **60 Days Prior:** Initial audit & warning
  - **30 Days Prior:** Automated document request
  - **15 Days Prior:** Escalation to vendor/tenant
  - **7 Days Prior:** Final manager alert
- Covers: commercial lease renewals & rent escalations · vendor and tenant insurance certificates · local municipal compliance & safety inspections

#### D. Knowledge Base (Continuous Learning Engine)
- Three-step loop: Natural Conversation → AI Extracts Facts → Knowledge Base Update
- Automatically rewrites property operational manual after each interaction
- Identifies new parameters extracted from conversation (e.g., "Gate code changed to 4321")
- Institutional knowledge permanently retained — zero data entry required

---

## 5. Signature Workflow: The 2 AM Dock Door Failure

This is LIRE's canonical demo scenario. It demonstrates full autonomous resolution without waking a human.

```
1. INTAKE      Tenant texts at 2:00 AM reporting jammed loading dock door
       ↓
2. ANALYSIS    AI cross-references lease to determine repair responsibility
       ↓
3. DISPATCH    AI contacts preferred local vendor for that specific property
       ↓
4. LOGGING     AI creates fully documented ticket with timestamps in Command Center
       ↓
5. RESOLUTION  Asset Manager wakes at 7:00 AM to a concise summary of resolved issue
```

**Result:** Zero human involvement overnight. Full audit trail. Tenant satisfied. Manager informed at 7 AM.

---

## 6. Onboarding: Operational in Days, Not Months

No complex IT overhaul. Three steps to live deployment:

1. **Configure Data Base**
   Upload existing leases, building spec sheets, and vendor lists. AI instantly reads and understands the portfolio.

2. **Connect Communications**
   Link existing email domains and dedicated WhatsApp business numbers.

3. **Go Live**
   Deploy the 24/7 digital team across all tenant touchpoints immediately.

---

## 7. Pricing Architecture: Three Tiers

| Tier | Target | Features |
|---|---|---|
| **Basic Portfolio** | Initial market testing | Core AI agent · Central dashboard |
| **Professional Portfolio** | Comprehensive ops | Proactive maintenance · Automated compliance · Real-time manager alerts |
| **Enterprise Portfolio** | 10M+ SQ FT | Unlimited properties · Full white-labeling · Dedicated account management · Guaranteed SLAs |

*Pricing model TBD — likely per-property or per-sq-ft monthly SaaS.*

---

## 8. Competitive Differentiation vs. Legacy Software

| Dimension | Legacy Software | LIRE |
|---|---|---|
| **Tenant Comms** | Manual inbox management | Instant 24/7 multilingual resolution |
| **Maintenance** | Requires human dispatch & follow-up | Autonomous vendor routing & tracking |
| **Compliance** | Passive calendar reminders | Active document auditing and escalation |
| **Scalability** | More headcount as SQ FT grows | Infinite scale without added friction |

---

## 9. Technical Stack (Current Development)

> *Being built natively with Dex on Claude Code*

- **AI Layer:** Anthropic Claude API (Sonnet + Haiku) — same stack as Capitán DD / Host Help
- **Communication Channels:** WhatsApp Business API · SMS · Web widget
- **Backend:** Node.js (consistent with Host Help architecture)
- **Data/Knowledge Base:** Vector DB for property documents + structured lease data
- **Dashboard:** React frontend
- **PDF/Document Parsing:** WeasyPrint-compatible pipeline (established pattern from Dehyl)
- **Deployment:** Cloud-hosted, multi-tenant SaaS

### Agent Architecture Pattern (from Host Help lineage)
```
Incoming Message
      ↓
Intent Classification (Haiku — fast/cheap)
      ↓
Context Retrieval (Property KB + Lease Data)
      ↓
Action Routing:
  → Routine Response (Haiku)
  → Complex/Legal/Financial → Sonnet
  → Escalation Trigger → Human Alert
      ↓
Response + Action Log
```

---

## 10. Roadmap

### Phase 0 — Foundation (Current)
- [ ] Core Claude agent with property knowledge base
- [ ] WhatsApp channel integration
- [ ] Central dashboard MVP (Command Center shell)
- [ ] Onboarding flow: lease/doc upload → instant KB

### Phase 1 — Core Workflows
- [ ] Maintenance dispatch module (vendor assignment + tracking)
- [ ] Tenant communication hub (multi-channel inbox)
- [ ] Basic compliance calendar (manual deadlines)
- [ ] Demo scenario: 2 AM dock door workflow end-to-end

### Phase 2 — Automation Layer
- [ ] Automated compliance escalation ladder (60/30/15/7 days)
- [ ] Continuous learning engine (conversation → KB auto-update)
- [ ] Vendor management module (authorized vendors per property)
- [ ] 90/10 escalation logic (routine vs. high-stakes routing)

### Phase 3 — Scale & Enterprise
- [ ] White-label capability
- [ ] Multi-portfolio / multi-client architecture
- [ ] SLA monitoring and reporting
- [ ] API for PMS integrations (Yardi, AppFolio, etc.)
- [ ] Analytics dashboard (cost per ticket, resolution time, compliance score)

---

## 11. Go-to-Market

### Primary Audience
- Light industrial REITs and funds (280+ investments scale)
- Regional industrial landlords with 5–50 properties
- Asset managers who currently rely on third-party PM firms

### Entry Strategy
- Lead with the **"2 AM scenario"** as conversion demo
- Freemium / pilot: Basic Portfolio free for 90 days on first 3 properties
- Vertical trade shows: NAIOP, SIOR, ProLogis ecosystem
- Leverage Host Help brand credibility for cross-sell to mixed-use operators

### Positioning Line
> *"You don't need another dashboard to look at. You need an autonomous team that operates inside the dashboard."*

---

## 12. Multi-Tenant Architecture

LIRE Help follows the same multi-tenant pattern established by Host Help (capitan-dd). Each vertical is a fork of the platform engine, and each client gets their own tenant subdomain with a dedicated AI agent.

### Platform Structure

```
capitan-dd (platform engine)
├── Host Help (hospitality vertical) — host-help.com
│   ├── app.host-help.com/dashboard          → Platform admin
│   └── sancibrian.host-help.com/dashboard   → Tenant #1 (Cabaña Sancibrian, agent: El Capitán)
│
└── LIRE Help (industrial vertical) — lire-help.com
    ├── app.lire-help.com/dashboard          → Platform admin
    └── berkeley.lire-help.com/dashboard     → Tenant #1 (Berkeley Partners, agent: TBD)
```

### URL Pattern (standard for all verticals)
- `app.<vertical>.com/dashboard` — Platform admin dashboard
- `<tenant>.<vertical>.com/dashboard` — Tenant-specific dashboard with dedicated AI agent

### Relationship Table

| | Host Help | LIRE |
|---|---|---|
| **Segment** | Short-term rental hosts | Industrial landlords |
| **Tenant #1** | Cabaña Sancibrian | Berkeley Partners |
| **Agent Name** | El Capitán (Sancibrian) | TBD |
| **Primary Channel** | WhatsApp | WhatsApp + Email |
| **Core Problem** | Guest experience + ops | Tenant ops + compliance |
| **AI Stack** | Claude API (Sonnet + Haiku) | Claude API (Sonnet + Haiku) |
| **Knowledge Source** | Property manuals + availability | Leases + building specs + vendor lists |

**Shared infrastructure** (reusable from Host Help): WhatsApp integration layer · Claude API orchestration · Document ingestion pipeline · Conversation memory architecture

LIRE is the **B2B enterprise** extension of the same AI property operations thesis that Host Help proves in the SMB/STR market. Both validate Dehyl's core capability: turning property documents into autonomous AI agents.

---

## 13. Open Questions / Decisions Pending

- [ ] **Agent name/brand** for the industrial-facing AI personality
- [ ] **Pricing model:** per property vs. per sq ft vs. per interaction
- [ ] **U.S. legal/compliance scope:** state-by-state municipal tracking feasibility
- [ ] **PMS integration priority:** Yardi first? AppFolio? MRI?
- [ ] **White-label strategy:** sell to PM firms as embedded tool vs. direct to landlords
- [ ] **Multilingual scope:** English + Spanish confirmed; French priority for Canada (JP/Dehyl Canada angle?)

---

*Last updated: March 2026 · Dehyl SAS · Medellín, Colombia*
*Built by Alejandro Domínguez — mune100g@gmail.com*
