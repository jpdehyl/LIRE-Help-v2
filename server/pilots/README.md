# Pilots

Berkeley Partners engagement modules — intentionally separated from core LIRE-Help code so their scope doesn't creep into the product platform.

## Modules

- **`leasing/`** — Pilot A (VTS-lite leasing workspace). Units, deals, tours, unit-sheet generation, AI tour recaps, weekly pipeline digest.
- **`credit/`** — Pilot B (tenant financial review automation). Lessees, document intake, extraction, checklist scoring, memo drafting, analyst review, SEC-archivable log.
- **`tenant-config.ts`** — Loads per-tenant YAML config from `config/tenants/<slug>/`. Berkeley's rubric and memo template live there, not in this directory.

## Ground rules

1. **No hardcoded Berkeley logic.** Tenant-specific rules live in `config/tenants/berkeley/`. If you find yourself writing `if (tenantSlug === "berkeley")`, stop — extend the config schema instead.
2. **Archive everything.** Pilot B mutations must append to `archive_log`. The helper in `credit/routes.ts` (`appendArchive`) computes a SHA-256 of the payload so compliance can verify integrity later.
3. **Feature-gate by tenant.** A tenant without a `config/tenants/<slug>/` directory should get 404s from `/api/pilots/*`. Never leak one tenant's pilot surface to another.
4. **Auth first.** Both routers apply `requireStaff`. Role-gated actions (approvals, archive reads) layer on `requireStaffRole(...)`.

See also:
- `docs/superpowers/specs/2026-04-17-berkeley-pilots-prd.md` — full PRD.
- `docs/clients/berkeley-partners-pilot-success-criteria.md` — scope + go/no-go metrics.
- `config/tenants/berkeley/README.md` — tenant config rules.
