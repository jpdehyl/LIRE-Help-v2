import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Activity,
  BookOpen,
  CheckCircle2,
  Compass,
  FlaskConical,
  GraduationCap,
  Mail,
  MessageCircle,
  Settings2,
  Shield,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { WorkspaceShell } from "../components/workspace/workspace-shell";
import { helpdeskApi } from "../lib/helpdesk";
import { Badge } from "../components/ui";

type ConciergeTab = "overview" | "try" | "knowledge" | "learning" | "guardrails" | "activity";
type RunState = "live" | "shadow" | "paused";

const tabs: { key: ConciergeTab; label: string; icon: LucideIcon }[] = [
  { key: "overview", label: "Overview", icon: Compass },
  { key: "try", label: "Try it", icon: FlaskConical },
  { key: "knowledge", label: "Knowledge", icon: BookOpen },
  { key: "learning", label: "Learning", icon: GraduationCap },
  { key: "guardrails", label: "Guardrails", icon: Shield },
  { key: "activity", label: "Activity", icon: Activity },
];

export default function ConciergePage() {
  const [tab, setTab] = useState<ConciergeTab>("overview");
  const [runState, setRunState] = useState<RunState>("live");

  const metricsQuery = useQuery({
    queryKey: ["helpdesk", "dashboard", "metrics"],
    queryFn: helpdeskApi.getDashboardMetrics,
    staleTime: 30_000,
  });

  const propertiesQuery = useQuery({
    queryKey: ["helpdesk", "properties-summary"],
    queryFn: helpdeskApi.getPropertiesSummary,
    staleTime: 60_000,
  });

  const openThreads = metricsQuery.data?.summary.openConversations ?? null;
  const propertiesWithOpen = useMemo(() => {
    const rows = propertiesQuery.data?.properties ?? [];
    return rows.filter((p) => p.openTicketCount > 0).length;
  }, [propertiesQuery.data]);

  const actions = (
    <Link href="/settings/ai-automation">
      <a className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-border bg-surface px-2.5 font-body text-[12px] font-medium text-fg-muted transition-colors ease-ds duration-fast hover:bg-surface-2 hover:text-fg">
        <Settings2 className="h-3.5 w-3.5" />
        Configure
      </a>
    </Link>
  );

  return (
    <WorkspaceShell title="LIRE Concierge" eyebrow="Agents" actions={actions}>
      <div className="space-y-5">
        <ConciergeHero
          openThreads={openThreads}
          propertiesWithOpen={propertiesWithOpen || propertiesQuery.data?.properties.length || 0}
          loading={metricsQuery.isLoading || propertiesQuery.isLoading}
          runState={runState}
          onRunStateChange={setRunState}
        />

        <TabBar tab={tab} onChange={setTab} />

        {tab === "overview" ? (
          <OverviewTab />
        ) : (
          <PlaceholderTab tab={tab} />
        )}
      </div>
    </WorkspaceShell>
  );
}

