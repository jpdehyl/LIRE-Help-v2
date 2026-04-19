import { Link } from "wouter";
import { ArrowRight } from "lucide-react";

// Landing / marketing page. Ports public/design/LandingLogin.jsx (LandingScreen
// + its HeroEditorial, ConciergeExplainer, FooterCTA) into the authenticated
// SPA so the same React/Tailwind codebase owns both the public homepage and
// the app. Root is always light — the topbar toggle only affects the app
// surfaces behind /login.

export default function LandingPage() {
  return (
    <div className="w-full bg-bg text-fg" data-force-light>
      <MarketingNav />
      <HeroEditorial />
      <ConciergeExplainer />
      <FooterCTA />
    </div>
  );
}

function LireMark({ size = 32 }: { size?: number }) {
  return (
    <div
      className="grid place-items-center rounded-xs bg-fg font-display font-extrabold tracking-[-0.04em] text-accent leading-none"
      style={{ width: size, height: size, fontSize: size * 0.5 }}
    >
      L
    </div>
  );
}

function MarketingNav() {
  return (
    <div className="sticky top-0 z-10 flex items-center gap-5 border-b border-border bg-[rgba(255,255,255,0.85)] px-6 py-5 backdrop-blur-md sm:px-12">
      <a href="/" className="flex min-w-0 flex-1 items-center gap-2.5 no-underline text-fg">
        <LireMark size={28} />
        <div className="whitespace-nowrap font-display text-[18px] font-bold tracking-tight">LIRE Help</div>
        <div className="ml-2 hidden whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.06em] text-fg-subtle md:block">
          DEHYL · OPERATIONS OS
        </div>
      </a>
      <div className="hidden items-center gap-[18px] font-body text-[13px] text-fg-muted md:flex">
        <a href="#product" className="text-inherit no-underline hover:text-fg">
          Product
        </a>
        <a href="#agent" className="text-inherit no-underline hover:text-fg">
          Concierge
        </a>
        <a href="#contact" className="text-inherit no-underline hover:text-fg">
          Contact
        </a>
      </div>
      <Link href="/login">
        <a className="inline-flex h-8 items-center rounded-sm border border-border bg-surface px-3 font-body text-[12px] font-medium text-fg no-underline transition-colors ease-ds duration-fast hover:bg-surface-2">
          Sign in
        </a>
      </Link>
      <Link href="/dashboard">
        <a className="inline-flex h-8 items-center rounded-sm bg-accent px-3 font-body text-[12px] font-medium text-accent-ink no-underline transition-opacity ease-ds duration-fast hover:opacity-90">
          Open app
        </a>
      </Link>
    </div>
  );
}

function HeroEditorial() {
  return (
    <section id="product" className="mx-auto max-w-[1360px] px-6 pb-18 pt-20 sm:px-12 sm:pb-[72px] sm:pt-[88px]">
      <div className="mb-7 font-mono text-[11px] uppercase tracking-[0.08em] text-fg-subtle">
        01 — OPERATIONS OS FOR INDUSTRIAL PROPERTY
      </div>
      <h1
        className="m-0 font-display font-bold tracking-[-0.045em] text-fg"
        style={{ fontSize: "min(8.5vw, 120px)", lineHeight: 0.95, maxWidth: 1200, textWrap: "balance" }}
      >
        The quiet
        <br />
        night shift
        <br />
        for your <span className="text-accent">portfolio</span>.
      </h1>
      <div className="mt-8 max-w-[640px] font-body text-[18px] leading-[1.5] text-fg-muted">
        LIRE Help is a Claude-managed agent and inbox for industrial property teams. Tenant requests, vendor dispatch,
        compliance, and site history — one operating surface that answers in seconds and knows every building.
      </div>
      <div className="mt-9 flex flex-wrap gap-2.5">
        <Link href="/dashboard">
          <a className="inline-flex h-[34px] items-center gap-1.5 rounded-sm bg-accent px-3 font-body text-[13px] font-medium text-accent-ink no-underline transition-opacity ease-ds duration-fast hover:opacity-90">
            Walk the demo
            <ArrowRight className="h-3 w-3" />
          </a>
        </Link>
        <Link href="/login">
          <a className="inline-flex h-[34px] items-center rounded-sm border border-border bg-surface px-3 font-body text-[13px] font-medium text-fg no-underline transition-colors ease-ds duration-fast hover:bg-surface-2">
            Sign in
          </a>
        </Link>
      </div>
    </section>
  );
}

