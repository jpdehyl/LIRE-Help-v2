# Berkeley Partners — Discovery Proposal

**Prepared for:** Bahaar — Senior Manager, Berkeley Partners
**Prepared by:** Alejandro Dominguez — Dehyl SAS
**Date:** 2026-04-17
**Status:** Draft for internal review
**Companion meeting notes:** [Granola transcript](https://notes.granola.ai/t/33eabf97-cf86-4055-a69e-c10c6eb38efb)

---

## 1. Context

Berkeley Partners manages ~14M sq ft of light industrial real estate across ~1,000 tenants, supported by a stack of Yardi (PM), Juniper Square (CRM), Chatham (debt), and VTS (leasing). Enterprise Claude + ChatGPT licenses are live on Azure, and an org-wide AI relaunch is underway with a top-down, iterative posture.

Two pain points surfaced in our April 17 call as the best candidates for a quick, high-trust proof of concept:

1. **VTS underutilization** — the platform is paid for across the portfolio but only actively used for site plans and unit layouts. Brokers and leasing teams avoid the deeper functionality because of UX friction.
2. **Tenant financial review** — checklists exist, but reviewing ~1,000 tenants is still manual-intensive. This is classic human-in-the-loop territory.

Both problems are small enough to pilot in weeks, large enough to compound if they work, and they map cleanly onto the automation pattern Dehyl has already shipped for Mark Hawkerage (SDR research, 2h/day → automated) and Alejandro's hospitality agents in Colombia (8-agent guest lifecycle, scaled to 5 hotels).

---

## 2. Guiding Principles

- **Iterative over comprehensive.** Bahaar was clear: no 3-month strategy deck. We ship a narrow POC, measure, expand.
- **Enterprise-AI only.** Every tool we propose runs on Claude Enterprise or ChatGPT Enterprise, or on infrastructure that respects Berkeley's data boundary (Azure). No consumer endpoints, no unknown vendors touching proprietary tenant data.
- **SEC-archivable by design.** Any AI-generated artifact we produce (summaries, memos, outbound comms) is captured to an immutable log so Berkeley's compliance team can satisfy archiving obligations without rework. We flag open regulatory questions to Berkeley's legal team before going live.
- **Human-in-the-loop on every high-stakes decision.** Automation surfaces a recommendation; a human approves. Same 90/10 model used in LIRE.

---

## 3. Proposed Pilots

### 3.1 Pilot A — VTS-Lite Leasing Workspace

**Pain today.** VTS is an enterprise-grade deal management + asset intelligence platform that in 2026 added AI lease abstraction ([Asset Intelligence launch](https://www.vts.com/news/assetintelligencelaunch)). Berkeley's brokers don't use any of that — they use VTS as an expensive viewer for site plans and unit layouts. Everything else lives in inboxes, spreadsheets, and broker heads. The cost of the seat is much higher than the value extracted.

**What we'd build.** A lightweight leasing workspace — not a full VTS replacement — that covers the 20% of functionality Berkeley actually uses, plus the 30% they *should* be using:

- Unit inventory with floor plans + availability, pulled from Yardi as system of record (no double-entry).
- Deal pipeline (prospect → tour → LOI → lease out) with stage timers and auto-nudges.
- AI-drafted tour recaps, LOI summaries, and weekly pipeline digests for regional directors.
- Broker-facing unit sheets generated on demand (PDF + shareable link) from the latest Yardi data.
- Read-only integration with VTS for site plans until we can fully migrate artwork.

**Why we don't just "replace VTS".** Ripping out VTS is a 6-month project. Instead, we put a thin Dehyl layer on top of Yardi, give brokers a better daily workflow, and measure usage. If adoption clears a threshold (say, 70% of active deals tracked in the new workspace after 60 days), Berkeley has the evidence to downgrade or drop VTS seats on the next renewal.

**POC scope (4–6 weeks).**
- 1 region, 1 regional director, 3–5 brokers.
- Yardi read sync for units + leases in scope.
- Deal pipeline + AI recaps + unit sheets.
- Success metric: broker-reported time saved per deal + % of deals logged vs. the control region still on VTS.

### 3.2 Pilot B — Tenant Financial Review Automation

**Pain today.** Berkeley has clear checklists for tenant financial review, but running them across ~1,000 tenants annually (plus renewals, new leases, and watchlist cases) is human-intensive. Analysts spend hours on work that is 80% pattern matching.

**What we'd build.** An agentic financial review pipeline that follows Berkeley's existing checklist verbatim, with a human reviewer as the final approver:

- Document intake — tenant uploads financials to a secure portal (or analyst forwards email) → auto-classified (P&L, balance sheet, tax return, bank stmt).
- Extraction — Claude pulls the line items the checklist requires (revenue, EBITDA, current ratio, DSCR, etc.) with page/line citations.
- Scoring — checklist evaluated mechanically; red/yellow/green flags produced with cited evidence.
- Memo draft — a standardized credit memo generated for the analyst, pre-filled with extracted data and flagged items.
- Reviewer workflow — analyst reviews, edits, approves. Every change is captured for model feedback.
- Archive — final memo + source docs + AI draft history written to an SEC-archivable store.

**Why this is a natural fit.** The checklist already exists. The judgment work is in the flags and the narrative, not the extraction. Automating extraction alone could cut review time 60–70% while *improving* audit trail quality, because every number in the final memo points back to a cited source.

**POC scope (4–6 weeks).**
- 25 real tenants, selected across risk tiers by Berkeley's credit team.
- Berkeley's existing checklist encoded as the evaluation rubric.
- Runs inside Azure — Claude Enterprise, no data leaves Berkeley's environment.
- Success metric: analyst time-per-review before vs. after, plus a blind quality review of 10 memos by a senior credit reviewer.

---

## 4. Architecture & Compliance Posture

- **Runtime.** Claude Enterprise on Azure for both pilots. No data egress outside Berkeley's tenant boundary. Dehyl builds and operates, Berkeley owns the data and the workspace.
- **Identity.** SSO through Berkeley's existing Azure AD. Role-based access mirrors current Yardi / VTS permissions.
- **Integrations.** Yardi read API for both pilots. Juniper Square (optional, Pilot B) for investor-side visibility. Chatham not in scope for the POC.
- **Archiving.** Every AI interaction — prompts, outputs, citations, approver edits — written to an append-only log. Format and retention window to be ratified with Berkeley's compliance lead before launch. This is the SEC-archiving question Bahaar flagged; we want to co-design the answer, not guess.
- **Observability.** Per-tenant usage, cost, and escalation rate surfaced to Berkeley admins (mirrors the LIRE metrics module design — `docs/superpowers/specs/2026-04-03-metrics-module-design.md`).

---

## 5. Engagement Model

| Phase | Duration | Deliverable |
|---|---|---|
| Discovery | 1 week | Shadow 2 brokers + 2 credit analysts. Confirm checklist details and VTS workflows. Lock scope. |
| Build | 3–4 weeks | Both pilots, running against Berkeley data, in staging. |
| Supervised launch | 2 weeks | Pilots live with daily Dehyl engineer on-call. Weekly review with Bahaar + operators. |
| Decision | end of week 7 | Berkeley decides: expand, adjust, or stop. Dehyl delivers a short memo with metrics + recommendations. |

Fixed-fee for the 7-week engagement, scoped once the discovery week lands. No long-term commitment required to start.

---

## 6. Open Questions for Berkeley

These are the items we want Berkeley's input on before we finalize scope:

1. **VTS link + contract detail.** Bahaar to send VTS account link and whatever renewal / seat-count data she can share. This sizes the financial upside of Pilot A.
2. **Financial review process doc.** The full checklist, plus a few anonymized example memos (good and bad), so we encode the rubric correctly.
3. **SEC archiving posture.** Who is the right compliance partner inside Berkeley for us to co-design the archiving spec with?
4. **Yardi API access.** Read-only service account + the property/tenant scope for the pilot region.
5. **Azure environment.** Which Azure subscription / resource group should the POC land in, and what's the approval path for spinning it up?

---

## 7. Relevant Dehyl Precedent

- **Mark Hawkerage — SDR research automation.** Claude + Salesforce integration. SDR research time dropped from ~2 hours/day to an automated pipeline with human review on prioritization. Same human-in-the-loop pattern we'd apply to Pilot B.
- **Alejandro's hospitality agents (Colombia).** 8-agent system running full guest lifecycle for a remote Caribbean property, multi-language concierge. Scaled from 1 to 5 hotels. Shows we can run multi-agent workflows in production against real customers.
- **LIRE-Help.** Our own light-industrial AI ops platform. Oakland Gateway demo (`docs/superpowers/plans/2026-04-02-berkeley-demo-prep.md`) already models Berkeley Partners as the anchor tenant — the property, concierge, compliance and vendor data model map directly onto Berkeley's portfolio.

---

## 8. Next Steps

- [ ] Berkeley sends VTS link + financial review process doc (owner: Bahaar).
- [ ] Dehyl reviews VTS usage data, drafts a tighter Pilot A scope (owner: Alejandro, 5 business days after receipt).
- [ ] 30-min follow-up to confirm pilot scope, compliance partner, and Azure path.
- [ ] Signed statement of work for the 7-week engagement.

---

## Sources

- [VTS — Commercial Real Estate Software](https://www.vts.com/)
- [VTS Announces Launch of Asset Intelligence (AI lease abstraction)](https://www.vts.com/news/assetintelligencelaunch)
- [VTS AI & Data Science Investment Focus](https://www.businesswire.com/news/home/20250310670411/en/VTS-Announces-Accelerated-Investment-Focus-Towards-an-AI-Data-Science-Driven-Property-Operations-and-Leasing-Platform)
- [National CRE Replaces VTS with Salesforce — Fortimize case study](https://fortimize.com/customers/vts-commercial-leasing-salesforce/)
- [VTS Review — ButterflyMX](https://butterflymx.com/blog/vts-review/)
- [VTS Alternatives — Capterra](https://www.capterra.com/p/154799/VTS/)
