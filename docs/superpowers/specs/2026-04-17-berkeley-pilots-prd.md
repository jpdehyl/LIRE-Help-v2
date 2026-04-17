# Berkeley Partners Pilots — Product Requirements Document

**Date:** 2026-04-17
**Status:** Draft — pre-discovery
**Author:** Alejandro Dominguez / Claude
**Stack:** Express/Node + React/Vite + Drizzle ORM + PostgreSQL (Railway for staging, Azure for Berkeley runtime) + Claude Enterprise via Anthropic SDK
**Companion docs:**
- Proposal: `docs/clients/berkeley-partners-proposal.md`
- Success criteria: `docs/clients/berkeley-partners-pilot-success-criteria.md`
- LIRE master plan: `MASTER-PLAN.md`

---

## 1. Overview

Build two production pilots for Berkeley Partners, running end-to-end against real Berkeley data within a Berkeley-owned Azure environment, delivered inside a 7-week engagement.

**Pilot A — VTS-Lite Leasing Workspace.** A lightweight leasing + deal management surface layered on top of Yardi as system of record. Covers the 20% of VTS functionality Berkeley brokers actually use plus the 30% they should be using (AI recaps, pipeline digests, generated unit sheets).

**Pilot B — Tenant Financial Review Automation.** An agentic pipeline that ingests tenant financial documents, runs Berkeley's existing credit checklist, produces a pre-filled credit memo with citations, and hands it to an analyst for review. Every step is logged to an SEC-archivable store.

### Goals

- Ship both pilots live to real Berkeley users within 6 weeks of kickoff.
- Hit the go/no-go thresholds in `docs/clients/berkeley-partners-pilot-success-criteria.md`.
- Establish Dehyl as Berkeley's preferred AI partner for subsequent rollouts.

### Non-goals (explicit)

- Not replacing VTS, Yardi, Juniper Square, or Chatham.
- Not making autonomous credit decisions.
- Not building a generic CRE platform — this is Berkeley-shaped by design.
- Not shipping Pilot A outside the chosen single region during the 7-week window.

---

## 2. Users & Primary Jobs

| User | Pilot | Primary job the software does for them |
|---|---|---|
| Regional Director | A | "Show me what's happening in my deal pipeline without opening VTS or chasing brokers." |
| Broker / Leasing Agent | A | "Help me prep for a tour, follow up after, and generate a unit sheet in under a minute." |
| Credit Analyst | B | "Turn a tenant's financial PDF dump into a reviewable memo I can edit and approve." |
| Senior Credit Reviewer | B | "Audit the analyst's decisions without re-reading raw PDFs." |
| Compliance Lead | A + B | "Prove to the SEC that every AI-generated artifact is captured, traceable, and retained correctly." |
| Berkeley IT / Platform | A + B | "Run this inside our Azure tenant, under our SSO, with no surprise data egress." |

---

## 3. Functional Requirements

### 3.1 Pilot A — VTS-Lite Leasing Workspace

#### A-F1. Yardi read sync
- Read-only integration with Berkeley's Yardi instance.
- Entities synced: properties, units, leases, tenants, availability, floor plan references.
- Sync cadence: every 15 min for active pilot region; full refresh nightly.
- Conflict model: Yardi wins — Dehyl workspace never writes back during the pilot.

#### A-F2. Unit inventory view
- Grid and list modes; filter by availability, size range, clear height, power, dock type.
- Per-unit detail page with floor plan (embedded from VTS or uploaded to Dehyl), amenities, asking rate, notes.
- "Vacant, market-ready" shortcut view for brokers.

#### A-F3. Deal pipeline
- Stages: Prospect → Tour Scheduled → Tour Complete → LOI → Lease Negotiation → Lease Signed → Lost.
- Each deal has: prospect company, broker, assigned unit(s), size needed, expected move-in, notes, timeline.
- Stage timers — auto-highlight deals stuck in a stage beyond N days.
- Activity log per deal (AI-generated + human-entered).

#### A-F4. AI tour recap
- Broker clicks "New recap" after a tour, dictates or types 3–5 bullets.
- Claude drafts a structured recap: prospect needs, unit fit, next steps, open questions.
- Attached to the deal automatically. Broker edits + saves in ≤ 30 seconds.

#### A-F5. Weekly pipeline digest
- Every Monday 7am local time, regional director receives an email:
  - Deals advanced, deals stuck, new prospects, lost deals.
  - Narrative summary (Claude-generated) with cited deal IDs.
  - Link back to workspace for any drill-down.

