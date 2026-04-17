import { useEffect, useMemo, useState } from "react";
import { Building2, Briefcase, FileText, RefreshCw, Wand2 } from "lucide-react";
import { WorkspaceShell } from "../components/workspace/workspace-shell";
import { api } from "../lib/api";

type LeasingStage = {
  key: string;
  label: string;
  stuck_after_days: number | null;
};

type LeasingConfig = {
  pipeline: { stages: LeasingStage[] };
};

type Unit = {
  id: string;
  propertyId: string;
  label: string;
  sqFt: number | null;
  clearHeightFt: number | null;
  dockDoors: number | null;
  power: string | null;
  availability: string;
  askingRateUsd: string | null;
  notes: string | null;
};

type Deal = {
  id: string;
  prospectCompany: string;
  prospectContactName: string | null;
  unitId: string | null;
  stage: string;
  sizeNeededSqFt: number | null;
  expectedRentUsd: string | null;
  lastActivityAt: string;
  notes: string | null;
};

function StageColumn({
  stage,
  deals,
  unitsById,
}: {
  stage: LeasingStage;
  deals: Deal[];
  unitsById: Record<string, Unit>;
}) {
  return (
    <div className="flex min-h-[260px] flex-col rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">{stage.label}</h3>
        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-500 ring-1 ring-inset ring-slate-200">
          {deals.length}
        </span>
      </div>
      <div className="mt-3 flex flex-1 flex-col gap-2">
        {deals.length === 0 ? (
          <p className="text-xs text-slate-400">No deals in this stage.</p>
        ) : (
          deals.map((deal) => {
            const unit = deal.unitId ? unitsById[deal.unitId] : null;
            return (
              <article key={deal.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <p className="text-sm font-semibold text-slate-900">{deal.prospectCompany}</p>
                {deal.prospectContactName ? (
                  <p className="mt-0.5 text-xs text-slate-500">{deal.prospectContactName}</p>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-medium text-slate-500">
                  {unit ? (
                    <span className="rounded-full bg-slate-50 px-2 py-0.5 ring-1 ring-inset ring-slate-200">
                      {unit.label}
                    </span>
                  ) : null}
                  {deal.sizeNeededSqFt ? (
                    <span className="rounded-full bg-slate-50 px-2 py-0.5 ring-1 ring-inset ring-slate-200">
                      {deal.sizeNeededSqFt.toLocaleString()} sq ft
                    </span>
                  ) : null}
                  {deal.expectedRentUsd ? (
                    <span className="rounded-full bg-slate-50 px-2 py-0.5 ring-1 ring-inset ring-slate-200">
                      {deal.expectedRentUsd}
                    </span>
                  ) : null}
                </div>
                {deal.notes ? <p className="mt-2 text-xs text-slate-600">{deal.notes}</p> : null}
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}

function UnitInventory({ units, onSync }: { units: Unit[]; onSync: () => void }) {
  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            <Building2 className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Unit inventory</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">
              Synced from Yardi ({units.length} units)
            </h2>
          </div>
        </div>
        <button
          onClick={onSync}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Sync now
        </button>
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2">Unit</th>
              <th className="px-4 py-2">Sq Ft</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Asking rate</th>
              <th className="px-4 py-2">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {units.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-xs text-slate-400">
                  No units synced yet. Click "Sync now" to pull from Yardi.
                </td>
              </tr>
            ) : (
              units.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-2 font-medium text-slate-900">{u.label}</td>
                  <td className="px-4 py-2 text-slate-600">{u.sqFt?.toLocaleString() ?? "—"}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                        u.availability === "vacant"
                          ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                          : u.availability === "pending"
                          ? "bg-amber-50 text-amber-700 ring-amber-200"
                          : "bg-slate-50 text-slate-600 ring-slate-200"
                      }`}
                    >
                      {u.availability}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{u.askingRateUsd ?? "—"}</td>
                  <td className="px-4 py-2 text-slate-600">{u.notes ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function LeasingPage() {
  const [config, setConfig] = useState<LeasingConfig | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [cfg, unitsRes, dealsRes] = await Promise.all([
          api.get<LeasingConfig>("/api/pilots/leasing/config"),
          api.get<{ units: Unit[] }>("/api/pilots/leasing/units"),
          api.get<{ deals: Deal[] }>("/api/pilots/leasing/deals"),
        ]);
        setConfig(cfg);
        setUnits(unitsRes.units);
        setDeals(dealsRes.deals);
      } catch (err) {
        console.error("[leasing load]", err);
        setStatus("Unable to load leasing workspace");
      }
    })();
  }, []);

  const unitsById = useMemo(() => {
    const map: Record<string, Unit> = {};
    for (const u of units) map[u.id] = u;
    return map;
  }, [units]);

  const dealsByStage = useMemo(() => {
    const grouped: Record<string, Deal[]> = {};
    for (const stage of config?.pipeline.stages ?? []) grouped[stage.key] = [];
    for (const deal of deals) {
      (grouped[deal.stage] ??= []).push(deal);
    }
    return grouped;
  }, [deals, config]);

  async function handleSync() {
    if (units.length === 0) {
      setStatus("Pick a property first — no properties loaded.");
      return;
    }
    const propertyId = units[0]?.propertyId;
    if (!propertyId) return;
    try {
      await api.post(`/api/pilots/leasing/properties/${propertyId}/sync`, {});
      const refreshed = await api.get<{ units: Unit[] }>("/api/pilots/leasing/units");
      setUnits(refreshed.units);
      setStatus("Sync complete");
    } catch (err) {
      console.error("[leasing sync]", err);
      setStatus("Sync failed");
    }
  }

  return (
    <WorkspaceShell title="Leasing" eyebrow="Pilot A / Leasing workspace">
      <div className="space-y-6">
        <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
              <Briefcase className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Deal pipeline</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-950">
                {deals.length} active deals across {config?.pipeline.stages.length ?? 0} stages
              </h2>
            </div>
          </div>

          {config ? (
            <div className="mt-6 grid gap-3 xl:grid-cols-4 2xl:grid-cols-7">
              {config.pipeline.stages
                .filter((s) => s.key !== "lost")
                .map((stage) => (
                  <StageColumn
                    key={stage.key}
                    stage={stage}
                    deals={dealsByStage[stage.key] ?? []}
                    unitsById={unitsById}
                  />
                ))}
            </div>
          ) : (
            <p className="mt-6 text-sm text-slate-400">Loading pipeline config…</p>
          )}
        </section>

        <UnitInventory units={units} onSync={handleSync} />

        <section className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-6 text-sm leading-relaxed text-slate-600">
          <div className="flex items-center gap-2 text-slate-500">
            <Wand2 className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-[0.18em]">Coming this week</span>
          </div>
          <ul className="mt-3 space-y-2">
            <li className="flex items-start gap-2">
              <FileText className="mt-0.5 h-4 w-4 text-slate-400" />
              <span>AI tour recap — broker pastes raw notes, Claude returns a structured recap scoped to the deal.</span>
            </li>
            <li className="flex items-start gap-2">
              <FileText className="mt-0.5 h-4 w-4 text-slate-400" />
              <span>On-demand unit sheet PDF generator with shareable token.</span>
            </li>
            <li className="flex items-start gap-2">
              <FileText className="mt-0.5 h-4 w-4 text-slate-400" />
              <span>Weekly pipeline digest email to the regional director.</span>
            </li>
          </ul>
        </section>

        {status ? <p className="text-xs text-slate-500">{status}</p> : null}
      </div>
    </WorkspaceShell>
  );
}
