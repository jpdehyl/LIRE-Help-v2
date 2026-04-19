import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../lib/auth";

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

// Provider glyph tiles match public/design/LandingLogin.jsx:227-248.
const providerTile: Record<string, { glyph: string; color: string }> = {
  google: { glyph: "G", color: "#EA4335" },
  azure: { glyph: "M", color: "#2F7BE8" },
  okta: { glyph: "Ø", color: "#007DC1" },
};

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

  const nowLabel = useMemo(() => {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, "0");
    const month = d.toLocaleString("en-US", { month: "short" }).toUpperCase();
    const year = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `FIELD NOTE · ${day} ${month} ${year} · ${hh}:${mm}`;
  }, []);

  return (
    <div className="grid min-h-screen w-screen grid-cols-1 bg-[#FAFAFA] text-[#111111] lg:grid-cols-2">
      {/* Left: light form. Locked to light tokens regardless of the app-wide theme. */}
      <div className="flex min-w-0 flex-col bg-[#FAFAFA] px-6 py-6 sm:px-10 sm:py-8 lg:px-12">
        <a href="/" className="flex shrink-0 items-center gap-2.5 no-underline">
          <div
            className="grid place-items-center rounded-xs font-display font-bold leading-none text-[#FF4D00]"
            style={{ width: 26, height: 26, fontSize: 13, background: "#111111" }}
          >
            L
          </div>
          <div className="font-display text-[16px] font-bold tracking-tight text-[#111111]">{productName}</div>
        </a>

        <div className="flex flex-1 items-center justify-center py-8">
          <div className="w-full max-w-[400px]">
            <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-[#A3A3A3]">Welcome back</div>
            <h1
              className="mt-2.5 font-display text-[36px] font-bold leading-[1.05] tracking-[-0.02em] text-[#111111]"
              style={{ margin: 0 }}
            >
              Sign in to LIRE
            </h1>
            <p className="mt-2 font-body text-[14px] text-[#737373]">
              Use your work account, or email and password.
            </p>

            {ssoProviders.length > 0 ? (
              <div className="mt-6 grid gap-2">
                {ssoProviders.map((p) => {
                  const tile = providerTile[p.id] ?? { glyph: p.label[0] ?? "?", color: "#737373" };
                  return (
                    <a
                      key={p.id}
                      href={`/api/auth/oidc/${p.id}/start`}
                      className="flex w-full items-center gap-3 rounded-sm border border-[#E5E5E5] bg-white px-3.5 py-3 font-body text-[13px] font-medium text-[#111111] no-underline transition-colors ease-ds duration-fast hover:bg-[#F5F5F5]"
                    >
                      <span
                        className="grid h-[22px] w-[22px] place-items-center rounded-xs font-display text-[13px] font-bold text-white"
                        style={{ background: tile.color }}
                      >
                        {tile.glyph}
                      </span>
                      <span className="flex-1 text-left">Continue with {p.label}</span>
                      <ArrowRight className="h-3 w-3 text-[#737373]" />
                    </a>
                  );
                })}
              </div>
            ) : null}

            {ssoProviders.length > 0 ? (
              <div className="my-[18px] flex items-center gap-2.5">
                <div className="h-px flex-1 bg-[#E5E5E5]" />
                <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#A3A3A3]">OR EMAIL</div>
                <div className="h-px flex-1 bg-[#E5E5E5]" />
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
                className="rounded-sm border border-[#E5E5E5] bg-white px-3.5 py-[11px] font-body text-[13px] text-[#111111] outline-none placeholder:text-[#A3A3A3] focus:border-[#111111] focus-visible:outline-2 focus-visible:outline-[#FF4D00] focus-visible:outline-offset-2"
              />
              <div className="relative">
                <input
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="Password"
                  className="w-full rounded-sm border border-[#E5E5E5] bg-white px-3.5 py-[11px] pr-10 font-body text-[13px] text-[#111111] outline-none placeholder:text-[#A3A3A3] focus:border-[#111111] focus-visible:outline-2 focus-visible:outline-[#FF4D00] focus-visible:outline-offset-2"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  tabIndex={-1}
                  aria-label={showPwd ? "Hide password" : "Show password"}
                  className="absolute right-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-xs text-[#737373] transition-colors ease-ds duration-fast hover:bg-[#F5F5F5] hover:text-[#111111]"
                >
                  {showPwd ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>

              {error ? (
                <div
                  className="rounded-sm border border-[rgba(220,38,38,0.35)] bg-[rgba(220,38,38,0.08)] px-3 py-2 font-body text-[12px] text-[#DC2626]"
                  role="alert"
                >
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="mt-1 inline-flex h-10 items-center justify-center gap-1.5 rounded-sm bg-[#FF4D00] px-3 font-body text-[13px] font-medium text-white transition-opacity ease-ds duration-fast hover:opacity-90 disabled:opacity-40"
              >
                {loading ? "Signing in…" : (
                  <>
                    Sign in
                    <ArrowRight className="h-3 w-3" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-[18px] flex items-center justify-between font-body text-[12px] text-[#737373]">
              <a href="#" className="text-[#737373] no-underline hover:text-[#111111]">
                Forgot password?
              </a>
              <span>
                Demo:{" "}
                <code className="font-mono text-[11px] text-[#111111]">demo@northstar.com / Demo2026</code>
              </span>
            </div>
          </div>
        </div>

        <div className="shrink-0 font-mono text-[10px] uppercase tracking-[0.06em] text-[#A3A3A3]">
          DEHYL · OPERATIONS OS · SOC 2 TYPE II
        </div>
      </div>

      {/* Right: editorial panel (always dark). */}
      <aside className="relative hidden min-w-0 flex-col overflow-hidden bg-[#111111] px-12 py-12 text-[#FAFAFA] lg:flex">
        <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">
          {nowLabel}
        </div>
        <div className="flex flex-1 items-center">
          <blockquote
            className="m-0 max-w-[520px] font-display text-[36px] font-medium leading-[1.15] tracking-[-0.02em] text-[#FAFAFA]"
            style={{ margin: 0 }}
          >
            &ldquo;Woke up to a solved ticket and a vendor on-site. This is the first tool that actually{" "}
            <span className="text-[#FF4D00]">earns its seat at the table</span>.&rdquo;
          </blockquote>
        </div>
        <div className="flex items-center gap-3.5 border-t border-[rgba(255,255,255,0.12)] pt-5">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-[#FF4D00] font-display text-[13px] font-bold text-[#FAFAFA]">
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