#### A-F6. Unit sheet generator
- Broker clicks "Generate unit sheet" on any unit.
- Output: PDF + shareable web link, auto-refreshed with latest Yardi data.
- Contents: hero image/floor plan, specs, asking rate, broker contact, property amenities.

#### A-F7. VTS site-plan read embed
- For units whose site plan lives in VTS, embed the VTS viewer inline.
- No write-back. Marked as "external source: VTS" in the UI.

### 3.2 Pilot B — Tenant Financial Review Automation

#### B-F1. Document intake
- Secure upload portal, SSO-gated, Berkeley users only.
- Email-forward adapter: analyst forwards tenant docs to a Berkeley-routed inbox → auto-ingested.
- Each upload tagged to a tenant ID from Yardi.

#### B-F2. Document classification
- Auto-classify incoming docs: P&L, Balance Sheet, Tax Return, Bank Statement, Rent Roll, Other.
- Confidence score shown; < 0.85 triggers analyst confirmation before extraction.

#### B-F3. Line-item extraction
- Claude extracts the specific line items required by Berkeley's checklist.
- Every extracted value carries: source doc ID, page, region coordinates, raw text excerpt.
- Extractions are **cited** — analyst can click a value and jump to the source.

#### B-F4. Checklist scoring
- Berkeley's existing checklist encoded as a rubric (YAML or JSON config, versioned in repo).
- Each checklist item evaluated against extracted data. Output: pass / flag-yellow / flag-red + reasoning + citations.
- Rubric updates are diff-visible and change-logged.

#### B-F5. Credit memo draft
- Generates a pre-filled memo in Berkeley's standard format.
- Sections: tenant summary, financial highlights, flagged items, recommendation (defaults to "analyst review required").
- Every number in the memo is a citation link back to the source doc.

#### B-F6. Analyst review UI
- Side-by-side view: memo on left, source docs on right, citation links jump to exact page/region.
- Analyst edits inline; edits are tracked as deltas against the AI draft.
- Actions: Approve, Request Revision (with comment), Reject (with reason).

#### B-F7. Archive log
- Append-only store: every prompt, every AI output, every analyst edit, every approval, every source doc hash.
- Queryable by tenant ID, date range, analyst.
- Export: one-click tenant packet (memo + source docs + AI draft history + approval chain).
- Retention window and access control per Berkeley compliance (finalized week 2).

#### B-F8. Senior reviewer spot-check
- Random 10% sample queue for senior credit reviewer.
- Blind scoring (1–5) for memo usefulness.
- Scores feed the go/no-go metric in the success criteria doc.

### 3.3 Shared requirements

#### S-F1. Auth & access
- SSO via Berkeley Azure AD.
- Role model: Admin, Regional Director, Broker, Analyst, Senior Reviewer, Compliance, Read-only.
- Role assignments visible to Berkeley IT; revocable in under 5 minutes.

#### S-F2. Observability
- Per-user, per-tenant usage + token cost surfaced in an admin panel.
  - Reuse the design from `docs/superpowers/specs/2026-04-03-metrics-module-design.md`.
- Error rate, latency, escalation rate (Pilot B: % memos needing revision).

#### S-F3. Feedback loop
- Every Claude output has 👍 / 👎 + optional comment.
- Low-scoring outputs feed into a weekly prompt-tuning cycle (owner: Dehyl).

---

## 4. Data Model (high level)

New or extended tables on top of the existing LIRE schema (`shared/schema.ts`):

### Pilot A
- `deals` — pipeline items, referencing `properties` + `units` + `staff_users`.
- `deal_events` — activity log, including AI recap entries.
- `tours` — scheduled/completed tours, with AI recap content.
- `unit_sheets` — generated PDF metadata + shareable token.

### Pilot B
- `tenants_financial` — Berkeley-side tenant record (joins to Yardi tenant ID).
- `documents` — uploaded source docs with hash, classification, confidence.
- `extractions` — line-item values with citations (doc_id, page, bbox).
- `checklist_runs` — one row per (tenant, review cycle), referencing a rubric version.
- `memo_drafts` — AI-generated memos, versioned; analyst edits tracked as deltas.
- `approvals` — analyst action rows (approve / revise / reject + reason).
- `archive_log` — append-only event stream.

### Shared
- Extend `tenants` (the LIRE tenancy concept) with `berkeley_partners` as the production tenant.
- Extend `staff_users` with Berkeley roles + Azure AD object ID.

Drizzle migrations follow the pattern in existing `scripts/` and are pushed via `npx drizzle-kit push` from a Berkeley-Azure-hosted runner (not Railway).

---

## 5. Architecture

