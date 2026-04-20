import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db.js";
import {
  channelConfigs,
  CHANNEL_TYPES,
  type ChannelType,
  type EmailChannelConfig,
} from "../shared/schema.js";
import { requireStaffRole } from "./middleware/auth.js";

const router = Router();

const READ_ROLES = ["superadmin", "owner", "manager", "staff", "readonly"] as const;
const WRITE_ROLES = ["superadmin", "owner", "manager"] as const;

// Default config skeletons returned when a tenant has never saved a config
// for a given channel. Keeping the empty shape on the wire lets the form
// render without a separate "not configured" code path.
const DEFAULT_CONFIG: Record<ChannelType, Record<string, unknown>> = {
  email: {
    provider: "none",
    fromAddress: null,
    fromName: null,
    replyToAddress: null,
    forwardingAddress: null,
    signatureHtml: null,
  } satisfies EmailChannelConfig,
  phone: {},
  whatsapp: {},
  switch: {},
  slack: {},
  messenger: {},
};

const emailConfigSchema = z.object({
  provider: z.enum(["sendgrid", "smtp", "ses", "none"]),
  fromAddress: z.string().email().max(254).nullable(),
  fromName: z.string().max(120).nullable(),
  replyToAddress: z.string().email().max(254).nullable(),
  forwardingAddress: z.string().email().max(254).nullable(),
  signatureHtml: z.string().max(8_000).nullable(),
}) satisfies z.ZodType<EmailChannelConfig>;

const PER_CHANNEL_SCHEMA: Partial<Record<ChannelType, z.ZodType<Record<string, unknown>>>> = {
  email: emailConfigSchema as unknown as z.ZodType<Record<string, unknown>>,
};

const patchBody = z.object({
  enabled: z.boolean().optional(),
  config: z.record(z.unknown()).optional(),
});

function parseChannelType(raw: string | undefined): ChannelType | null {
  if (!raw) return null;
  return (CHANNEL_TYPES as readonly string[]).includes(raw) ? (raw as ChannelType) : null;
}

function tenantIdFromSession(req: import("express").Request): string | null {
  const sess = req.session as any;
  const id = sess?.staffTenantId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

router.get("/:type/config", requireStaffRole(...READ_ROLES), async (req, res) => {
  try {
    const channelType = parseChannelType(typeof req.params.type === "string" ? req.params.type : undefined);
    if (!channelType) return res.status(404).json({ message: "Unknown channel" });

    const tenantId = tenantIdFromSession(req);
    if (!tenantId) return res.status(400).json({ message: "Session has no tenant" });

    const [row] = await db
      .select()
      .from(channelConfigs)
      .where(and(eq(channelConfigs.tenantId, tenantId), eq(channelConfigs.channelType, channelType)))
      .limit(1);

    if (!row) {
      return res.json({
        channelType,
        enabled: false,
        config: DEFAULT_CONFIG[channelType],
        updatedAt: null,
      });
    }

    res.json({
      channelType,
      enabled: row.enabled,
      config: { ...DEFAULT_CONFIG[channelType], ...(row.configJson ?? {}) },
      updatedAt: row.updatedAt,
    });
  } catch (err) {
    console.error("[channels get]", err);
    res.status(500).json({ message: "Error fetching channel config" });
  }
});

router.patch("/:type/config", requireStaffRole(...WRITE_ROLES), async (req, res) => {
  try {
    const channelType = parseChannelType(typeof req.params.type === "string" ? req.params.type : undefined);
    if (!channelType) return res.status(404).json({ message: "Unknown channel" });

    const tenantId = tenantIdFromSession(req);
    if (!tenantId) return res.status(400).json({ message: "Session has no tenant" });

    const parsed = patchBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid payload", issues: parsed.error.issues });
    }

    let validatedConfig: Record<string, unknown> | undefined;
    if (parsed.data.config !== undefined) {
      const channelSchema = PER_CHANNEL_SCHEMA[channelType];
      if (channelSchema) {
        const configParsed = channelSchema.safeParse(parsed.data.config);
        if (!configParsed.success) {
          return res.status(400).json({ message: "Invalid channel config", issues: configParsed.error.issues });
        }
        validatedConfig = configParsed.data;
      } else {
        // Channels without a schema yet store raw — replaced once we add their UI.
        validatedConfig = parsed.data.config;
      }
    }

    const sess = req.session as any;
    const staffId: string | undefined = sess?.staffId;

    const now = new Date();
    const [existing] = await db
      .select({ id: channelConfigs.id, configJson: channelConfigs.configJson })
      .from(channelConfigs)
      .where(and(eq(channelConfigs.tenantId, tenantId), eq(channelConfigs.channelType, channelType)))
      .limit(1);

    let saved;
    if (existing) {
      const updates: Record<string, unknown> = { updatedAt: now, updatedByStaffId: staffId ?? null };
      if (parsed.data.enabled !== undefined) updates.enabled = parsed.data.enabled;
      if (validatedConfig !== undefined) {
        updates.configJson = { ...(existing.configJson ?? {}), ...validatedConfig };
      }
      [saved] = await db
        .update(channelConfigs)
        .set(updates)
        .where(eq(channelConfigs.id, existing.id))
        .returning();
    } else {
      [saved] = await db
        .insert(channelConfigs)
        .values({
          tenantId,
          channelType,
          enabled: parsed.data.enabled ?? false,
          configJson: validatedConfig ?? {},
          updatedByStaffId: staffId ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
    }

    res.json({
      channelType,
      enabled: saved.enabled,
      config: { ...DEFAULT_CONFIG[channelType], ...(saved.configJson ?? {}) },
      updatedAt: saved.updatedAt,
    });
  } catch (err) {
    console.error("[channels patch]", err);
    res.status(500).json({ message: "Error saving channel config" });
  }
});

export default router;