function ConciergeHero({
  openThreads,
  propertiesWithOpen,
  loading,
  runState,
  onRunStateChange,
}: {
  openThreads: number | null;
  propertiesWithOpen: number;
  loading: boolean;
  runState: RunState;
  onRunStateChange: (state: RunState) => void;
}) {
  const headline = loading
    ? "Connecting to Claude…"
    : `Handling ${openThreads ?? 0} live thread${openThreads === 1 ? "" : "s"} across ${propertiesWithOpen} propert${propertiesWithOpen === 1 ? "y" : "ies"}`;

  return (
    <section className="overflow-hidden rounded-md border border-border bg-[#0F0F0F] text-[#FAFAFA]">
      <div className="flex flex-wrap items-start gap-4 border-b border-[rgba(255,255,255,0.06)] px-6 py-5">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-sm bg-[#FF4D00] font-display text-[20px] font-bold text-[#111111]">
          L
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-eyebrow text-[rgba(255,255,255,0.6)]">
            <span className="h-[6px] w-[6px] rounded-full bg-[#10B981]" aria-hidden />
            LIRE Concierge · Claude-managed Agent
          </div>
          <h1 className="mt-1.5 font-display text-[26px] font-bold leading-tight tracking-tight text-[#FAFAFA]">
            {headline}
          </h1>
          <p className="mt-2 font-body text-[13px] leading-[1.5] text-[rgba(255,255,255,0.68)]">
            <span className="font-semibold text-[#FF4D00]">82%</span> resolved end-to-end this week ·{" "}
            <span className="text-[rgba(255,255,255,0.85)]">1m 14s</span> average first response · CSAT proxy{" "}
            <span className="text-[rgba(255,255,255,0.85)]">94</span>.
          </p>
        </div>
        <RunStateToggle value={runState} onChange={onRunStateChange} />
      </div>

      <div className="grid grid-cols-2 border-b border-[rgba(255,255,255,0.06)] md:grid-cols-4">
        <HeroStat label="Knowledge sources" value="7" suffix="of 8" />
        <HeroStat label="Indexed items" value="2,014" suffix="records" />
        <HeroStat label="Pending plays" value="2" suffix="to review" />
        <HeroStat label="Content gaps" value="3" suffix="questions" />
      </div>

      <div className="overflow-x-auto px-6 py-3 font-mono text-[11px] leading-[1.7] text-[rgba(255,255,255,0.58)]">
        <span className="mr-1 inline-block h-[10px] w-[2px] align-middle bg-[#FF4D00]" aria-hidden />
        <TickerSegment time="02:17" label="DISPATCHED" detail="Sentinel HVAC · ATL-02" />
        <TickerSegment time="02:14" label="REPLIED" detail="Marco Reyes via WhatsApp" />
        <TickerSegment time="01:48" label="LEARNED" detail="Marco prefers WhatsApp for urgent" />
        <TickerSegment time="01:02" label="SENT" detail="COI stage-3 · GLX-03" />
        <TickerSegment time="00:14" label="PAGED" detail="Avery — 'lawyer' in LIRE-4181" last />
      </div>
    </section>
  );
}

function TickerSegment({ time, label, detail, last }: { time: string; label: string; detail: string; last?: boolean }) {
  return (
    <span className="whitespace-nowrap">
      <span className="text-[rgba(255,255,255,0.4)]">{time}</span>{" "}
      <span className="text-[#FAFAFA]">{label}</span>{" "}
      <span className="text-[rgba(255,255,255,0.7)]">{detail}</span>
      {last ? null : <span className="mx-2 text-[rgba(255,255,255,0.3)]">·</span>}
    </span>
  );
}

function HeroStat({ label, value, suffix }: { label: string; value: string; suffix: string }) {
  return (
    <div className="border-r border-[rgba(255,255,255,0.06)] px-6 py-4 last:border-r-0">
      <div className="font-mono text-[10px] uppercase tracking-eyebrow text-[rgba(255,255,255,0.5)]">{label}</div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="font-mono text-[24px] font-medium leading-none text-[#FAFAFA]">{value}</span>
        <span className="font-body text-[11px] text-[rgba(255,255,255,0.55)]">{suffix}</span>
      </div>
    </div>
  );
}

function RunStateToggle({ value, onChange }: { value: RunState; onChange: (v: RunState) => void }) {
  const options: { key: RunState; label: string }[] = [
    { key: "live", label: "Live" },
    { key: "shadow", label: "Shadow" },
    { key: "paused", label: "Paused" },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="Concierge run mode"
      className="flex items-center gap-0 rounded-sm border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.04)] p-0.5"
    >
      {options.map((option) => {
        const active = option.key === value;
        return (
          <button
            key={option.key}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.key)}
            className={[
              "h-7 rounded-xs px-3 font-body text-[12px] font-medium transition-colors ease-ds duration-fast",
              active
                ? option.key === "live"
                  ? "bg-[#10B981] text-[#0A0A0A]"
                  : option.key === "shadow"
                    ? "bg-[#FAFAFA] text-[#0A0A0A]"
                    : "bg-[rgba(255,255,255,0.18)] text-[#FAFAFA]"
                : "text-[rgba(255,255,255,0.6)] hover:bg-[rgba(255,255,255,0.08)] hover:text-[#FAFAFA]",
            ].join(" ")}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function TabBar({ tab, onChange }: { tab: ConciergeTab; onChange: (tab: ConciergeTab) => void }) {
  return (
    <div role="tablist" aria-label="Concierge sections" className="flex gap-4 border-b border-border">
      {tabs.map((entry) => {
        const active = entry.key === tab;
        return (
          <button
            key={entry.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(entry.key)}
            className={[
              "relative pb-2.5 pt-1 font-body text-[13px] font-medium transition-colors ease-ds duration-fast",
              active ? "text-fg" : "text-fg-muted hover:text-fg",
            ].join(" ")}
          >
            {entry.label}
            {active ? <span className="absolute inset-x-0 -bottom-px h-[2px] bg-accent" /> : null}
          </button>
        );
      })}
    </div>
  );
}

function OverviewTab() {
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <AgentBriefCard />
      <div className="space-y-5">
        <Skills />
        <LiveActivityList />
      </div>
    </div>
  );
}

function AgentBriefCard() {
  return (
    <section className="rounded-md border border-border bg-surface p-5">
      <div className="eyebrow">How this works</div>
      <h2 className="mt-1 font-display text-[18px] font-bold tracking-tight text-fg">
        One Claude-managed Agent, many skills
      </h2>
      <p className="mt-2 font-body text-[13px] leading-[1.55] text-fg-muted">
        The Concierge is a single Anthropic Managed Agent — prompt, model, and tools live in Claude Console. LIRE
        routes inbound threads into it, surfaces its replies inside the inbox, and escalates when confidence is low.
      </p>
      <p className="mt-2 font-body text-[13px] leading-[1.55] text-fg-muted">
        Edit the brain (prompt, tools, skills, model) in Claude Console. Change how LIRE routes to it —
        autonomy ceiling, channel access, audiences — in{" "}
        <Link href="/settings/ai-automation">
          <a className="font-semibold text-fg underline-offset-2 hover:underline">AI &amp; Automation settings</a>
        </Link>
        .
      </p>
    </section>
  );
}

function Skills() {
  const skills = [
    {
      name: "Dispatcher",
      description: "Triages faults, selects vendors, confirms ETAs.",
      autoPct: 94,
    },
    {
      name: "Compliance Officer",
      description: "Tracks leases, COIs, permits; runs 4-stage escalation.",
      autoPct: 88,
    },
    {
      name: "Leasing Assistant",
      description: "Drafts renewals, gathers signatures, never negotiates price.",
      autoPct: 41,
    },
  ];
  return (
    <section className="rounded-md border border-border bg-surface p-4">
      <div className="eyebrow">Skills</div>
      <h2 className="mt-1 font-display text-[16px] font-bold tracking-tight text-fg">
        Specialists within one Concierge
      </h2>
      <div className="mt-3 space-y-3">
        {skills.map((skill) => (
          <div key={skill.name}>
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="font-body text-[13px] font-semibold text-fg">{skill.name}</div>
                <div className="font-body text-[12px] leading-[1.4] text-fg-muted">{skill.description}</div>
              </div>
              <div className="shrink-0 text-right">
                <div className="font-mono text-[13px] font-semibold text-fg">{skill.autoPct}%</div>
                <div className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-subtle">Auto</div>
              </div>
            </div>
            <div className="mt-1.5 h-[4px] w-full overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-accent" style={{ width: `${skill.autoPct}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function LiveActivityList() {
  const items = [
    { time: "02:17", tone: "accent", text: "Dispatched Sentinel HVAC to ATL-02 · Dock 4" },
    { time: "02:14", tone: "neutral", text: "Replied to Marco Reyes via WhatsApp · 42s" },
    { time: "01:48", tone: "success", text: "Captured preference: Marco prefers WhatsApp for urgent" },
    { time: "01:02", tone: "accent", text: "Sent COI stage-3 reminder · GLX-03" },
    { time: "00:14", tone: "warning", text: "Paged Avery — 'lawyer' mentioned in LIRE-4181" },
  ] as const;
  const dotClass: Record<(typeof items)[number]["tone"], string> = {
    accent: "bg-accent",
    neutral: "bg-fg",
    success: "bg-success",
    warning: "bg-[rgb(180,83,9)]",
  };
  return (
    <section className="rounded-md border border-border bg-surface p-4">
      <div className="eyebrow">Live activity</div>
      <ul className="mt-3 space-y-2.5">
        {items.map((item) => (
          <li key={item.time + item.text} className="flex items-center gap-3">
            <span className="font-mono text-[11px] tracking-[0.02em] text-fg-subtle w-10 shrink-0">{item.time}</span>
            <span className={["h-[6px] w-[6px] shrink-0 rounded-full", dotClass[item.tone]].join(" ")} />
            <span className="font-body text-[12.5px] text-fg">{item.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PlaceholderTab({ tab }: { tab: ConciergeTab }) {
  const entry = tabs.find((t) => t.key === tab);
  if (!entry) return null;
  const Icon = entry.icon;
  return (
    <div className="rounded-md border border-dashed border-border bg-surface-2 p-8 text-center">
      <div className="mx-auto grid h-10 w-10 place-items-center rounded-sm bg-surface text-fg-muted">
        <Icon className="h-5 w-5" />
      </div>
      <h2 className="mt-3 font-display text-[16px] font-bold tracking-tight text-fg">{entry.label}</h2>
      <p className="mx-auto mt-1 max-w-md font-body text-[12.5px] leading-[1.5] text-fg-muted">
        The {entry.label.toLowerCase()} surface for the Claude-managed Concierge agent is in progress. Wiring in the
        next phase.
      </p>
    </div>
  );
}

