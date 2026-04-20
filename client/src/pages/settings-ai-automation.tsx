import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ExternalLink,
  Mail,
  MessageCircle,
  Phone,
  ShieldCheck,
  Sparkles,
  Video,
  type LucideIcon,
} from "lucide-react";
import { SettingsLayout } from "../components/workspace/settings-layout";
import { Badge, Card } from "../components/ui";
import { ErrorBoundary } from "../components/ui/error-boundary";
import { conciergeApi } from "../lib/helpdesk";
import type {
  ConciergeAgentSummary,
  ConciergeSettings,
  ConciergeSettingsPatch,
} from "../lib/helpdesk";

export default function SettingsAiAutomationPage() {
  return (
    <SettingsLayout title="AI & Automation" eyebrow="Workspace / Settings">
      <div className="space-y-5">
        <ErrorBoundary boundary="ConciergeAgentCard">
          <ConciergeAgentCard />
        </ErrorBoundary>
        <ErrorBoundary boundary="LireControlsCard">
          <LireControlsCard />
        </ErrorBoundary>
      </div>
    </SettingsLayout>
  );
}

function ConciergeAgentCard() {
  const agentQuery = useQuery({
    queryKey: ["concierge", "agent"],
    queryFn: conciergeApi.getAgent,
    staleTime: 60_000,
  });

  if (agentQuery.isLoading) {
    return (
      <Card padding="md">
        <p className="font-body text-[13px] text-fg-muted">Loading concierge agent from Anthropic…</p>
      </Card>
    );
  }

  if (agentQuery.error instanceof Error) {
    return (
      <Card padding="md">
        <div className="flex items-center gap-2.5 text-error">
          <AlertTriangle className="h-4 w-4" />
          <p className="font-body text-[13px] font-semibold">Unable to reach Anthropic</p>
        </div>
        <p className="mt-2 font-body text-[13px] text-fg-muted">{agentQuery.error.message}</p>
      </Card>
    );
  }

  const agent = agentQuery.data;
  if (!agent || !agent.configured) {
    return <UnconfiguredCard />;
  }

  return <ConfiguredAgentCard agent={agent} />;
}

function UnconfiguredCard() {
  return (
    <Card padding="md">
      <div className="flex items-center gap-2.5">
        <span className="grid h-8 w-8 place-items-center rounded-xs bg-surface-2 text-fg-muted">
          <Sparkles className="h-4 w-4" />
        </span>
        <div>
          <div className="eyebrow">Concierge agent</div>
          <div className="mt-0.5 font-display text-[18px] font-semibold tracking-tight text-fg">
            Claude-managed Agent not linked
          </div>
        </div>
      </div>
      <p className="mt-3 font-body text-[13px] leading-[1.55] text-fg-muted">
        Set <code className="rounded-xs bg-surface-2 px-1 font-mono text-[11.5px]">ANTHROPIC_API_KEY</code> and{" "}
        <code className="rounded-xs bg-surface-2 px-1 font-mono text-[11.5px]">CONCIERGE_AGENT_ID</code> in the server
        environment, then run <code className="rounded-xs bg-surface-2 px-1 font-mono text-[11.5px]">npm run concierge:setup</code>.
        Once wired, this card reflects the live agent config from Anthropic.
      </p>
    </Card>
  );
}

