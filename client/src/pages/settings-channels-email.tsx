import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Mail } from "lucide-react";
import { SettingsLayout } from "../components/workspace/settings-layout";
import { Card, Button, Input, Textarea, Select, FieldLabel } from "../components/ui";
import { channelsApi, type EmailChannelConfig } from "../lib/channels";

const PROVIDER_OPTIONS: ReadonlyArray<{ value: EmailChannelConfig["provider"]; label: string; helper: string }> = [
  { value: "none", label: "Not connected", helper: "Outbound email disabled. Form fields stay editable for setup." },
  { value: "sendgrid", label: "SendGrid", helper: "Transactional sending via SendGrid API. Add API key in env." },
  { value: "ses", label: "Amazon SES", helper: "AWS SES via configured IAM credentials. Set region in env." },
  { value: "smtp", label: "Custom SMTP", helper: "Generic SMTP relay. Host + credentials configured server-side." },
];

interface FormState {
  enabled: boolean;
  provider: EmailChannelConfig["provider"];
  fromAddress: string;
  fromName: string;
  replyToAddress: string;
  forwardingAddress: string;
  signatureHtml: string;
}

const EMPTY_FORM: FormState = {
  enabled: false,
  provider: "none",
  fromAddress: "",
  fromName: "",
  replyToAddress: "",
  forwardingAddress: "",
  signatureHtml: "",
};

function toForm(enabled: boolean, config: EmailChannelConfig): FormState {
  return {
    enabled,
    provider: config.provider,
    fromAddress: config.fromAddress ?? "",
    fromName: config.fromName ?? "",
    replyToAddress: config.replyToAddress ?? "",
    forwardingAddress: config.forwardingAddress ?? "",
    signatureHtml: config.signatureHtml ?? "",
  };
}

function toPayload(form: FormState): EmailChannelConfig {
  return {
    provider: form.provider,
    fromAddress: form.fromAddress.trim() || null,
    fromName: form.fromName.trim() || null,
    replyToAddress: form.replyToAddress.trim() || null,
    forwardingAddress: form.forwardingAddress.trim() || null,
    signatureHtml: form.signatureHtml.trim() || null,
  };
}

export default function SettingsChannelsEmailPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["channel-config", "email"],
    queryFn: () => channelsApi.getConfig<EmailChannelConfig>("email"),
  });

  useEffect(() => {
    if (data) setForm(toForm(data.enabled, data.config));
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      channelsApi.saveConfig<EmailChannelConfig>("email", {
        enabled: form.enabled,
        config: toPayload(form),
      }),
    onSuccess: (resp) => {
      qc.setQueryData(["channel-config", "email"], resp);
      setSaveError(null);
      setSavedAt(Date.now());
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Save failed";
      setSaveError(message);
    },
  });

  const providerHelper = PROVIDER_OPTIONS.find((p) => p.value === form.provider)?.helper ?? "";

  return (
    <SettingsLayout title="Email" eyebrow="Workspace / Settings / Channels">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card padding="md">
          <header className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-xs bg-surface-2 text-fg-muted">
              <Mail className="h-4 w-4" />
            </span>
            <div>
              <div className="eyebrow">Email channel</div>
              <div className="mt-0.5 font-display text-[18px] font-semibold tracking-tight text-fg">
                Inbound forwarding and outbound identity
              </div>
            </div>
          </header>

          {isLoading ? (
            <p className="mt-6 font-body text-[13px] text-fg-muted">Loading…</p>
          ) : isError ? (
            <p className="mt-6 font-body text-[13px] text-error">
              {error instanceof Error ? error.message : "Failed to load config"}
            </p>
          ) : (
            <form
              className="mt-5 space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                save.mutate();
              }}
            >
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded-xs border-border accent-accent"
                  checked={form.enabled}
                  onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                />
                <span>
                  <span className="block font-body text-[13px] font-medium text-fg">Email channel enabled</span>
                  <span className="mt-0.5 block font-body text-[12.5px] text-fg-muted">
                    Disabling hides the channel from inbox routing without losing the configuration.
                  </span>
                </span>
              </label>

              <div>
                <FieldLabel>Provider</FieldLabel>
                <Select
                  value={form.provider}
                  onChange={(e) =>
                    setForm({ ...form, provider: e.target.value as EmailChannelConfig["provider"] })
                  }
                >
                  {PROVIDER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
                {providerHelper ? (
                  <p className="mt-1.5 font-body text-[12px] text-fg-muted">{providerHelper}</p>
                ) : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel>From address</FieldLabel>
                  <Input
                    type="email"
                    placeholder="support@yourdomain.com"
                    value={form.fromAddress}
                    onChange={(e) => setForm({ ...form, fromAddress: e.target.value })}
                  />
                </div>
                <div>
                  <FieldLabel>From name</FieldLabel>
                  <Input
                    type="text"
                    placeholder="LIRE Help"
                    value={form.fromName}
                    onChange={(e) => setForm({ ...form, fromName: e.target.value })}
                  />
                </div>
                <div>
                  <FieldLabel>Reply-to address</FieldLabel>
                  <Input
                    type="email"
                    placeholder="ops@yourdomain.com"
                    value={form.replyToAddress}
                    onChange={(e) => setForm({ ...form, replyToAddress: e.target.value })}
                  />
                </div>
                <div>
                  <FieldLabel>Forwarding address</FieldLabel>
                  <Input
                    type="email"
                    placeholder="tenant-name@inbound.lire.help"
                    value={form.forwardingAddress}
                    onChange={(e) => setForm({ ...form, forwardingAddress: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <FieldLabel>Signature (HTML allowed)</FieldLabel>
                <Textarea
                  rows={4}
                  placeholder="— The team at Acme Property"
                  value={form.signatureHtml}
                  onChange={(e) => setForm({ ...form, signatureHtml: e.target.value })}
                />
              </div>

              <div className="flex items-center gap-3 pt-1">
                <Button type="submit" loading={save.isPending}>
                  Save changes
                </Button>
                {savedAt && !save.isPending ? (
                  <span className="inline-flex items-center gap-1 font-body text-[12.5px] text-fg-muted">
                    <CheckCircle2 className="h-3.5 w-3.5 text-success" /> Saved
                  </span>
                ) : null}
                {saveError ? (
                  <span className="font-body text-[12.5px] text-error">{saveError}</span>
                ) : null}
              </div>
            </form>
          )}
        </Card>

        <Card variant="dashed" padding="md" as="aside">
          <div className="eyebrow">What's wired today</div>
          <p className="mt-2 font-body text-[12.5px] leading-[1.55] text-fg-muted">
            This form persists per-tenant email configuration to the <code>channel_configs</code> table. Outbound
            send through the selected provider and inbound forwarding ingestion are the next slice — credentials
            live in env vars and are read by the send/receive workers when they ship.
          </p>
        </Card>
      </div>
    </SettingsLayout>
  );
}