function ConciergeExplainer() {
  const pillars = [
    {
      n: "01",
      t: "Knows your buildings",
      b: "Leases, vendor contracts, floor plans, equipment manuals, and every past resolved ticket — indexed and cited on every reply.",
    },
    {
      n: "02",
      t: "Learns your rhythm",
      b: "Captures vendor preferences, tenant quirks, and after-hours rules silently. You approve what gets promoted into the playbook.",
    },
    {
      n: "03",
      t: "Stays in its lane",
      b: "Autonomy matrix by topic. Hard no-go zones for rent disputes and legal. Escalation triggers when a human must step in.",
    },
  ];
  const stats = [
    { l: "AUTONOMOUS RESOLUTION", v: "82%", f: "of tenant threads end-to-end" },
    { l: "FIRST RESPONSE", v: "1m 14s", f: "vs 11m human benchmark" },
    { l: "TENANT SATISFACTION", v: "94%", f: "no re-open in 48h" },
    { l: "KNOWLEDGE SOURCES", v: "8", f: "per property · continuous index" },
  ];
  return (
    <section id="agent" className="bg-surface px-6 py-24 sm:px-12">
      <div className="mx-auto max-w-[1360px]">
        <div className="mb-5 font-mono text-[11px] uppercase tracking-[0.08em] text-fg-subtle">
          02 — THE CLAUDE-MANAGED AGENT
        </div>
        <h2
          className="m-0 max-w-[1000px] font-display font-bold tracking-[-0.03em] text-fg"
          style={{ fontSize: "min(5.6vw, 72px)", lineHeight: 1.02, textWrap: "balance" }}
        >
          Not a chatbot. <span className="text-fg-muted">An operator</span> — with a knowledge base, a set of skills, and
          guardrails you write.
        </h2>
        <div className="mt-6 max-w-[680px] font-body text-[17px] leading-[1.55] text-fg-muted">
          LIRE Concierge is built on Claude and managed by your team. You control what it knows, what it can do on its
          own, and where it must hand off. It gets better every week — and the digest tells you exactly how.
        </div>

        <div className="mt-14 grid grid-cols-1 border-t border-border md:grid-cols-3">
          {pillars.map((p, i) => (
            <div
              key={p.n}
              className={["pt-8", i > 0 ? "md:pl-7" : "", i < 2 ? "md:border-r md:border-border md:pr-7" : ""].join(" ")}
            >
              <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.08em] text-accent">{p.n}</div>
              <div className="mb-2.5 font-display text-[22px] font-semibold tracking-[-0.015em] text-fg">{p.t}</div>
              <div className="font-body text-[14px] leading-[1.55] text-fg-muted">{p.b}</div>
            </div>
          ))}
        </div>

        <div className="mt-18 grid grid-cols-2 rounded-sm bg-fg py-7 text-[#FAFAFA] sm:mt-[72px] lg:grid-cols-4">
          {stats.map((s, i) => (
            <div
              key={s.l}
              className={[
                "px-7 py-3",
                i < 3 ? "lg:border-r lg:border-[rgba(255,255,255,0.1)]" : "",
                i < 2 ? "border-b border-[rgba(255,255,255,0.1)] lg:border-b-0" : "",
                i === 1 ? "lg:border-r lg:border-[rgba(255,255,255,0.1)]" : "",
              ].join(" ")}
            >
              <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-[rgba(255,255,255,0.5)]">
                {s.l}
              </div>
              <div className="mt-2 font-display text-[40px] font-semibold leading-[1] tracking-[-0.02em] text-[#FAFAFA]">
                {s.v}
              </div>
              <div className="mt-0.5 font-body text-[12px] text-[rgba(255,255,255,0.6)]">{s.f}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FooterCTA() {
  return (
    <section id="contact" className="px-6 pb-18 pt-24 sm:px-12 sm:pb-[72px]">
      <div className="mx-auto grid max-w-[1360px] grid-cols-1 items-end gap-12 lg:grid-cols-[1.3fr_1fr] lg:gap-16">
        <div>
          <div className="mb-4 font-mono text-[11px] uppercase tracking-[0.08em] text-fg-subtle">03 — GET STARTED</div>
          <h2
            className="m-0 font-display font-bold tracking-[-0.035em] text-fg"
            style={{ fontSize: "min(6.4vw, 88px)", lineHeight: 1.0, textWrap: "balance" }}
          >
            Walk through a
            <br />
            live portfolio.
          </h2>
          <div className="mt-5 max-w-[540px] font-body text-[16px] text-fg-muted">
            Six properties, two dozen tenants, a weekend of live tickets. See what the Concierge caught, what it
            learned, and what it handed to the humans.
          </div>
        </div>
        <div className="flex flex-col gap-2.5">
          <Link href="/dashboard">
            <a className="inline-flex h-[34px] items-center justify-center gap-1.5 rounded-sm bg-accent px-3 font-body text-[13px] font-medium text-accent-ink no-underline transition-opacity ease-ds duration-fast hover:opacity-90">
              Walk the demo
              <ArrowRight className="h-3 w-3" />
            </a>
          </Link>
          <Link href="/login">
            <a className="inline-flex h-[34px] items-center justify-center rounded-sm border border-border bg-surface px-3 font-body text-[13px] font-medium text-fg no-underline transition-colors ease-ds duration-fast hover:bg-surface-2">
              Sign in to your portfolio
            </a>
          </Link>
        </div>
      </div>

      <div className="mx-auto mt-14 flex max-w-[1360px] flex-wrap items-center gap-4 border-t border-border pt-7">
        <LireMark size={22} />
        <div className="font-display text-[13px] font-semibold text-fg">LIRE Help</div>
        <div className="flex-1 font-body text-[12px] text-fg-muted">Dehyl · Operations OS · © 2026</div>
        <div className="flex gap-[18px] font-body text-[12px] text-fg-muted">
          <a href="#" className="text-inherit no-underline hover:text-fg">
            Terms
          </a>
          <a href="#" className="text-inherit no-underline hover:text-fg">
            Privacy
          </a>
          <a href="#" className="text-inherit no-underline hover:text-fg">
            Security
          </a>
        </div>
      </div>
    </section>
  );
}
