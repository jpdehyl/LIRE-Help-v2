# Azure Integration Runbook

**Last updated:** 2026-04-17
**Audience:** Berkeley IT + Dehyl engineering
**Status:** Draft — to be ratified with Berkeley's cloud + compliance leads before provisioning.

This runbook explains how LIRE-Help deploys into Berkeley Partners' Azure environment for the pilot. It maps every external boundary in the application to an Azure service and the env var that flips the code from dev mode to Berkeley mode.

---

## 1. Adapter model

The code uses an **adapter pattern** at every external boundary. Each adapter has a local-dev implementation and an Azure implementation. Which one runs is decided entirely by environment variables — no application code changes between dev and Berkeley prod.

| Boundary | Dev impl | Azure impl | Flip via env |
|---|---|---|---|
| Database | Postgres on Railway | Azure Database for PostgreSQL Flexible Server | `DATABASE_URL` points at Azure |
| Blob storage | `LocalFsBlobStore` (`./.blobs`) | `AzureBlobStore` (SAS token; roadmap: managed identity) | `AZURE_BLOB_ACCOUNT` + `AZURE_BLOB_CONTAINER` + `AZURE_BLOB_SAS_TOKEN` |
| Secrets | `EnvSecretStore` (`process.env`) | `KeyVaultSecretStore` (IMDS-authenticated) | `AZURE_KEY_VAULT_URL` |
| Auth | session + bcrypt password | Azure AD OIDC (PKCE, authorization code) | `AZURE_AD_TENANT_ID` + `AZURE_AD_CLIENT_ID` + `AZURE_AD_CLIENT_SECRET` + `AZURE_AD_REDIRECT_URI` |
| LLM | Anthropic public API | Anthropic on Azure (roadmap) — same `/v1/messages` shape, different base URL | `ANTHROPIC_BASE_URL` override once available |
| Yardi | `FixtureYardiClient` (JSON fixtures) | `LiveYardiClient` | `YARDI_API_URL` + `YARDI_API_KEY` |

If an Azure env var is missing, the dev adapter runs. This keeps the stack testable on Railway while Berkeley IT provisions.

---

## 2. Azure resources to provision

Berkeley IT creates these in Berkeley's subscription, in a dedicated resource group (proposed: `rg-lire-pilot`, region `westus2` or `westus3`):

| Resource | Purpose | Notes |
|---|---|---|
| App Service (Linux, Node 20) | Runs the Express/Node server + serves the Vite build | Min 2 instances, autoscale 2–6; managed identity enabled |
| Azure Database for PostgreSQL Flexible Server | Application DB | Private endpoint; Azure AD auth optional for admins |
| Azure Blob Storage account | Credit-document uploads, generated unit-sheet PDFs | Private endpoint; soft-delete + versioning ON for audit |
| Azure Key Vault | All secrets (Anthropic key, Yardi key, session secret, DB password if not AD) | Managed identity access from App Service |
| Azure AD App Registration | OIDC client for SSO | Redirect URI: `https://<app>.azurewebsites.net/api/auth/azure/callback` |
| Application Insights | Logs + metrics | Connects to the App Service |
| Log Analytics Workspace | Backing store for App Insights + audit logs | Retention per Berkeley compliance (90d+ recommended) |
| (Optional) Azure Front Door | Custom domain + WAF | Needed if Bahaar wants `app.berkeleypartners.com` |

---

## 3. Env var reference

Put secrets in Key Vault and reference them from App Service configuration using `@Microsoft.KeyVault(SecretUri=...)` — do not set secret values directly in App Service. Non-secret values can live in App Service configuration.

### Required for Berkeley prod

