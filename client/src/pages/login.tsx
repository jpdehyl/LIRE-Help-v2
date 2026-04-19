import { useEffect, useState } from "react";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../lib/auth";
import { Button } from "../components/ui";

interface PropertyBrand {
  name: string;
  agentName: string;
  logoUrl?: string;
  primaryColor?: string;
}

interface OidcProvider {
  id: string;
  label: string;
}

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [brand, setBrand] = useState<PropertyBrand | null>(null);
  const [ssoProviders, setSsoProviders] = useState<OidcProvider[]>([]);

  useEffect(() => {
    fetch(`/api/public/brand?host=${encodeURIComponent(window.location.hostname)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data: PropertyBrand | null) => {
        if (data) setBrand(data);
      })
      .catch(() => {});

    fetch("/api/auth/oidc/providers", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { providers: [] }))
      .then((data: { providers?: OidcProvider[] }) => setSsoProviders(data.providers ?? []))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(email, password);
    } catch (err: any) {
      setError(err?.message ?? "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const productName = brand?.name ?? "LIRE Help";

  return (
    <div className="grid h-screen w-screen grid-cols-1 bg-bg lg:grid-cols-2">
      {/* Left: form */}
      <div className="flex min-w-0 flex-col px-6 py-6 sm:px-10 sm:py-8 lg:px-12">
        <a href="/" className="flex shrink-0 items-center gap-2.5 no-underline">
          <div className="grid h-[26px] w-[26px] place-items-center rounded-xs bg-fg font-display text-[13px] font-bold leading-none text-accent">
            L
          </div>
          <div className="font-display text-[16px] font-bold tracking-tight text-fg">{productName}</div>
        </a>

        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-[400px]">
            <div className="eyebrow text-fg-subtle">Welcome back</div>
            <h1 className="mt-2 font-display text-[36px] font-bold leading-[1.05] tracking-tight text-fg">
              Sign in to LIRE
            </h1>
            <p className="mt-2 font-body text-[14px] text-fg-muted">
              Use your work account, or email and password.
            </p>

            {ssoProviders.length > 0 ? (
              <div className="mt-6 grid gap-2">
                {ssoProviders.map((p) => (
                  <a
                    key={p.id}
                    href={`/api/auth/oidc/${p.id}/start`}
                    className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-sm border border-border bg-surface px-3 font-body text-[13px] font-medium text-fg transition-colors ease-ds duration-fast hover:bg-surface-2 no-underline"
                  >
                    <ProviderIcon provider={p.id} />
                    Sign in with {p.label}
                  </a>
                ))}
              </div>
            ) : null}

            {ssoProviders.length > 0 ? (
              <div className="my-5 flex items-center gap-2.5">
                <div className="h-px flex-1 bg-border" />
                <div className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-subtle">OR EMAIL</div>
                <div className="h-px flex-1 bg-border" />
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className={`grid gap-2.5 ${ssoProviders.length === 0 ? "mt-6" : ""}`}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@property.co"
                className="rounded-sm border border-border bg-surface px-3.5 py-[11px] font-body text-[13px] text-fg outline-none placeholder:text-fg-subtle focus:border-fg focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
              />
              <div className="relative">
                <input
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="Password"
                  className="w-full rounded-sm border border-border bg-surface px-3.5 py-[11px] pr-10 font-body text-[13px] text-fg outline-none placeholder:text-fg-subtle focus:border-fg focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  tabIndex={-1}
                  aria-label={showPwd ? "Hide password" : "Show password"}
                  className="absolute right-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-xs text-fg-muted transition-colors ease-ds duration-fast hover:bg-surface-2 hover:text-fg"
                >
                  {showPwd ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>

              {error ? (
                <div className="rounded-sm border border-[rgba(220,38,38,0.35)] bg-[rgba(220,38,38,0.08)] px-3 py-2 font-body text-[12px] text-error" role="alert">
                  {error}
                </div>
              ) : null}

              <Button
                type="submit"
                variant="primary"
                size="md"
                loading={loading}
                rightIcon={loading ? undefined : <ArrowRight className="h-3 w-3" />}
                className="mt-1 h-10"
              >
                {loading ? "Signing in…" : "Sign in"}
              </Button>
            </form>

            <div className="mt-5 flex items-center justify-between font-body text-[12px] text-fg-muted">
              <a href="#" className="text-fg-muted no-underline hover:text-fg">
                Forgot password?
              </a>
              <span>
                Demo:{" "}
                <code className="font-mono text-[11px] text-fg">demo@northstar.com / Demo2026</code>
              </span>
            </div>
          </div>
        </div>

        <div className="shrink-0 font-mono text-[10px] uppercase tracking-eyebrow text-fg-subtle">
          DEHYL · OPERATIONS OS · SOC 2 TYPE II
        </div>
      </div>

      {/* Right: editorial panel */}
      <aside className="relative hidden min-w-0 flex-col overflow-hidden bg-fg px-12 py-12 text-[#FAFAFA] lg:flex">
        <div className="font-mono text-[11px] uppercase tracking-eyebrow text-[rgba(255,255,255,0.45)]">
          FIELD NOTE · OVERNIGHT DISPATCH
        </div>
        <div className="flex flex-1 items-center">
          <blockquote className="m-0 max-w-[520px] font-display text-[36px] font-medium leading-[1.15] tracking-tight text-[#FAFAFA]">
            &ldquo;Woke up to a solved ticket and a vendor on-site. This is the first tool that actually{" "}
            <span className="text-accent">earns its seat at the table</span>.&rdquo;
          </blockquote>
        </div>
        <div className="flex items-center gap-3.5 border-t border-[rgba(255,255,255,0.12)] pt-5">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-accent font-display text-[13px] font-bold text-[#FAFAFA]">
            MR
          </div>
          <div>
            <div className="font-body text-[13px] font-semibold text-[#FAFAFA]">Marco Reyes</div>
            <div className="mt-0.5 font-body text-[12px] text-[rgba(255,255,255,0.55)]">
              Ops Lead · Atlas Cold Storage · ATL-02
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function ProviderIcon({ provider }: { provider: string }) {
  if (provider === "azure") {
    return (
      <svg className="h-4 w-4" viewBox="0 0 23 23" aria-hidden="true">
        <rect x="1" y="1" width="10" height="10" fill="#f25022" />
        <rect x="12" y="1" width="10" height="10" fill="#7fba00" />
        <rect x="1" y="12" width="10" height="10" fill="#00a4ef" />
        <rect x="12" y="12" width="10" height="10" fill="#ffb900" />
      </svg>
    );
  }
  if (provider === "google") {
    return (
      <svg className="h-4 w-4" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
        <path fill="none" d="M0 0h48v48H0z" />
      </svg>
    );
  }
  return null;
}
