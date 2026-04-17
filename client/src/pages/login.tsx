import { useEffect, useState } from "react";
import { ArrowUpRight, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { useAuth } from "../lib/auth";

interface PropertyBrand {
  name: string;
  agentName: string;
  logoUrl?: string;
  primaryColor?: string;
}

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [brand, setBrand] = useState<PropertyBrand | null>(null);
  const [ssoEnabled, setSsoEnabled] = useState(false);

  useEffect(() => {
    fetch(`/api/public/brand?host=${encodeURIComponent(window.location.hostname)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data: PropertyBrand | null) => {
        if (data) setBrand(data);
      })
      .catch(() => {});

    fetch("/api/auth/azure/status", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { enabled: false }))
      .then((data: { enabled: boolean }) => setSsoEnabled(Boolean(data.enabled)))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message ?? "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const accentColor = brand?.primaryColor ?? "#111827";
  const productName = brand?.name ?? "LIRE Help";
  const assistantName = brand?.agentName ?? "Ops AI";

  return (
    <div className="min-h-screen bg-transparent px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-7xl overflow-hidden rounded-[32px] border border-slate-200/80 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.08)]">
        <section className="relative hidden min-h-full flex-1 overflow-hidden border-r border-slate-200 bg-[#f5f8fa] lg:flex lg:flex-col lg:justify-between">
          <div
            className="absolute inset-x-0 top-0 h-48"
            style={{
              background: `radial-gradient(circle at top left, ${accentColor}20, transparent 55%), linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(245,248,250,1) 100%)`,
            }}
          />

          <div className="relative p-8 xl:p-10">
            <a href="/" className="inline-flex items-center gap-3 text-slate-900 no-underline">
              <span
                className="flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-sm"
                style={{ backgroundColor: accentColor }}
              >
                <svg style={{ width: 22, height: 22, stroke: "currentColor", fill: "none", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }} viewBox="0 0 24 24">
                  <path d="M3 21V9l5-4v16H3zm6 0V7l6-5v19H9zm8 0V5l4-3v19h-4z" />
                </svg>
              </span>
              <span>
                <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Customer operations</span>
                <span className="block text-base font-semibold tracking-tight">{productName}</span>
              </span>
            </a>

            <div className="mt-16 max-w-xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                Secure workspace access
              </span>
              <h1 className="mt-6 text-[clamp(2.5rem,4vw,4rem)] font-semibold tracking-[-0.06em] text-slate-950">
                Support software energy, not v1 admin panel energy.
              </h1>
              <p className="mt-5 max-w-lg text-base leading-8 text-slate-600 xl:text-lg">
                Sign in to the redesigned workspace for queue management, conversation triage, and customer follow-through.
                Existing auth and helpdesk behavior stay the same — the visible experience is what changed.
              </p>
            </div>

            <div className="mt-10 grid max-w-2xl gap-4 xl:grid-cols-3">
              {[
                { title: "Inbox-first layout", detail: "Navigate queues, list work, and review context without visual clutter." },
                { title: "Sharper hierarchy", detail: "Cleaner spacing, stronger typography, and less placeholder language." },
                { title: "Intercom-inspired polish", detail: "Calmer navigation and a more premium support workspace feel." },
              ].map((item) => (
                <div key={item.title} className="rounded-[24px] border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur">
                  <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative border-t border-slate-200 bg-white/70 p-8 xl:p-10">
            <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Workspace preview</p>
                <div className="mt-4 space-y-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-900">Priority queue</p>
                    <p className="mt-1 text-sm text-slate-500">Dock scheduling API regression · awaiting engineering handoff</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-sm font-semibold text-slate-900">Internal note</p>
                    <p className="mt-1 text-sm text-slate-500">Attach payload samples before sharing the escalation thread.</p>
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-slate-950 p-5 text-slate-50 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Assistant context</p>
                <p className="mt-3 text-lg font-semibold tracking-tight">{assistantName}</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Brand context still loads per host, so tenants keep their identity while the shell moves toward a cleaner, more product-led baseline.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="flex w-full items-center justify-center bg-white px-5 py-8 sm:px-8 lg:max-w-[460px] lg:px-10 xl:max-w-[520px] xl:px-12">
          <div className="w-full max-w-md">
            <div className="flex items-center justify-between gap-3">
              <a href="/" className="text-sm font-medium text-slate-500 transition hover:text-slate-900 lg:hidden">
                ← Back to home
              </a>
              <a href="/" className="hidden items-center gap-1 text-sm font-medium text-slate-500 transition hover:text-slate-900 lg:inline-flex">
                View homepage
                <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>

            <div className="mt-10 rounded-[28px] border border-slate-200 bg-white p-7 shadow-[0_18px_48px_rgba(15,23,42,0.06)] sm:p-8">
              <div className="mb-8">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Sign in</p>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Welcome back</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Access your inbox, customer records, and operator workflows.
                </p>
              </div>

              {ssoEnabled ? (
                <div className="mb-6 space-y-3">
                  <a
                    href="/api/auth/azure/login"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 23 23" aria-hidden="true">
                      <rect x="1" y="1" width="10" height="10" fill="#f25022" />
                      <rect x="12" y="1" width="10" height="10" fill="#7fba00" />
                      <rect x="1" y="12" width="10" height="10" fill="#00a4ef" />
                      <rect x="12" y="12" width="10" height="10" fill="#ffb900" />
                    </svg>
                    Sign in with Microsoft
                  </a>
                  <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    <span className="h-px flex-1 bg-slate-200" />
                    or
                    <span className="h-px flex-1 bg-slate-200" />
                  </div>
                </div>
              ) : null}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Work email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    autoComplete="email"
                    placeholder="name@company.com"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-4 focus:ring-slate-200/60"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Password</label>
                  <div className="relative">
                    <input
                      type={showPwd ? "text" : "password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 pr-12 text-sm text-slate-900 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-4 focus:ring-slate-200/60"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd((value) => !value)}
                      className="absolute right-3 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                      tabIndex={-1}
                      aria-label={showPwd ? "Hide password" : "Show password"}
                    >
                      {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {error ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {loading ? "Signing in…" : "Enter workspace"}
                </button>
              </form>

              <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
                <p className="text-xs font-semibold text-blue-800">Demo credentials</p>
                <p className="mt-1 text-xs leading-5 text-blue-700">
                  Email: <span className="font-mono font-semibold">demo@northstar.com</span>
                  <br />
                  Password: <span className="font-mono font-semibold">Demo2026</span>
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