// Server types say these are strings, but the field flows through Anthropic's
// SDK and our mapping layer — belt-and-suspenders coerce to strings at render
// time so one shape change upstream can't crash the whole settings page.
function asStr(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function ConfiguredAgentCard({ agent }: { agent: ConciergeAgentSummary }) {
  const [promptOpen, setPromptOpen] = useState(false);
  const id = asStr(agent.id);
  const name = asStr(agent.name, "LIRE Help concierge");
  const version = asStr(agent.version);
  const model = asStr(agent.model);
  const systemPromptPreview = asStr(agent.systemPromptPreview);
  const systemPromptFull = asStr(agent.systemPromptFull);
  const consoleUrl = typeof agent.consoleUrl === "string" ? agent.consoleUrl : null;
  const toolsCount = typeof agent.toolsCount === "number" ? agent.toolsCount : 0;
  const skillsCount = typeof agent.skillsCount === "number" ? agent.skillsCount : 0;

  return (
    <Card padding="md">
      <div className="flex items-start gap-3">
        <span className="grid h-8 w-8 place-items-center rounded-xs bg-fg text-accent">
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="eyebrow text-fg-muted">Claude-managed Agent</div>
            <Badge tone="success" size="sm">
              Active
            </Badge>
          </div>
          <h2 className="mt-0.5 font-display text-[18px] font-semibold tracking-tight text-fg">{name}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[11px] text-fg-subtle">
            <span>{id}</span>
            {version ? <span>· v{version}</span> : null}
            {model ? <span>· {model}</span> : null}
          </div>
        </div>
        {consoleUrl ? (
          <a
            href={consoleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-border bg-surface px-2.5 font-body text-[12px] font-medium text-fg transition-colors ease-ds duration-fast hover:bg-surface-2"
          >
            Open in Claude Console
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryStat label="Model" value={model || "—"} />
        <SummaryStat label="Version" value={version ? `v${version}` : "—"} />
        <SummaryStat label="Custom tools" value={String(toolsCount)} />
        <SummaryStat label="Skills" value={String(skillsCount)} />
      </div>

      <div className="mt-4 rounded-sm border border-border bg-surface-2 p-3">
        <div className="flex items-center gap-2">
          <div className="eyebrow text-fg-muted">System prompt</div>
          {systemPromptFull.length > systemPromptPreview.length ? (
            <button
              type="button"
              onClick={() => setPromptOpen((open) => !open)}
              className="ml-auto font-body text-[11.5px] font-medium text-fg-muted hover:text-fg"
            >
              {promptOpen ? "Collapse" : "Expand"}
            </button>
          ) : null}
        </div>
        <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-[12px] leading-[1.55] text-fg">
          {promptOpen ? systemPromptFull : systemPromptPreview}
          {!promptOpen && systemPromptFull.length > systemPromptPreview.length ? "…" : ""}
        </pre>
      </div>

      <p className="mt-3 font-body text-[12px] leading-[1.5] text-fg-muted">
        Prompt, model, tools, and skills are edited in Claude Console — that&rsquo;s the single source of truth for
        the agent brain. LIRE reflects the published version and routes traffic into it.
      </p>
    </Card>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-border bg-surface-2 px-3 py-2.5">
      <div className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-subtle">{label}</div>
      <div className="mt-1 font-mono text-[13px] font-medium text-fg">{value}</div>
    </div>
  );
}

function LireControlsCard() {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({
    queryKey: ["concierge", "settings"],
    queryFn: conciergeApi.getSettings,
  });

  // Local draft state so the autonomy slider is responsive without debouncing
  // every drag tick to the backend. The slider commits on release (onPointerUp
  // / onKeyUp); channel pills commit immediately since they're discrete.
  const [draft, setDraft] = useState<ConciergeSettings | null>(null);
  useEffect(() => {
    if (settingsQuery.data) setDraft(settingsQuery.data);
  }, [settingsQuery.data]);

  const mutation = useMutation({
    mutationFn: (patch: ConciergeSettingsPatch) => conciergeApi.updateSettings(patch),
    onSuccess: (next) => {
      queryClient.setQueryData(["concierge", "settings"], next);
      setDraft(next);
    },
  });

  const working = draft ?? settingsQuery.data ?? null;
  const activeChannels = useMemo(() => {
    if (!working) return 0;
    return Object.values(working.channels).filter(Boolean).length;
  }, [working]);

  const commitAutonomy = (pct: number) => {
    if (!working || pct === working.autonomyCeilingPct) return;
    mutation.mutate({ autonomyCeilingPct: pct });
  };

  const toggleChannel = (key: keyof ConciergeSettings["channels"]) => {
    if (!working) return;
    const next = !working.channels[key];
    setDraft({ ...working, channels: { ...working.channels, [key]: next } });
    mutation.mutate({ channels: { [key]: next } });
  };

  return (
    <Card padding="md">
      <div className="flex items-center gap-2.5">
        <span className="grid h-8 w-8 place-items-center rounded-xs bg-surface-2 text-fg-muted">
          <ShieldCheck className="h-4 w-4" />
        </span>
        <div className="flex-1">
          <div className="eyebrow">LIRE controls</div>
          <div className="mt-0.5 font-display text-[18px] font-semibold tracking-tight text-fg">
            How the Concierge connects with your world
          </div>
        </div>
        {mutation.isPending ? (
          <span className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-subtle">Saving…</span>
        ) : mutation.isSuccess ? (
          <span className="font-mono text-[10px] uppercase tracking-eyebrow text-success">Saved</span>
        ) : null}
      </div>

      {settingsQuery.isLoading || !working ? (
        <p className="mt-4 font-body text-[13px] text-fg-muted">Loading settings…</p>
      ) : (
        <>
          <div className="mt-5">
            <div className="flex items-center justify-between">
              <div className="eyebrow text-fg-subtle">Autonomy ceiling</div>
              <span className="font-mono text-[13px] font-semibold text-fg">{working.autonomyCeilingPct}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={working.autonomyCeilingPct}
              onChange={(event) =>
                setDraft({ ...working, autonomyCeilingPct: Number(event.target.value) })
              }
              onPointerUp={() => commitAutonomy(working.autonomyCeilingPct)}
              onKeyUp={(event) => {
                if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                  commitAutonomy(working.autonomyCeilingPct);
                }
              }}
              className="mt-2 w-full accent-[var(--accent,#ff4d00)]"
            />
            <p className="mt-1.5 font-body text-[12px] text-fg-muted">
              Above this threshold, Concierge acts. Below, it drafts for human review.
            </p>
          </div>

          <div className="mt-5">
            <div className="eyebrow text-fg-subtle">Channels it can speak on</div>
            <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
              <ChannelPill icon={Mail} label="Email" enabled={working.channels.email} onClick={() => toggleChannel("email")} />
              <ChannelPill icon={MessageCircle} label="WhatsApp" enabled={working.channels.whatsapp} onClick={() => toggleChannel("whatsapp")} />
              <ChannelPill icon={Phone} label="SMS" enabled={working.channels.sms} onClick={() => toggleChannel("sms")} />
              <ChannelPill icon={Video} label="Zoom" enabled={working.channels.zoom} onClick={() => toggleChannel("zoom")} />
            </div>
            <p className="mt-2 font-body text-[12px] text-fg-muted">
              Currently active on <span className="font-semibold text-fg">{activeChannels}</span> channel
              {activeChannels === 1 ? "" : "s"}.
            </p>
            {mutation.error instanceof Error ? (
              <p className="mt-2 font-body text-[12px] text-error">{mutation.error.message}</p>
            ) : null}
          </div>

          <div className="mt-5">
            <div className="eyebrow text-fg-subtle">Who can reach it directly</div>
            <div className="mt-2 divide-y divide-border">
              <ReachRow name="All tenants" description="Can reach Concierge directly via any channel" tone="direct" />
              <ReachRow name="Atlas Cold Storage · After-hours only" description="" tone="direct" />
              <ReachRow
                name="Northstar Logistics · VP contacts"
                description="Always route to a human first"
                tone="human_first"
              />
            </div>
            <p className="mt-2 font-body text-[11.5px] italic text-fg-muted">
              Audience rules are design-only for now — persistence lands in the next phase.
            </p>
          </div>
        </>
      )}
    </Card>
  );
}

function ChannelPill({
  icon: Icon,
  label,
  enabled,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  enabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={enabled}
      className={[
        "flex items-center justify-between rounded-sm border px-3 py-2.5 text-left font-body text-[12px] transition-colors ease-ds duration-fast",
        enabled
          ? "border-fg bg-fg text-surface"
          : "border-border bg-surface-2 text-fg-muted hover:bg-surface hover:text-fg",
      ].join(" ")}
    >
      <span className="inline-flex items-center gap-2 font-medium">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
      <span className="font-mono text-[10px] uppercase tracking-eyebrow">{enabled ? "On" : "Off"}</span>
    </button>
  );
}

function ReachRow({
  name,
  description,
  tone,
}: {
  name: string;
  description: string;
  tone: "direct" | "human_first";
}) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="grid h-7 w-7 place-items-center rounded-full border border-border bg-surface-2">
        <Sparkles className="h-3 w-3 text-fg-muted" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-body text-[13px] font-semibold text-fg">{name}</div>
        {description ? <div className="font-body text-[12px] text-fg-muted">{description}</div> : null}
      </div>
      {tone === "direct" ? (
        <Badge tone="success" size="sm">
          Direct
        </Badge>
      ) : (
        <Badge tone="warning" size="sm">
          Human first
        </Badge>
      )}
    </div>
  );
}
