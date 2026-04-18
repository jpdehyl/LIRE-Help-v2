# LIRE Help v2 — Phase 2 Execution Plan

**Goal:** Make the app dogfoodable for real tenants (Berkeley first). Clear Phase A hardening blockers before touching Phase B/C/D product depth.

**Architecture:** Extend the existing Express + Drizzle + React/Vite codebase. No new runtime. Tenant scope threaded through `sess.staffTenantId` and, where applicable, `sess.staffPropertyId`. Tests hit a real Postgres (`*_test` DB) via `tests/helpers/{seed,request}`.

**Tech Stack:** Node 20, Express, Drizzle ORM (`drizzle-orm`), Postgres, React 18 + Wouter, TanStack Query, Vite, Vitest + Supertest, bcrypt, express-session + connect-pg-simple.

**Branch:** `hardening/dogfooding-phase-2` (already checked out). No direct commits to `main`.

**Commands (package.json actual names):**
- `npm run check` — tsc --noEmit  (the user's "typecheck" maps to this)
- `npm run build`
- `npm test` — vitest (uses `.env.test`, expects DB whose URL path ends in `_test`)

---

## Current state (do not re-discover)

- [client/src/App.tsx](../../../client/src/App.tsx) — auth-gated routes live for `/dashboard`, `/inbox`, `/inbox/:viewId`, `/tickets`, `/customers`, `/settings`, `/leasing`, `/credit-review`, `/platform-dashboard`.
- [client/src/pages/inbox.tsx](../../../client/src/pages/inbox.tsx) — 86 lines, coerces invalid `:viewId` at [L16-L21](../../../client/src/pages/inbox.tsx#L16-L21), passes `propertyId` through URL, backed by real `helpdeskApi`.
- [client/src/components/inbox/](../../../client/src/components/inbox/) — `inbox-shell.tsx`, `inbox-sidebar.tsx`, `conversation-list.tsx`, `conversation-detail.tsx`, `types.ts`, `mock-data.ts`.
- [server/storage.ts](../../../server/storage.ts) (1056 lines) — has `ensureHelpdeskBootstrap` (line 400) called from `loadHelpdeskContext` (line 602). Demo-seed in read path.
- [server/platform/azure-ad.ts:127-138](../../../server/platform/azure-ad.ts#L127-L138) — id_token validated for iss/aud/exp/tid but **signature not verified**.
- [server.ts:44-63](../../../server.ts#L44-L63) — CORS allows `*.replit.dev` / `*.replit.app` unconditionally.
- [server.ts:198-210](../../../server.ts#L198-L210) — `buildSystemPrompt` calls `getPlatformKnowledge()` with no tenant filter.
- [shared/schema.ts:102-110](../../../shared/schema.ts#L102-L110) — `platform_knowledge` has no `tenant_id` column.
- [tests/helpers/request.ts:2](../../../tests/helpers/request.ts#L2) imports `../../server/app-factory.js` — **this file does not exist**. Test infra gap: `buildApp()` must be added before any supertest file runs.
- [server/middleware/auth.ts](../../../server/middleware/auth.ts) — `requireAdmin`, `requireStaffRole(...roles)`, `requireStaff`.
- [docs/superpowers/plans/2026-04-17-dogfooding-hardening.md](./2026-04-17-dogfooding-hardening.md) — prior deep plan (2930 lines) with step-by-step code/tests for most Phase A blockers. Reuse, don't duplicate.
- [docs/superpowers/specs/2026-04-17-berkeley-pilots-prd.md](../specs/2026-04-17-berkeley-pilots-prd.md) — Berkeley PRD.

## Non-negotiables

- No detached prototypes, CDN React, Babel-in-browser, `/design/*.jsx`, fake auth, or localStorage-as-app-state.
- No force push, no history rewrite, no `--no-verify`.
- No file > ~300 lines without an extraction plan.
- No parallel ticketing domain. Extend existing help* tables.
- No mocked DB in tests. Hit Postgres via `tests/helpers/seed`.

---

## Phase A — Dogfooding blockers (gate real-tenant onboarding)

Each blocker commits independently with its regression test. The existing 2026-04-17 plan has the full step-by-step; this section is the index of what to deliver and where.

### A.0 — Test infrastructure: `server/app-factory.ts`

`tests/helpers/request.ts` already imports `buildApp` but the factory doesn't exist yet. Without it no supertest file runs, so this is a prerequisite to every subsequent A-task test.

- Create: `server/app-factory.ts` — exports `async function buildApp(): Promise<express.Express>` that wires the same middleware + routes as `server.ts` but returns the app (no `listen`). Share a helper between `server.ts` and `app-factory.ts` if needed.
- Verify: `tests/helpers/request.ts` type-checks; `npm test` produces no "module not found" errors.
- Commit: `test: add server/app-factory.ts for supertest`

### A.1 — Tenant-scope `platform_knowledge` + `/api/chat`

- Modify: `shared/schema.ts` — add `tenantId: varchar("tenant_id").references(() => tenants.id).notNull()` to `platformKnowledge`, plus index on `tenant_id`.
- Create: `scripts/2026-04-18-tenant-scope-platform-knowledge.sql` (or run via `db:push`) — add `tenant_id`, backfill existing rows to a `system` tenant slug, set NOT NULL, index.
- Modify: `server/storage.ts` — `getPlatformKnowledge(tenantId)`, `createPlatformKnowledge({ tenantId, … })`, `updatePlatformKnowledge(id, tenantId, …)`, `deletePlatformKnowledge(id, tenantId)`, `reorderPlatformKnowledge(id, direction, tenantId)` — all filter by `tenantId`.
- Modify: `server/knowledge-routes.ts` — pull `tenantId` from `req.session.staffTenantId`; 403 if unset.
- Modify: `server.ts` — in `buildSystemPrompt(req)`: resolve tenant from Host header (or pass explicitly from `/api/chat` handler), pass to `getPlatformKnowledge`. No tenant → no KB (not cross-tenant fallback).
- Modify: `scripts/seed-demo.ts` — scope demo KB inserts to a tenant.
- Test: `tests/knowledge.test.ts` — owner of tenant A cannot read or write tenant B's KB; unauthenticated request → 401; superadmin path preserved.
- Commit: `fix(B10): tenant-scope platform_knowledge + chat`

Details: see 2026-04-17 plan Task 8 ([L1015-L1302](./2026-04-17-dogfooding-hardening.md#L1015)).

### A.2 — Remove `ensureHelpdeskBootstrap` from the read path

Polluting any new tenant on first inbox load is disqualifying for dogfooding.

- Modify: `server/storage.ts` — delete the `await ensureHelpdeskBootstrap(scope);` call in `loadHelpdeskContext` (line 602). Rename/export `ensureHelpdeskBootstrap` as `seedDemoHelpdesk(scope)` from a new `scripts/seed-demo-helpdesk.ts` and drop the export from `storage.ts`'s call graph entirely. Alternatively, keep inline but never invoked from the read path.
- Modify: `scripts/seed-demo.ts` — invoke `seedDemoHelpdesk(scope)` explicitly behind the existing env guard.
- Test: `tests/helpdesk-bootstrap.test.ts` — seed a fresh tenant with zero help_* rows, hit `/api/helpdesk/inbox/navigation` as an authenticated staff user, expect success + empty views (no mock conversations written). Count `help_conversations` rows = 0 after the read.
- Commit: `fix(H2): remove demo seed from helpdesk read path`

Details: see 2026-04-17 plan L1684+.

### A.3 — Azure id_token JWKS signature verification

Today `decodeIdToken` base64-decodes and trusts the payload. Required: fetch `https://login.microsoftonline.com/{tenantId}/discovery/v2.0/keys`, verify RS256 signature against the matching `kid`.

- Modify: `server/platform/azure-ad.ts` — add `verifyIdToken(idToken, cfg)` using Node's `crypto.verify` with an RSA public key built from the JWKS `n`/`e` (no new deps — JWKS is plain JSON, `crypto.createPublicKey({ key: { kty, n, e }, format: "jwk" })` is stdlib). Cache JWKS per-`tenantId` with a TTL (≤ 1h). Call before `validateIdTokenClaims` in `handleAzureAdCallback`.
- Modify: the pre-existing `NOTE:` at [azure-ad.ts:127-130](../../../server/platform/azure-ad.ts#L127-L130) — remove once implemented.
- Test: `tests/azure-ad.test.ts` — unit-level: construct a signed id_token with a local RSA keypair, inject a fake JWKS fetcher, assert: valid sig passes, wrong `kid` → error, mutated payload → error, expired → error. (Do **not** hit Microsoft from CI.)
- Commit: `fix(A3): verify Azure id_token JWKS signature`

### A.4 — Staff-routes role gating audit

Quick audit of every route module; confirm each staff-only route is wrapped.

- Audit: `server/agents-routes.ts` (already gated ✓), `server/staff-routes.ts` (list endpoint currently uses `requireStaff` with role branching — tighten to `requireStaffRole("superadmin","owner","manager")` for read, `requireStaffRole("superadmin","owner")` for write), `server/knowledge-routes.ts` (✓ `requireAdmin`), `server/helpdesk-routes.ts` (uses `requireStaff` — mutations should be `requireStaffRole("superadmin","owner","manager","staff")`, not `readonly`), `server/platform-sessions-routes.ts`, `server/properties-routes.ts`, `server/metrics-routes.ts`, `server/pilots/leasing/routes.ts`, `server/pilots/credit/routes.ts`.
- Modify: any unguarded mutation handler.
- Test: `tests/staff-routes-role-gating.test.ts` — for each mutation route, readonly role → 403.
- Commit: `fix(A4): enforce role gates on staff-only routes`

### A.5 — Helpdesk `propertyId` scoping

The server already applies `propertyId` filter at `server/storage.ts:743-745`, but it trusts whatever `?propertyId=` the client passes. Cross-tenant leak is blocked by the session `tenantId`, but within a tenant a user could scope to a property they don't belong to. If `sess.staffPropertyId` is set, reject any `filterPropertyId` not equal to it.

- Modify: `server/helpdesk-routes.ts` — validate: if `sess.staffPropertyId` is set and `filterPropertyId` differs → 403.
- Modify: `server/storage.ts` — `getHelpInboxConversations`/`getHelpdeskDashboardMetrics` continue to apply the filter; add a defensive assertion that `filterPropertyId`, when present, exists in the tenant's properties list (cheap lookup).
- Test: `tests/helpdesk-property-scoping.test.ts` — staff bound to property X requesting `?propertyId=Y` → 403; staff without property scope sees all within tenant; staff with property scope omitting filter sees only their property.
- Commit: `fix(A5): enforce property-scope on helpdesk queries`

### A.6 — Production CORS

Remove the Replit allowance in prod builds; keep dev-friendly in dev.

- Modify: `server.ts:44-63` — gate `*.replit.dev` and `*.replit.app` behind `if (isDev)`. Production allows only `*.lire-help.com` and any host listed in `CORS_ALLOWED_HOSTS` env (comma-separated).
- Test: `tests/cors.test.ts` — with `NODE_ENV=production`, Origin `https://foo.replit.dev` does NOT echo back; Origin `https://berkeley.lire-help.com` does.
- Commit: `fix(A6): remove replit.dev CORS allowance in production`

### Phase A verification

```bash
npm run check && npm run build && npm test
```

All six A-blockers green before starting Phase B.

---

## Phase B — Inbox depth (real workspace, not shell theater)

Shell exists. What's thin:

- **Left pane (`inbox-sidebar.tsx`)** — ensure `unassigned`, `awaiting_reply`, `sla_at_risk`, `closed_recently` views render with live counts from `getHelpInboxNavigation`. `all`, `assigned` preserved. Team-inbox groups (`support`, `escalations`, `billing`, `vip`) and saved views (`high_priority`, `bugs`, `renewals`) scaffolded.
- **Middle pane (`conversation-list.tsx`)** — each row: unread dot, status pill, priority chip, assignee avatar, SLA state chip (`on_track` / `at_risk` / `breached` / `resolved`), first-line preview, relative timestamp.
- **Right pane (`conversation-detail.tsx`)** — conversation timeline (messages + internal notes interleaved by `createdAt`), composer (public reply vs internal note toggle), summary/context rail (customer tier, company, health, linked ticket #, SLA clocks), action row (assign to teammate, change status, change priority).
- **Safety invariants preserved** — invalid `?conversation=<bogus>` doesn't crash (detail query returns null → show "conversation not found" panel); invalid `:viewId` coerced at [inbox.tsx:16-21](../../../client/src/pages/inbox.tsx#L16-L21).

**File-size policy:** any file crossing ~300 lines → extract. Candidates: `conversation-detail.tsx`, `inbox-shell.tsx`.

**Commit rhythm:** one commit per pane (left / middle / right / safety tests). Hit typecheck + build + test at phase end.

---

## Phase C — Operational primitives

- **Ticket summary attached to conversation** — `helpTickets` row already joined in `buildConversationRows`; surface ticket number, team, next milestone in the detail header.
- **SLA state in list + header** — already derived via `deriveSlaState` in storage.ts; expose in `ConversationRow` (check) and header component.
- **Internal notes / activity timeline** — `helpMessages` supports `internal_note`; composer's toggle POSTs to `/api/helpdesk/inbox/conversations/:id/notes` (already exists). Timeline treats notes visually distinct.
- **Assign to teammate / status / priority** — endpoints already exist (assignee PATCH, status PATCH, priority PATCH). Wire UI controls, optimistic update via TanStack Query mutations.

No new tables. Any new column is documented in the Changelog below.

---

## Phase D — Settings + dashboard posture

- **`/settings/inboxes`** — new route + page component. Lists `helpInboxes` for the tenant. Read-only in this phase (creation in a later cycle).
- **`/settings/workflows`** — new route + stub page. Placeholder card: "Workflow rules are coming in a future cycle — for now conversations route via inbox defaults." Nav entry.
- **Dashboard reframe** — [dashboard.tsx](../../../client/src/pages/dashboard.tsx) currently mixes inbox triage cards with generic metrics. Remove vanity metrics (the "By inbox / team" totals alone aren't actionable). Keep: unassigned, SLA at risk, urgent priority, waiting-too-long (new: conversations with `lastCustomerMessageAt > 24h` and status=`pending`). Each card links to a pre-filtered inbox view.

Scaffold is fine where acknowledged in the Changelog.

---

## Verification (at every phase boundary)

```bash
npm run check   # (this repo calls it "check", not "typecheck")
npm run build
npm test
```

Browser smoke:
- `/dashboard`
- `/inbox`
- `/inbox/assigned`
- `/inbox/assigned?conversation=<real-id>`
- `/inbox/assigned?conversation=bogus` (must not crash — must render empty-state)
- `/settings/inboxes`, `/settings/workflows`
- `/platform-dashboard` (legacy — still loads for platform admins)
- Login → session → protected route flow

Every Phase A blocker must land with its own supertest.

---

## Out of scope (this cycle)

- Full Azure AD passport/openid-client migration (pilot uses the direct flow + JWKS verify).
- Full-text search across conversations.
- Real email ingestion (SES/Postmark). Channel remains `email` label only.
- Berkeley pilot functionality (tracked under `server/pilots/*` and separate plans).
- Workflow-rule engine. `/settings/workflows` is a placeholder only.
- Dashboard charting library. Existing inline bars stay.

---

## Working rhythm

1. Phase A, blocker-by-blocker, commit per blocker with its test.
2. `npm run check && npm run build && npm test` at phase boundary.
3. Phase B, C, D sequentially, commit per meaningful unit.
4. Final verification + merge to `main`.

## Final report format

1. What changed (by phase)
2. Files created / modified
3. Schema changes (if any)
4. Architectural decisions
5. Fully implemented vs scaffolded
6. Remaining dogfooding risk (explicit if any A-item deferred)

Build the real thing. Hardening before depth. Evidence before assertions.

---

## Changelog

- 2026-04-18 — Brief authored (prior revision).
- 2026-04-18 — Rewrote as tactical execution plan: added A.0 test-infra gap (missing `server/app-factory.ts`), confirmed `npm run check` is the typecheck alias, referenced 2026-04-17 plan for detailed task bodies. No scope changes to A/B/C/D.
