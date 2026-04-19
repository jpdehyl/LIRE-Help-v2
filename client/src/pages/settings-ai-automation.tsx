import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { conciergeApi } from "../lib/helpdesk";
import type { ConciergeAgentSummary } from "../lib/helpdesk";

export default function SettingsAiAutomationPage() {
  return (
    <SettingsLayout title="AI & Automation" eyebrow="Workspace / Settings">
      <div className="space-y-5">
        <ConciergeAgentCard />
        <LireControlsCard />
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

function ConfiguredAgentCard({ agent }: { agent: ConciergeAgentSummary }) {
  const [promptOpen, setPromptOpen] = useState(false);
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
          <h2 className="mt-0.5 font-display text-[18px] font-semibold tracking-tight text-fg">{agent.name}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[11px] text-fg-subtle">
            <span>{agent.id}</span>
            {agent.version ? <span>· v{agent.version}</span> : null}
            {agent.model ? <span>· {agent.model}</span> : null}
          </div>
        </div>
        {agent.consoleUrl ? (
          <a
            href={agent.consoleUrl}
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
        <SummaryStat label="Model" value={agent.model || "—"} />
        <SummaryStat label="Version" value={agent.version ? `v${agent.version}` : "—"} />
        <SummaryStat label="Custom tools" value={String(agent.toolsCount)} />
        <SummaryStat label="Skills" value={String(agent.skillsCount)} />
      </div>

      <div className="mt-4 rounded-sm border border-border bg-surface-2 p-3">
        <div className="flex items-center gap-2">
          <div className="eyebrow text-fg-muted">System prompt</div>
          {agent.systemPromptFull.length > agent.systemPromptPreview.length ? (
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
          {promptOpen ? agent.systemPromptFull : agent.systemPromptPreview}
          {!promptOpen && agent.systemPromptFull.length > agent.systemPromptPreview.length ? "…" : ""}
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
  // Persistence pending — these controls live in LIRE (not Claude Console),
  // but the backend contract for autonomy/channels/audiences isn't wired yet.
  // For now state is in-memory so operators can see the shape of the surface.
  const [autonomyPct, setAutonomyPct] = useState(82);
  const [channels, setChannels] = useState<Record<string, boolean>>({
    email: true,
    whatsapp: true,
    sms: true,
    zoom: false,
  });
  const activeChannels = useMemo(() => Object.values(channels).filter(Boolean).length, [channels]);
  const toggle = (key: string) => setChannels((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <Card padding="md">
      <div className="flex items-center gap-2.5">
        <span className="grid h-8 w-8 place-items-center rounded-xs bg-surface-2 text-fg-muted">
          <ShieldCheck className="h-4 w-4" />
        </span>
        <div>
          <div className="eyebrow">LIRE controls</div>
          <div className="mt-0.5 font-display text-[18px] font-semibold tracking-tight text-fg">
            How the Concierge connects with your world
          </div>
        </div>
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between">
          <div className="eyebrow text-fg-subtle">Autonomy ceiling</div>
          <span className="font-mono text-[13px] font-semibold text-fg">{autonomyPct}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={autonomyPct}
          onChange={(event) => setAutonomyPct(Number(event.target.value))}
          className="mt-2 w-full accent-[var(--accent,#ff4d00)]"
        />
        <p className="mt-1.5 font-body text-[12px] text-fg-muted">
          Above this threshold, Concierge acts. Below, it drafts for human review.
        </p>
      </div>

      <div className="mt-5">
        <div className="eyebrow text-fg-subtle">Channels it can speak on</div>
        <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
          <ChannelPill icon={Mail} label="Email" enabled={channels.email} onClick={() => toggle("email")} />
          <ChannelPill icon={MessageCircle} label="WhatsApp" enabled={channels.whatsapp} onClick={() => toggle("whatsapp")} />
          <ChannelPill icon={Phone} label="SMS" enabled={channels.sms} onClick={() => toggle("sms")} />
          <ChannelPill icon={Video} label="Zoom" enabled={channels.zoom} onClick={() => toggle("zoom")} />
        </div>
        <p className="mt-2 font-body text-[12px] text-fg-muted">
          Currently active on <span className="font-semibold text-fg">{activeChannels}</span> channel
          {activeChannels === 1 ? "" : "s"}.
        </p>
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
      </div>
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
