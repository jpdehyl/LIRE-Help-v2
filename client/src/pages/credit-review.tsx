import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, FileText, ShieldAlert, Sparkles } from "lucide-react";
import { WorkspaceShell } from "../components/workspace/workspace-shell";
import { api } from "../lib/api";

type Lessee = {
  id: string;
  legalName: string;
  riskTier: string;
  watchlist: boolean;
  updatedAt: string;
};

type ChecklistResult = {
  rule_id: string;
  category: string;
  severity: "green" | "yellow" | "red" | "unknown";
  observed: number | string | null;
  threshold: string | null;
  reasoning: string;
  citations: string[];
};

type ChecklistRun = {
  id: string;
  rubricVersion: string;
  status: string;
  redFlagCount: number;
  yellowFlagCount: number;
  resultsJson: {
    results: ChecklistResult[];
    missing_inputs?: Array<{ rule_id: string; missing: string[] }>;
  } | null;
};

type Memo = {
  id: string;
  templateVersion: string;
  draftMarkdown: string;
  finalMarkdown: string | null;
  status: string;
  aiModel: string | null;
};

function severityTone(severity: ChecklistResult["severity"]) {
  switch (severity) {
    case "red":
      return "bg-rose-50 text-rose-700 ring-rose-200";
    case "yellow":
      return "bg-amber-50 text-amber-700 ring-amber-200";
    case "green":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    default:
      return "bg-slate-50 text-slate-600 ring-slate-200";
  }
}