```
Azure (Berkeley subscription)
├── App service — Node/Express API + React SPA (Dehyl codebase)
├── PostgreSQL — pilot workspace DB (mirrors LIRE schema, Berkeley-tenanted)
├── Blob storage — uploaded source docs (Pilot B) + generated PDFs (Pilot A)
├── Claude Enterprise endpoint (via Anthropic on Azure)
├── Key Vault — secrets, Yardi API creds, Azure AD app registration
└── Archive store — append-only (choice between Azure Table Storage + Blob versioned container)

Integrations
├── Yardi read API (polling, 15 min)
├── VTS read embed (iframe + token)
└── Azure AD (SSO / RBAC)
```

**Environments.**
- `dev` — Dehyl-owned Railway stack, synthetic data (extension of current LIRE-Help demo).
- `staging` — Berkeley Azure, anonymized subset of real data.
- `prod` — Berkeley Azure, full pilot scope.

**Data boundary.** No tenant data leaves Berkeley's Azure subscription. Dehyl engineers access via Berkeley-issued accounts with audit logging.

---

## 6. Build Plan (7 weeks)

| Week | Pilot A | Pilot B | Shared |
|---|---|---|---|
| 0 (pre-kickoff) | VTS link review, scope lock | Checklist + sample memos review | Signed SOW |
| 1 — Discovery | Shadow 2 brokers; lock entity model | Shadow 2 analysts; encode checklist v1 | Azure provisioning kicked off; compliance partner named |
| 2 | Yardi read sync (A-F1), unit inventory (A-F2) scaffold | Document intake (B-F1), classification (B-F2) | SSO wiring; archive spec ratified |
| 3 | Deal pipeline (A-F3); seed test deals | Line-item extractor (B-F3) v1 | Admin panel + metrics hookup |
| 4 | AI tour recap (A-F4); weekly digest (A-F5) | Checklist scoring (B-F4); memo draft (B-F5) v1 | Feedback loop plumbing |
| 5 | Unit sheet generator (A-F6); VTS embed (A-F7) | Analyst review UI (B-F6) | End-to-end smoke test, both pilots |
| 6 — Supervised launch | Brokers live; daily Dehyl standup | Analysts live on 25-tenant sample; daily standup | Archive log fully enforced; senior reviewer queue live |
| 7 — Review | Metrics vs. success criteria; go/no-go memo | Same | Post-mortem + expansion proposal |

---

## 7. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Yardi API access delayed | Medium | Breaks Pilot A timeline | Stand up a read-sync stub against anonymized export week 1; swap to live API when ready. |
| SEC archiving spec gets pushed to the end | Medium | Blocks Pilot B go-live | Name compliance partner week 1; deliverable B-F7 is locked to week 2 spec review. |
| Broker adoption < 70% despite good UX | Medium | Pilot A fails go/no-go | Weekly in-person (or video) time with brokers; iterate UI twice minimum before week 6. |
| Checklist encoding doesn't match analyst judgment | High | Pilot B memos get rejected | Run shadow mode for 5 tenants week 3 — analyst sees AI output but is not asked to act on it; iterate before week 4 full run. |
| Claude extraction accuracy below target on messy tenant PDFs | Medium | Pilot B metric miss | Pre-OCR normalization layer; add ensemble with structured-output tool use; fall back to analyst-confirm at low confidence. |
| Scope creep from Berkeley stakeholders outside pilot | High | Schedule slip | Every new ask routed through Bahaar as product owner; out-of-scope items land in a "Phase 2 candidates" doc, not the pilot. |

---

## 8. Open Questions

1. Which single region does Pilot A run in? (blocks A-F1 scoping)
2. Which Azure subscription and resource group? (blocks week 1 provisioning)
3. Who is Berkeley's compliance partner for archive-spec co-design?
4. Can Yardi API creds be issued with a property/tenant scope filter, or is it whole-portfolio access? (affects data minimization posture)
5. Are any of the 25 Pilot B tenants subject to tighter confidentiality that would pull them out of sample?
6. Does Berkeley have a standard credit memo template we should format against, or do we propose one?
7. How does Berkeley want to handle tenants whose financials arrive in non-English languages? (Alejandro has Spanish-language precedent from Colombia.)

---

## 9. Acceptance

This PRD is accepted when:

- Bahaar has green-lit scope in `docs/clients/berkeley-partners-pilot-success-criteria.md`.
- Berkeley IT has provisioned the Azure environment and Yardi read creds.
- Compliance partner has signed off on the archive spec.
- A signed SOW references this PRD as the scope exhibit.

Until acceptance, this document is a draft — expect changes with each Berkeley review.
