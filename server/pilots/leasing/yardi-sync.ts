import { and, eq } from "drizzle-orm";
import { db } from "../../db.js";
import { units } from "../../../shared/schema.js";

// ─────────────────────────────────────────────────────────────────────────────
// Yardi read sync — Pilot A-F1.
//
// The real Yardi API integration is a swap-in at `YardiClient.fetchUnits()`.
// For the pilot's early weeks we run this against a fixture-backed stub so UI
// and downstream features can develop in parallel with IT's API-credential
// issuance.
//
// When Berkeley issues live creds, implement the `LiveYardiClient` branch
// against their real endpoint. Everything else stays the same.
// ─────────────────────────────────────────────────────────────────────────────

export type YardiUnitDto = {
  yardiUnitId: string;
  propertyExternalId: string;
  label: string;
  sqFt?: number;
  clearHeightFt?: number;
  dockDoors?: number;
  power?: string;
  availability: "occupied" | "vacant" | "pending";
  askingRateUsd?: string;
  floorPlanUrl?: string;
  notes?: string;
};

export interface YardiClient {
  fetchUnits(propertyExternalId: string): Promise<YardiUnitDto[]>;
}

// Fixture-backed stub used until Berkeley IT issues live creds.
// Fixtures live at config/tenants/<slug>/yardi-fixtures/units.json.
// If no fixture file exists, returns an empty array (not an error).
export class FixtureYardiClient implements YardiClient {
  constructor(private readonly tenantSlug: string) {}

  async fetchUnits(propertyExternalId: string): Promise<YardiUnitDto[]> {
    const { readFile } = await import("node:fs/promises");
    const path = await import("node:path");
    const file = path.resolve(
      process.cwd(),
      "config",
      "tenants",
      this.tenantSlug,
      "yardi-fixtures",
      "units.json",
    );
    try {
      const raw = await readFile(file, "utf8");
      const all = JSON.parse(raw) as YardiUnitDto[];
      return all.filter((u) => u.propertyExternalId === propertyExternalId);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw err;
    }
  }
}

// Placeholder for the real integration.
// Don't enable in prod until Berkeley's compliance sign-off.
export class LiveYardiClient implements YardiClient {
  constructor(private readonly baseUrl: string, private readonly apiKey: string) {}

  async fetchUnits(propertyExternalId: string): Promise<YardiUnitDto[]> {
    const res = await fetch(`${this.baseUrl}/properties/${propertyExternalId}/units`, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      throw new Error(`Yardi fetch failed: ${res.status} ${await res.text()}`);
    }
    const payload = (await res.json()) as { units: YardiUnitDto[] };
    return payload.units ?? [];
  }
}

export function buildYardiClient(tenantSlug: string): YardiClient {
  const base = process.env["YARDI_API_URL"];
  const key = process.env["YARDI_API_KEY"];
  if (base && key) return new LiveYardiClient(base, key);
  return new FixtureYardiClient(tenantSlug);
}

// ─── Sync orchestrator ──────────────────────────────────────────────────────

export type SyncResult = {
  tenantId: string;
  propertyId: string;
  fetched: number;
  inserted: number;
  updated: number;
  skipped: number;
};

export async function syncPropertyUnits(params: {
  tenantId: string;
  tenantSlug: string;
  propertyId: string;
  propertyExternalId: string;
}): Promise<SyncResult> {
  const client = buildYardiClient(params.tenantSlug);
  const incoming = await client.fetchUnits(params.propertyExternalId);

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const yardi of incoming) {
    const [existing] = await db
      .select()
      .from(units)
      .where(
        and(
          eq(units.tenantId, params.tenantId),
          eq(units.propertyId, params.propertyId),
          eq(units.yardiUnitId, yardi.yardiUnitId),
        ),
      )
      .limit(1);

    const values = {
      tenantId: params.tenantId,
      propertyId: params.propertyId,
      yardiUnitId: yardi.yardiUnitId,
      label: yardi.label,
      sqFt: yardi.sqFt ?? null,
      clearHeightFt: yardi.clearHeightFt ?? null,
      dockDoors: yardi.dockDoors ?? null,
      power: yardi.power ?? null,
      availability: yardi.availability,
      askingRateUsd: yardi.askingRateUsd ?? null,
      floorPlanUrl: yardi.floorPlanUrl ?? null,
      notes: yardi.notes ?? null,
    };

    if (!existing) {
      await db.insert(units).values(values);
      inserted++;
      continue;
    }

    const drifted =
      existing.label !== values.label ||
      existing.sqFt !== values.sqFt ||
      existing.availability !== values.availability ||
      existing.askingRateUsd !== values.askingRateUsd;

    if (!drifted) {
      skipped++;
      continue;
    }

    await db
      .update(units)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(units.id, existing.id));
    updated++;
  }

  return {
    tenantId: params.tenantId,
    propertyId: params.propertyId,
    fetched: incoming.length,
    inserted,
    updated,
    skipped,
  };
}