function LesseeList({
  lessees,
  selectedId,
  onSelect,
}: {
  lessees: Lessee[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
      <p className="px-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Lessees</p>
      <div className="mt-3 flex flex-col gap-1">
        {lessees.length === 0 ? (
          <p className="px-2 text-xs text-slate-400">No lessees yet.</p>
        ) : (
          lessees.map((l) => (
            <button
              key={l.id}
              onClick={() => onSelect(l.id)}
              className={`flex flex-col items-start rounded-xl px-3 py-2 text-left transition ${
                selectedId === l.id ? "bg-slate-900 text-white" : "hover:bg-slate-100"
              }`}
            >
              <span className="text-sm font-semibold">{l.legalName}</span>
              <span
                className={`mt-1 text-[11px] font-medium uppercase tracking-wide ${
                  selectedId === l.id ? "text-slate-300" : "text-slate-500"
                }`}
              >
                {l.riskTier} {l.watchlist ? "· watchlist" : ""}
              </span>
            </button>
          ))
        )}
      </div>
    </section>
  );
}

function ChecklistPanel({ run }: { run: ChecklistRun | null }) {
  if (!run) {
    return (
      <section className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
        No checklist run selected.
      </section>
    );
  }

  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
          <ShieldAlert className="h-5 w-5" />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Checklist run · rubric v{run.rubricVersion}
          </p>
          <h3 className="mt-1 text-lg font-semibold text-slate-950">
            {run.redFlagCount} red · {run.yellowFlagCount} yellow
          </h3>
        </div>
      </div>

      <div className="mt-5 space-y-2">
        {(run.resultsJson?.results ?? []).map((r) => (
          <div key={r.rule_id} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <span
              className={`mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${severityTone(
                r.severity,
              )}`}
            >
              {r.severity === "red" ? (
                <AlertTriangle className="h-3 w-3" />
              ) : r.severity === "green" ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : null}
              {r.severity}
            </span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-900">{r.rule_id}</p>
              <p className="mt-1 text-xs text-slate-600">{r.reasoning}</p>
              <div className="mt-2 flex flex-wrap gap-1 text-[11px] text-slate-500">
                {r.observed !== null ? <span>observed: {String(r.observed)}</span> : null}
                {r.threshold ? <span>· {r.threshold}</span> : null}
                {r.citations.length > 0 ? <span>· {r.citations.join(" ")}</span> : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function MemoPanel({
  memo,
  onApprove,
  onReject,
  onRevise,
}: {
  memo: Memo | null;
  onApprove: () => void;
  onReject: () => void;
  onRevise: () => void;
}) {
  if (!memo) {
    return (
      <section className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
        No memo drafted yet for this lessee.
      </section>
    );
  }

  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
            <FileText className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Memo · {memo.templateVersion} · drafted by {memo.aiModel ?? "—"}
            </p>
            <h3 className="mt-1 text-lg font-semibold text-slate-950">Status: {memo.status}</h3>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRevise}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <Sparkles className="h-3.5 w-3.5" /> Redraft
          </button>
          <button
            onClick={onReject}
            className="rounded-full border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-50"
          >
            Reject
          </button>
          <button
            onClick={onApprove}
            className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-800"
          >
            Approve
          </button>
        </div>
      </div>

      <pre className="mt-6 max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-50 p-5 font-mono text-xs leading-relaxed text-slate-800">
{memo.finalMarkdown ?? memo.draftMarkdown}
      </pre>
    </section>
  );
}

export default function CreditReviewPage() {
  const [lessees, setLessees] = useState<Lessee[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [run, setRun] = useState<ChecklistRun | null>(null);
  const [memo, setMemo] = useState<Memo | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get<{ lessees: Lessee[] }>("/api/pilots/credit/lessees");
        setLessees(res.lessees);
        if (res.lessees[0]) setSelectedId(res.lessees[0].id);
      } catch (err) {
        console.error("[credit load]", err);
        setStatus("Unable to load credit workspace");
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setRun(null);
      setMemo(null);
      return;
    }
    (async () => {
      try {
        const res = await api.get<{
          runs: ChecklistRun[];
          memos: Memo[];
        }>(`/api/pilots/credit/lessees/${selectedId}`);
        setRun(res.runs[0] ?? null);
        setMemo(res.memos[0] ?? null);
      } catch (err) {
        console.error("[credit lessee detail]", err);
        setStatus("Unable to load lessee detail");
      }
    })();
  }, [selectedId]);

  const selectedLessee = useMemo(
    () => lessees.find((l) => l.id === selectedId) ?? null,
    [lessees, selectedId],
  );

  async function handleApprove() {
    if (!memo) return;
    try {
      await api.post(`/api/pilots/credit/memos/${memo.id}/approvals`, {
        decision: "approved",
        reason: null,
      });
      setStatus("Memo approved");
    } catch (err) {
      console.error("[credit approve]", err);
      setStatus("Approval failed");
    }
  }

  async function handleReject() {
    if (!memo) return;
    const reason = window.prompt("Reason for rejection?") ?? "";
    if (!reason) return;
    try {
      await api.post(`/api/pilots/credit/memos/${memo.id}/approvals`, {
        decision: "rejected",
        reason,
      });
      setStatus("Memo rejected");
    } catch (err) {
      console.error("[credit reject]", err);
      setStatus("Rejection failed");
    }
  }

  async function handleRevise() {
    if (!memo) return;
    try {
      const { memo: updated } = await api.post<{ memo: Memo }>(
        `/api/pilots/credit/memos/${memo.id}/draft`,
        {},
      );
      setMemo(updated);
      setStatus("Memo redrafted");
    } catch (err) {
      console.error("[credit redraft]", err);
      setStatus("Redraft failed");
    }
  }

  return (
    <WorkspaceShell title="Credit review" eyebrow="Pilot B / Tenant financial review">
      <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <LesseeList lessees={lessees} selectedId={selectedId} onSelect={setSelectedId} />

        <div className="space-y-6">
          <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Lessee</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">
              {selectedLessee?.legalName ?? "Select a lessee"}
            </h2>
            {selectedLessee ? (
              <p className="mt-2 text-sm text-slate-500">
                Risk tier: <span className="font-semibold text-slate-900">{selectedLessee.riskTier}</span>
                {selectedLessee.watchlist ? " · on watchlist" : null}
              </p>
            ) : null}
          </section>

          <ChecklistPanel run={run} />
          <MemoPanel memo={memo} onApprove={handleApprove} onReject={handleReject} onRevise={handleRevise} />

          {status ? <p className="text-xs text-slate-500">{status}</p> : null}
        </div>
      </div>
    </WorkspaceShell>
  );
}