```bash
# Database
DATABASE_URL=postgres://<user>:<pwd>@<server>.postgres.database.azure.com:5432/lire?sslmode=require

# Blob storage
AZURE_BLOB_ACCOUNT=<storage-account-name>
AZURE_BLOB_CONTAINER=lire-credit-docs
AZURE_BLOB_SAS_TOKEN=<user-delegation-SAS>   # rotate daily via automation; managed-identity roadmap below

# Secrets
AZURE_KEY_VAULT_URL=https://kv-lire-pilot.vault.azure.net

# Azure AD SSO
AZURE_AD_TENANT_ID=<Berkeley's tenant UUID>
AZURE_AD_CLIENT_ID=<app registration client id>
AZURE_AD_CLIENT_SECRET=<from Key Vault>
AZURE_AD_REDIRECT_URI=https://<host>/api/auth/azure/callback
AZURE_AD_HOME_TENANT_SLUG=berkeley   # maps Azure AD tenant → LIRE SaaS tenant

# LLM (Berkeley-owned Anthropic Enterprise key)
ANTHROPIC_API_KEY=<from Key Vault>

# Yardi (once IT issues creds)
YARDI_API_URL=https://<berkeley-yardi-endpoint>
YARDI_API_KEY=<from Key Vault>

# Session
SESSION_SECRET=<from Key Vault, 64+ random bytes>
NODE_ENV=production
COOKIE_DOMAIN=<custom domain if using Front Door>
```

### Already available in dev / Railway

Nothing above is required for local dev. The code falls back to filesystem blobs, env secrets, and password auth when these vars are absent.

---

## 4. Roadmap items (post-pilot)

1. **Managed identity for Blob + Key Vault.** The SAS-token branch is a pragmatic shortcut. Before scale-up, swap to `@azure/storage-blob` + `@azure/identity` with `DefaultAzureCredential` and retire the SAS path.
2. **JWKS verification for Azure AD id_tokens.** Current code validates issuer/audience/expiry/tenant but does not verify the token signature. Wire up Microsoft's JWKS before the first real login.
3. **Anthropic on Azure.** When Berkeley standardizes on Claude-via-Azure, point `ANTHROPIC_BASE_URL` at the Azure endpoint. Code already uses a single fetch path that accepts an override.
4. **Private endpoints.** App Service → Postgres, App Service → Blob, App Service → Key Vault should all be private-endpoint'd. Exit traffic for LLM calls goes through a NAT gateway with a stable egress IP that Berkeley can allowlist in their SIEM.
5. **Customer-managed keys (CMK).** Blob + Postgres encryption at rest with Berkeley-managed keys in Key Vault. Required by some enterprise policies.
6. **Log export to Berkeley SIEM.** Diagnostic settings on App Service + Blob + Key Vault → Log Analytics → forward to Berkeley's SIEM of choice.

---

## 5. Compliance checkpoints

Before production go-live, Berkeley Compliance must sign off on:

- [ ] `archive_log` retention window (proposed: 7 years, SOC 2 + SEC 17a-4 compatible)
- [ ] Blob container immutability policy (WORM) for credit-document containers
- [ ] Log Analytics retention (proposed: 2 years)
- [ ] Data residency — US region only, confirmed for all resources
- [ ] Key rotation cadence for Anthropic / Yardi keys (proposed: 90 days)
- [ ] Access review cadence for the Azure AD app registration (proposed: quarterly)
- [ ] DLP/CASB coverage for the Blob container
- [ ] CMK if required by Berkeley policy
- [ ] Penetration test scope + timing (Dehyl can run, or Berkeley can contract)

---

## 6. Flipping from dev to Berkeley

Checklist Dehyl executes when Berkeley IT hands over the environment:

1. Set all env vars from §3 in App Service configuration (Key Vault references for secrets).
2. Run schema migrations against the Berkeley Postgres: `npx drizzle-kit push` from App Service SSH.
3. Seed Berkeley tenant record (`scripts/seed-berkeley.ts` — to be written, mirrors `seed-oakland-gateway.ts`).
4. Smoke test the adapter fallbacks by unsetting one env var at a time in a staging slot.
5. Run the end-to-end demo script:
   - Upload a sample P&L PDF to `/api/pilots/credit/documents/upload`
   - Classify → Extract → Evaluate → Draft → Analyst approve
   - Verify every step appears in `archive_log`
6. Hand staging URL to Bahaar; record a 5-minute Loom for internal sign-off.

---

## 7. Related docs

- Proposal: `docs/clients/berkeley-partners-proposal.md`
- PRD: `docs/superpowers/specs/2026-04-17-berkeley-pilots-prd.md`
- Pilot success criteria: `docs/clients/berkeley-partners-pilot-success-criteria.md`
- Pilot modules: `server/pilots/README.md`
- Tenant config rules: `config/tenants/berkeley/README.md`
