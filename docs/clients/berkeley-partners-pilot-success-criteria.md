# Berkeley Partners — Pilot Success Criteria (Pre-filled)

**Prepared for:** Bahaar (Senior Manager, Berkeley Partners)
**Prepared by:** Alejandro Dominguez — Dehyl SAS
**Date:** 2026-04-17
**Status:** Pre-fill — intended to be reviewed and ratified with Berkeley on the next call.

> **How to use this doc.** Everything below is Dehyl's proposed cut. Green-check the lines you agree with, red-line the ones you want to change. Anything still open after one 30-minute review becomes a named owner + date. The goal is that after the call, this doc is the statement-of-work exhibit for the pilot.

---

## Pilot A — VTS-Lite Leasing Workspace

### A.1 Scope (proposed)

- **Region:** 1 Berkeley region (Bahaar to pick — suggest one where VTS seat count is highest).
- **Users:** 1 regional director + 3–5 brokers.
- **Assets in scope:** All units within the selected region, read-synced from Yardi.
- **VTS interaction:** Read-only — we do not write back to VTS during the pilot.

### A.2 Deliverables

| # | Deliverable | Owner | Ready by |
|---|---|---|---|
| 1 | Unit inventory view with floor plans + availability (Yardi-synced) | Dehyl | Week 3 |
| 2 | Deal pipeline (prospect → tour → LOI → lease out) | Dehyl | Week 3 |
| 3 | AI-drafted tour recap after each tour | Dehyl | Week 4 |
| 4 | Weekly pipeline digest email to regional director | Dehyl | Week 4 |
| 5 | Broker unit-sheet PDF generator (on-demand) | Dehyl | Week 5 |
| 6 | Read-only VTS site-plan embed | Dehyl | Week 5 |

### A.3 Success metrics

| Metric | Baseline (measured week 0) | Target (end of week 7) | How measured |
|---|---|---|---|
| % of active deals logged in Dehyl workspace | 0% | ≥ 70% | Audit of deals in pipeline |
| Broker-reported time saved per deal | 0 min | ≥ 30 min | Weekly 1-question survey |
| Tour recap turnaround | Self-reported baseline | Same-day for ≥ 80% of tours | Timestamp audit |
| Regional director reads weekly digest | N/A | ≥ 5 of 7 weeks | Email open log |
| Control-region VTS deal-logging rate | Record week 0 | Unchanged | VTS admin report |

**Go / no-go rule.** If Dehyl workspace deal-logging ≥ 70% *and* broker time-saved ≥ 30 min/deal, Berkeley commits to a 2-region expansion and a VTS seat-reduction study at the next VTS renewal. If not, the pilot stops and Dehyl delivers a written post-mortem at no additional cost.

### A.4 Non-goals (explicit)

- We are **not** replacing VTS as system of record during the pilot.
- We are **not** rebuilding VTS's full deal-management surface area. Only the 20% brokers use + the 30% they should.
- We are **not** writing to Yardi. Read-only.

---

## Pilot B — Tenant Financial Review Automation

### B.1 Scope (proposed)

- **Tenant sample:** 25 real Berkeley tenants, selected by Berkeley's credit team across risk tiers (suggest: 10 green, 10 yellow, 5 watchlist).
- **Checklist:** Berkeley's existing tenant financial review checklist, encoded verbatim as the evaluation rubric.
- **Runtime environment:** Azure, Berkeley tenant boundary, Claude Enterprise. No data egress.

### B.2 Deliverables

| # | Deliverable | Owner | Ready by |
|---|---|---|---|
| 1 | Secure document intake portal (or email-forward adapter) | Dehyl | Week 2 |
| 2 | Auto-classification of uploaded docs (P&L, BS, tax, bank stmt) | Dehyl | Week 3 |
| 3 | Line-item extractor with page/line citations | Dehyl | Week 4 |
| 4 | Mechanical scoring against Berkeley's checklist | Dehyl | Week 4 |
| 5 | Pre-filled credit memo draft in Berkeley's standard format | Dehyl | Week 5 |
| 6 | Analyst review UI (edit / approve / reject, edits captured) | Dehyl | Week 5 |
| 7 | SEC-archivable log for every prompt / output / edit / approval | Dehyl + Berkeley compliance | Week 6 |

### B.3 Success metrics

| Metric | Baseline | Target | How measured |
|---|---|---|---|
| Analyst time per review | Berkeley-reported current avg | ≥ 60% reduction | Timestamp in review UI |
| Extraction accuracy (cited line items) | N/A | ≥ 95% exact-match on 25 samples | Blind audit by senior analyst |
| Flag precision (red flags that survive analyst review) | N/A | ≥ 90% | Blind audit |
| Memo usefulness (senior reviewer 1–5 score) | N/A | ≥ 4.0 average across 10 blind-reviewed memos | Blind review |
| Audit trail completeness | N/A | 100% of final memos trace to source docs | Compliance spot-check |

**Go / no-go rule.** If analyst time drops ≥ 60% *and* senior reviewer score ≥ 4.0 *and* compliance signs off on the archive log, Berkeley commits to expansion toward the full ~1,000-tenant population on a phased rollout. Otherwise, pilot stops with a written post-mortem.

### B.4 Non-goals (explicit)

- We are **not** making credit decisions autonomously. Every memo is analyst-approved.
- We are **not** replacing any existing Berkeley tool (Yardi, Juniper Square, Chatham) during the pilot.
- We are **not** ingesting tenant data outside Berkeley's Azure tenant boundary.

---

## Shared / Cross-Pilot Criteria

### C.1 Compliance

- [ ] Berkeley names a compliance partner within week 1 (proposed: Bahaar introduces).
- [ ] Archive spec (format, retention, access control) ratified with compliance partner by end of week 2.
- [ ] Archive log implementation signed off before Pilot B goes live.

### C.2 Security

- [ ] SSO via Berkeley Azure AD.
- [ ] All runtime inside Berkeley's Azure subscription.
- [ ] No PII or proprietary financial data touches a non-enterprise endpoint.
- [ ] Dehyl engineers access via Berkeley-issued accounts, revocable on day one of end of pilot.

### C.3 Commercial

- [ ] Fixed fee for the 7-week engagement, scoped after discovery week.
- [ ] No multi-year commitment required to start.
- [ ] IP: Berkeley owns configuration, data, and workspace state. Dehyl retains reusable framework code.

---

## Open Items (need Berkeley input before week 1 kickoff)

| # | Item | Owner | Due |
|---|---|---|---|
| 1 | VTS contract + seat count + renewal date | Bahaar | Before kickoff |
| 2 | Financial review process doc + 3 anonymized sample memos | Berkeley credit team | Before kickoff |
| 3 | Named compliance partner | Bahaar | Week 1 |
| 4 | Yardi read-API service account + property scope | Berkeley IT | Week 1 |
| 5 | Azure subscription / resource group for POC | Berkeley IT | Week 1 |
| 6 | Pilot A region choice | Bahaar | Kickoff |
| 7 | Pilot B tenant sample (25) | Berkeley credit team | Week 1 |

---

## Signatures

When both parties are comfortable with this document, it becomes the pilot exhibit to the engagement letter.

**Berkeley Partners** ______________________ Date __________

**Dehyl SAS** ______________________ Date __________
