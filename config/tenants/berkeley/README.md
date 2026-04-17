# Berkeley Partners — Tenant Config

Berkeley-specific configuration that must not be hardcoded into core modules.
Everything in this directory is consumed by the pilots at runtime and is
versioned so historical runs remain reproducible.

## Files

| File | Purpose | Owner |
|---|---|---|
| `credit-checklist.yaml` | Rubric for Pilot B checklist evaluation (Berkeley's financial review process, encoded). | Berkeley credit team + Dehyl |
| `memo-template.md` | Canonical credit memo format Claude drafts into for Pilot B. | Berkeley credit team |
| `leasing.yaml` | Pilot A defaults — pipeline stage names, digest cadence, unit-sheet fields. | Berkeley regional leasing + Dehyl |

## Editing rules

1. **Never hardcode Berkeley logic in `server/` or `shared/`.** It belongs here.
2. **Version on every change.** The `credit_checklist_runs.rubric_version` column records which version was used; if you edit the file without bumping the version, historical runs become unreproducible.
3. **PR review required.** Changes to `credit-checklist.yaml` or `memo-template.md` must be reviewed by Berkeley compliance before merge.

## Scope

This directory is the pattern for onboarding future tenants. When we add a
second SaaS tenant, their config lives in `config/tenants/<slug>/` with the
same file set. Modules read `config/tenants/${tenant.slug}/…` at runtime.
