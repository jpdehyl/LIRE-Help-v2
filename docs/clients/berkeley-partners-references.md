# Dehyl — Production Reference Sheet

**Prepared for:** Berkeley Partners
**Date:** 2026-04-17
**Purpose:** Two in-production Dehyl deployments that map directly onto the Berkeley pilots. Forwardable inside Berkeley.

> **Note on metrics:** Figures marked *(to confirm)* are pending sign-off from the referenced customer. Alejandro will update this doc with confirmed numbers before Bahaar forwards it.

---

## Reference 1 — Mark Hawkerage · SDR Research & Lead Scoring Automation

**Why this matters to Berkeley.** Same human-in-the-loop pattern we'd apply to Pilot B (tenant financial review). Agent does the pattern-matching work, human owns the judgment call, every output is auditable.

**What we built.**
- Salesforce-integrated lead scoring pipeline.
- Per-lead research agent: company firmographics, recent news, signal extraction, fit score.
- Prioritized daily queue delivered to SDRs; rejected leads auto-returned with reasons.
- Feedback loop — SDR accept/reject decisions tune the scoring model.

**Impact (to confirm with Mark).**
- SDR research time: **~2 hours/day → automated**, freeing SDRs for outbound.
- Lead throughput: *(to confirm)*
- Win-rate delta on prioritized vs. unprioritized leads: *(to confirm)*

**Architecture parallels for Berkeley.**
| SDR use case | Berkeley Pilot B equivalent |
|---|---|
| Scrape + normalize lead data | Extract line items from tenant financials |
| Score against ICP rubric | Evaluate against Berkeley's credit checklist |
| Surface red flags with citations | Surface credit flags with page/line citations |
| SDR approves outreach list | Analyst approves credit memo |
| All decisions logged to Salesforce | All decisions logged to SEC-archivable store |

**Reference contact.** Mark Hawkerage — intro available on request.

---

## Reference 2 — Hospitality Agents, Colombia (Alejandro-led)

**Why this matters to Berkeley.** Proves Dehyl can run a multi-agent system in production, in a compliance-sensitive environment (hospitality / travel), across multiple properties, 24/7. Same production discipline we'd bring to the Oakland Gateway concierge pattern at Berkeley scale.

**What we built.**
- 8-agent system covering the full guest lifecycle: pre-arrival, check-in, in-stay concierge, maintenance, local recommendations, upsells, check-out, post-stay feedback.
- Multi-language concierge (ES/EN, with dialect-specific tuning).
- First deployment: remote Caribbean cabin property (no on-site staff most days — agents carry the operation).

**Impact.**
- **Scaled from 1 property → 5 hotels** within the first year.
- Guest-facing coverage: **24/7, multi-language**, zero dropped conversations.
- Operator time on routine guest questions: *(to confirm, Alejandro)*
- Guest satisfaction delta vs. pre-agent baseline: *(to confirm, Alejandro)*

**Architecture parallels for Berkeley.**
| Hospitality use case | Berkeley Pilot A equivalent |
|---|---|
| Pre-arrival agent (prep, instructions) | Prospect agent (tour prep, unit sheet generation) |
| In-stay concierge (FAQs, requests) | Tenant concierge (dock scheduling, maintenance) |
| Maintenance triage + vendor dispatch | Same — already modeled in Oakland Gateway demo |
| Multi-property admin dashboard | Berkeley regional/portfolio dashboard |

**Reference contact.** Alejandro Dominguez (Dehyl) — direct; customer reference available on request.

---

## Common Thread

Both deployments share the exact pattern Bahaar needs:

1. **Narrow, shipped POC** before any long-term commitment.
2. **Human-in-the-loop on high-stakes decisions** — agents surface, humans approve.
3. **Production for real customers**, not demos.
4. **Structured output + citations**, so every AI action can be audited.
5. **Iterative expansion** only after a metric crosses a pre-agreed threshold.

That's the operating pattern Dehyl will bring to Berkeley. The full engagement model is in `docs/clients/berkeley-partners-proposal.md`.
