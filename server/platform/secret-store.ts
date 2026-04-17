// ─────────────────────────────────────────────────────────────────────────────
// SecretStore — one interface, two implementations. Local dev reads from
// process.env. Berkeley Azure reads from Key Vault via managed identity.
//
// Why not just process.env everywhere? Two reasons specific to this engagement:
//   1. Berkeley compliance will want rotating secrets (Yardi API key, Anthropic
//      key) managed in Key Vault, not baked into app-service settings.
//   2. Different secrets apply to different tenants (when we onboard a second
//      enterprise customer). An env map doesn't scale; a Key Vault lookup does.
//
// Cache is per-process, 5-minute TTL. Rotations within 5 min require a process
// restart — acceptable for pilot scope.
// ─────────────────────────────────────────────────────────────────────────────

export interface SecretStore {
  get(name: string): Promise<string | null>;
  require(name: string): Promise<string>;
}

// ─── Env impl (dev + Railway) ───────────────────────────────────────────────

export class EnvSecretStore implements SecretStore {
  async get(name: string): Promise<string | null> {
    const value = process.env[name];
    return value ?? null;
  }
  async require(name: string): Promise<string> {
    const value = await this.get(name);
    if (!value) throw new Error(`Required secret missing: ${name}`);
    return value;
  }
}

// ─── Key Vault impl ─────────────────────────────────────────────────────────
// Uses the Key Vault REST API with a bearer token obtained from Azure Instance
// Metadata Service (IMDS) when running inside Azure, or from a service
// principal (client credentials) locally. We don't pull in @azure/identity yet
// — swap to it when Berkeley IT hands us the managed identity.

type TokenCacheEntry = { token: string; expiresAt: number };
type SecretCacheEntry = { value: string; expiresAt: number };

const SECRET_TTL_MS = 5 * 60 * 1000;
const TOKEN_REFRESH_SKEW_MS = 60 * 1000;

export class KeyVaultSecretStore implements SecretStore {
  private tokenCache: TokenCacheEntry | null = null;
  private secretCache = new Map<string, SecretCacheEntry>();

  constructor(private readonly vaultUrl: string) {}

  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.tokenCache && this.tokenCache.expiresAt > now + TOKEN_REFRESH_SKEW_MS) {
      return this.tokenCache.token;
    }

    const resource = "https://vault.azure.net";
    const imdsUrl = `http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=${encodeURIComponent(
      resource,
    )}`;

    const res = await fetch(imdsUrl, { headers: { Metadata: "true" } });
    if (!res.ok) {
      throw new Error(`Managed identity token fetch failed: ${res.status} ${await res.text()}`);
    }
    const data = (await res.json()) as { access_token: string; expires_in: string };
    const expiresInMs = Number(data.expires_in) * 1000;
    this.tokenCache = { token: data.access_token, expiresAt: now + expiresInMs };
    return data.access_token;
  }

  async get(name: string): Promise<string | null> {
    const now = Date.now();
    const cached = this.secretCache.get(name);
    if (cached && cached.expiresAt > now) return cached.value;

    const token = await this.getAccessToken();
    const url = `${this.vaultUrl.replace(/\/+$/, "")}/secrets/${encodeURIComponent(name)}?api-version=7.4`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Key Vault GET failed: ${res.status} ${await res.text()}`);
    const body = (await res.json()) as { value: string };
    this.secretCache.set(name, { value: body.value, expiresAt: now + SECRET_TTL_MS });
    return body.value;
  }

  async require(name: string): Promise<string> {
    const value = await this.get(name);
    if (!value) throw new Error(`Required secret missing from Key Vault: ${name}`);
    return value;
  }
}

// ─── Factory ────────────────────────────────────────────────────────────────

let singleton: SecretStore | null = null;

export function getSecretStore(): SecretStore {
  if (singleton) return singleton;
  const vaultUrl = process.env["AZURE_KEY_VAULT_URL"];
  if (vaultUrl) {
    singleton = new KeyVaultSecretStore(vaultUrl);
  } else {
    singleton = new EnvSecretStore();
  }
  return singleton;
}

export function __resetSecretStoreForTests() {
  singleton = null;
}
