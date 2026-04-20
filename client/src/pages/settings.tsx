import {
  AlertTriangle,
  ArrowRightLeft,
  BarChart3,
  Clock,
  CreditCard,
  Hash,
  Languages,
  LayoutGrid,
  Mail,
  MessageCircle,
  MessageSquare,
  Phone,
  ShieldCheck,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Link } from "wouter";
import { SettingsLayout } from "../components/workspace/settings-layout";
import { Card } from "../components/ui";

type CardEntry = {
  icon: LucideIcon;
  title: string;
  description: string;
  href: string;
  warning?: boolean;
};

type Group = {
  title: string;
  cards: readonly CardEntry[];
};

const groups: readonly Group[] = [
  {
    title: "Workspace",
    cards: [
      {
        icon: LayoutGrid,
        title: "General",
        description: "Set your workspace name, time zone, languages, and more.",
        href: "/settings/workspace/general",
      },
      {
        icon: Users,
        title: "Teammates",
        description: "Manage or invite teammates and see all activity logs.",
        href: "/settings/workspace/teammates",
      },
      {
        icon: Clock,
        title: "Office hours",
        description: "Choose your office hours to manage tenant expectations.",
        href: "/settings/workspace/office-hours",
      },
      {
        icon: Sparkles,
        title: "Brands",
        description: "Set up and manage your brands.",
        href: "/settings/workspace/brands",
      },
      {
        icon: ShieldCheck,
        title: "Security",
        description: "Configure all security settings for your workspace and data.",
        href: "/settings/workspace/security",
        warning: true,
      },
      {
        icon: Languages,
        title: "Multilingual",
        description: "Set up and manage your multilingual settings.",
        href: "/settings/workspace/multilingual",
      },
    ],
  },
  {
    title: "Subscription",
    cards: [
      {
        icon: CreditCard,
        title: "Billing",
        description: "Manage your subscription and payment details.",
        href: "/settings/subscription/billing",
      },
      {
        icon: BarChart3,
        title: "Usage",
        description: "View your billed usage and set usage alerts and limits.",
        href: "/settings/subscription/usage",
      },
    ],
  },
  {
    title: "Channels",
    cards: [
      {
        icon: MessageSquare,
        title: "Messenger",
        description: "Install and customize your messenger on web and mobile.",
        href: "/settings/channels/messenger",
      },
      {
        icon: Mail,
        title: "Email",
        description: "Manage forwarding, domains, and customization.",
        href: "/settings/channels/email",
      },
      {
        icon: Phone,
        title: "Phone",
        description: "Set up and manage phone and messenger calls.",
        href: "/settings/channels/phone",
      },
      {
        icon: MessageCircle,
        title: "WhatsApp",
        description: "Install and configure WhatsApp messages from your inbox.",
        href: "/settings/channels/whatsapp",
      },
      {
        icon: ArrowRightLeft,
        title: "Switch",
        description: "Move tenants from phone to chat conversations.",
        href: "/settings/channels/switch",
      },
      {
        icon: Hash,
        title: "Slack",
        description: "Install and configure Slack messages from your inbox.",
        href: "/settings/channels/slack",
      },
    ],
  },
];

function SettingsTile({ entry }: { entry: CardEntry }) {
  const Icon = entry.icon;
  return (
    <Link href={entry.href}>
      <a className="block h-full">
        <Card padding="md" interactive className="h-full">
          <div className="flex items-start gap-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xs bg-surface-2 text-fg-muted">
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="font-body text-[13px] font-semibold text-fg">{entry.title}</p>
                {entry.warning ? (
                  <AlertTriangle
                    className="h-3.5 w-3.5 text-warning"
                    aria-label="Attention required"
                  />
                ) : null}
              </div>
              <p className="mt-1 font-body text-[12.5px] leading-[1.55] text-fg-muted">
                {entry.description}
              </p>
            </div>
          </div>
        </Card>
      </a>
    </Link>
  );
}

export default function SettingsPage() {
  return (
    <SettingsLayout title="Home" eyebrow="Operations / Settings">
      <div className="space-y-7">
        {groups.map((group) => (
          <section key={group.title}>
            <h2 className="mb-3 font-display text-[15px] font-semibold tracking-tight text-fg">
              {group.title}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {group.cards.map((card) => (
                <SettingsTile key={card.title} entry={card} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </SettingsLayout>
  );
}
