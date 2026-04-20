import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Link } from "wouter";
import { useState } from "react";
import { Building2, Bot, ExternalLink, Plus, LogOut, BookMarked, ChevronUp, ChevronDown, X, Loader2, Link2, Save, MessageSquare, Zap, TrendingUp, AlertTriangle, Tag, ChevronRight, UserPlus, Eye, EyeOff, Sun, Moon, BarChart3, DollarSign, Users, FileText, Upload, Download, RefreshCw, Trash2 } from "lucide-react";

interface AgentRow {
  id: string;
  name: string;
  emoji: string;
  tagline: string | null;
  isActive: boolean;
  propertyId: string;
  tenantId: string | null;
}

interface PropertyRow {
  id: string;
  name: string;
  slug: string;
  location: string | null;
  tenantId: string | null;
}

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  plan: string;
  isActive: boolean;
  billingEmail: string | null;
}

interface KbEntry { id: string; section: string; title: string; content: string; sortOrder: number; updatedAt: string; }

interface PlatformSessionRow {
  id: string;
  sessionId: string;
  messages: { role: string; content: string }[];
  messageCount: number;
  escalatedToWa: boolean;
  isAnalyzed: boolean;
  summary: string | null;
  tipoConsulta: string | null;
  intencion: string | null;
  tags: string[];
  isLead: boolean;
  propertyType: string | null;
  createdAt: string;
  lastMessageAt: string;
}

const INTENCION_LABEL: Record<string, { label: string; color: string }> = {
  cliente_potencial: { label: "Potential client", color: "bg-emerald-100 text-emerald-800" },
  solicitud_demo:    { label: "Demo request",    color: "bg-blue-100 text-blue-800" },
  consulta_simple:   { label: "Inquiry",          color: "bg-slate-100 text-slate-700" },
  problema:          { label: "Problem",           color: "bg-red-100 text-red-700" },
  queja:             { label: "Complaint",         color: "bg-orange-100 text-orange-700" },
  curioso:           { label: "Curious",            color: "bg-purple-100 text-purple-700" },
  spam:              { label: "Spam",               color: "bg-gray-100 text-gray-500" },
};

function PlatformSessionsPanel() {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [editingTags, setEditingTags] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState("");

  const { data: sessions = [], isLoading } = useQuery<PlatformSessionRow[]>({
    queryKey: ["platform-sessions"],
    queryFn: () => api.get("/api/platform-sessions"),
    refetchInterval: 30000,
  });

  const patchTags = useMutation({
    mutationFn: ({ id, tags }: { id: string; tags: string[] }) =>
      api.patch(`/api/platform-sessions/${id}/tags`, { tags }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["platform-sessions"] }); setEditingTags(null); },
  });

  const filtered = filter === "all" ? sessions : sessions.filter(s => s.intencion === filter);
  const leads = sessions.filter(s => s.isLead).length;

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MessageSquare className="h-5 w-5 text-primary" />
          <div>
            <h2 className="font-semibold text-sm">LIRE Help — Conversations</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Landing page chat sessions · {sessions.length} total · {leads} leads
            </p>
          </div>
        </div>
      </div>

      {/* Filter pills */}
      <div className="px-5 py-2 border-b flex gap-1.5 flex-wrap">
        <button onClick={() => setFilter("all")}
          className={`text-[11px] px-2.5 py-1 rounded-full font-medium transition-colors ${filter === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
          All ({sessions.length})
        </button>
        {Object.entries(INTENCION_LABEL).map(([key, { label, color }]) => {
          const count = sessions.filter(s => s.intencion === key).length;
          if (count === 0) return null;
          return (
            <button key={key} onClick={() => setFilter(key)}
              className={`text-[11px] px-2.5 py-1 rounded-full font-medium transition-colors ${filter === key ? "bg-primary text-primary-foreground" : `${color} hover:opacity-80`}`}>
              {label} ({count})
            </button>
          );
        })}
      </div>

      {/* Session list */}
      <div className="divide-y max-h-[500px] overflow-y-auto">
        {isLoading && <div className="flex items-center justify-center py-8 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading...</div>}
        {!isLoading && filtered.length === 0 && <div className="py-10 text-center text-sm text-muted-foreground">No sessions yet.</div>}
        {filtered.map(s => (
          <div key={s.id} className="px-5 py-3">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => setExpanded(expanded === s.id ? null : s.id)}>
              <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${expanded === s.id ? "rotate-90" : ""}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-muted-foreground">#{s.sessionId.slice(0, 8)}</span>
                  <span className="text-xs text-muted-foreground">{s.messageCount} msgs</span>
                  {s.escalatedToWa && <Zap className="h-3 w-3 text-amber-500" />}
                  {s.isLead && <TrendingUp className="h-3 w-3 text-emerald-500" />}
                </div>
                {s.summary && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{s.summary}</p>}
              </div>
              <div className="flex items-center gap-1.5">
                {s.intencion && INTENCION_LABEL[s.intencion] && (
                  <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${INTENCION_LABEL[s.intencion]!.color}`}>
                    {INTENCION_LABEL[s.intencion]!.label}
                  </span>
                )}
                <span className="text-[10px] text-muted-foreground">{new Date(s.lastMessageAt).toLocaleDateString()}</span>
              </div>
            </div>
            {expanded === s.id && (
              <div className="mt-3 ml-5 space-y-2">
                <div className="rounded-lg border bg-muted/30 p-3 max-h-60 overflow-y-auto space-y-2">
                  {s.messages.map((m, i) => (
                    <div key={i} className={`text-xs px-3 py-2 rounded-lg ${m.role === "user" ? "bg-primary/10 text-foreground" : "bg-background border text-foreground"}`}>
                      <span className="font-medium text-[10px] text-muted-foreground">{m.role === "user" ? "Visitor" : "LIRE Agent"}</span>
                      <p className="mt-0.5 whitespace-pre-wrap">{m.content}</p>
                    </div>
                  ))}
                </div>
                {/* Tags */}
                <div className="flex items-center gap-2">
                  <Tag className="h-3 w-3 text-muted-foreground" />
                  {s.tags.map(t => <span key={t} className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{t}</span>)}
                  {editingTags === s.id ? (
                    <div className="flex gap-1">
                      <input className="text-xs border rounded px-2 py-0.5 w-24 bg-background" value={tagInput} onChange={e => setTagInput(e.target.value)} placeholder="tag" />
                      <button onClick={() => { patchTags.mutate({ id: s.id, tags: [...s.tags, tagInput.trim()] }); setTagInput(""); }}
                        className="text-[10px] px-2 py-0.5 bg-primary text-primary-foreground rounded">Add</button>
                      <button onClick={() => setEditingTags(null)} className="text-[10px] px-2 py-0.5 border rounded">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => { setEditingTags(s.id); setTagInput(""); }} className="text-[10px] text-primary hover:underline">+ tag</button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function PlatformKbPanel() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<KbEntry | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ section: "", title: "", content: "" });

  const { data: entries = [], isLoading } = useQuery<KbEntry[]>({
    queryKey: ["platform-kb"],
    queryFn: () => api.get("/api/knowledge/platform"),
  });

  const create = useMutation({
    mutationFn: (d: typeof addForm) => api.post("/api/knowledge/platform", d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["platform-kb"] }); setShowAdd(false); setAddForm({ section: "", title: "", content: "" }); },
  });

  const save = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<KbEntry> }) => api.put(`/api/knowledge/platform/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["platform-kb"] }); setEditing(null); },
  });

  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/api/knowledge/platform/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["platform-kb"] }),
  });

  const reorder = useMutation({
    mutationFn: ({ id, direction }: { id: string; direction: "up" | "down" }) => api.patch(`/api/knowledge/platform/${id}/reorder`, { direction }),
    onSuccess: (data) => qc.setQueryData(["platform-kb"], data),
  });

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BookMarked className="h-5 w-5 text-primary" />
          <div>
            <h2 className="font-semibold text-sm">LIRE Help Agent — Knowledge Base</h2>
            <p className="text-xs text-muted-foreground mt-0.5">What the sales agent on lire-help.com knows · {entries.length} entries</p>
          </div>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 font-medium">
          <Plus className="h-3.5 w-3.5" /> New section
        </button>
      </div>

      <div className="divide-y">
        {isLoading && <div className="flex items-center justify-center py-8 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading...</div>}
        {!isLoading && entries.length === 0 && <div className="py-10 text-center text-sm text-muted-foreground">No entries. Add the first one with "New section".</div>}
        {entries.map((entry, idx) => (
          <div key={entry.id} className="px-5 py-3.5">
            {editing?.id === entry.id ? (
              <div className="space-y-2.5">
                <div className="flex gap-2">
                  <input className="flex-1 border rounded-md px-2.5 py-1.5 text-sm font-medium bg-background" placeholder="Title" value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} />
                  <input className="w-36 border rounded-md px-2.5 py-1.5 text-sm bg-background" placeholder="section" value={editing.section} onChange={e => setEditing({ ...editing, section: e.target.value })} />
                </div>
                <textarea className="w-full border rounded-md px-2.5 py-2 text-sm resize-none bg-background font-mono" rows={6} value={editing.content} onChange={e => setEditing({ ...editing, content: e.target.value })} />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setEditing(null)} className="text-xs px-3 py-1.5 border rounded-md hover:bg-muted">Cancel</button>
                  <button onClick={() => save.mutate({ id: editing.id, data: { title: editing.title, section: editing.section, content: editing.content } })}
                    disabled={save.isPending} className="text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5">
                    {save.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Save
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium leading-snug">{entry.title}</span>
                    <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono shrink-0">{entry.section}</span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 whitespace-pre-line leading-relaxed">{entry.content}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <div className="flex flex-col">
                    <button onClick={() => reorder.mutate({ id: entry.id, direction: "up" })} disabled={idx === 0} className="p-0.5 rounded hover:bg-muted disabled:opacity-30"><ChevronUp className="h-3.5 w-3.5" /></button>
                    <button onClick={() => reorder.mutate({ id: entry.id, direction: "down" })} disabled={idx === entries.length - 1} className="p-0.5 rounded hover:bg-muted disabled:opacity-30"><ChevronDown className="h-3.5 w-3.5" /></button>
                  </div>
                  <button onClick={() => setEditing(entry)} className="text-xs px-2.5 py-1 border rounded-md hover:bg-muted ml-1">Edit</button>
                  <button onClick={() => { if (confirm(`Delete "${entry.title}"?`)) del.mutate(entry.id); }} className="p-1 rounded-md hover:bg-red-50 text-red-500"><X className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-xl shadow-xl w-full max-w-lg space-y-4 p-5 border">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">New entry — LIRE Help Agent KB</h3>
              <button onClick={() => setShowAdd(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs text-muted-foreground mb-1">Title</label>
                  <input className="w-full border rounded-md px-2.5 py-1.5 text-sm bg-background" placeholder="e.g. Professional Plan — Details" value={addForm.title} onChange={e => setAddForm({ ...addForm, title: e.target.value })} />
                </div>
                <div className="w-36">
                  <label className="block text-xs text-muted-foreground mb-1">Section (key)</label>
                  <input className="w-full border rounded-md px-2.5 py-1.5 text-sm bg-background font-mono" placeholder="pricing" value={addForm.section} onChange={e => setAddForm({ ...addForm, section: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Content</label>
                <textarea className="w-full border rounded-md px-2.5 py-2 text-sm resize-none bg-background" rows={7} placeholder="Describe this knowledge section in detail..." value={addForm.content} onChange={e => setAddForm({ ...addForm, content: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowAdd(false)} className="text-sm px-3 py-1.5 border rounded-md hover:bg-muted">Cancel</button>
              <button onClick={() => create.mutate(addForm)} disabled={create.isPending || !addForm.section || !addForm.title || !addForm.content}
                className="text-sm px-3 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5">
                {create.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Create entry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface KbDocumentRow {
  id: string;
  propertyId: string | null;
  kind: "lease" | "drawing" | "policy" | "sow" | "other";
  title: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  extractStatus: "pending" | "done" | "failed";
  extractError: string | null;
  extractedCharCount: number;
  createdAt: string;
  updatedAt: string;
}

const DOC_KINDS: KbDocumentRow["kind"][] = ["lease", "drawing", "policy", "sow", "other"];

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function PlatformDocumentsPanel() {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState<KbDocumentRow["kind"]>("policy");
  const [title, setTitle] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { data: docs = [], isLoading } = useQuery<KbDocumentRow[]>({
    queryKey: ["kb-documents"],
    queryFn: () => api.get("/api/knowledge/documents"),
  });

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Pick a file first.");
      const form = new FormData();
      form.append("file", file);
      form.append("kind", kind);
      if (title.trim()) form.append("title", title.trim());
      const res = await fetch("/api/knowledge/documents", { method: "POST", body: form, credentials: "include" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.message ?? `Upload failed (${res.status})`);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kb-documents"] });
      setFile(null);
      setTitle("");
      setUploadError(null);
    },
    onError: (err) => setUploadError(err instanceof Error ? err.message : String(err)),
  });

  const reextract = useMutation({
    mutationFn: (id: string) => api.post(`/api/knowledge/documents/${id}/reextract`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kb-documents"] }),
  });

  const reindex = useMutation({
    mutationFn: (id: string) => api.post<{ chunkCount: number; embedded: boolean; reason?: string }>(`/api/knowledge/documents/${id}/reindex`, {}),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["kb-documents"] });
      if (data.reason) alert(`Reindexed: ${data.chunkCount} chunks. Embedding skipped — ${data.reason}.`);
    },
  });

  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/api/knowledge/documents/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kb-documents"] }),
  });

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="h-5 w-5 text-primary" />
          <div>
            <h2 className="font-semibold text-sm">Knowledge documents</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Leases, drawings, policy PDFs · {docs.length} file{docs.length === 1 ? "" : "s"}</p>
          </div>
        </div>
      </div>

      <div className="px-5 py-4 border-b bg-muted/30 flex flex-wrap items-center gap-2">
        <input
          type="file"
          accept=".pdf,.docx,.doc,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
          onChange={(e) => { setFile(e.target.files?.[0] ?? null); setUploadError(null); }}
          className="text-xs flex-1 min-w-0"
        />
        <select value={kind} onChange={(e) => setKind(e.target.value as KbDocumentRow["kind"])}
          className="text-xs border rounded-md px-2 py-1.5 bg-background">
          {DOC_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
        <input placeholder="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)}
          className="text-xs border rounded-md px-2 py-1.5 bg-background w-48" />
        <button
          onClick={() => upload.mutate()}
          disabled={!file || upload.isPending}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 font-medium">
          {upload.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />} Upload
        </button>
      </div>
      {uploadError && (
        <div className="px-5 py-2 text-xs text-red-600 border-b bg-red-50">{uploadError}</div>
      )}

      <div className="divide-y">
        {isLoading && <div className="flex items-center justify-center py-8 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading…</div>}
        {!isLoading && docs.length === 0 && <div className="py-10 text-center text-sm text-muted-foreground">No documents yet. Upload a lease, drawing, or policy PDF to get started.</div>}
        {docs.map((d) => (
          <div key={d.id} className="px-5 py-3.5 flex items-center gap-3">
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-sm font-medium leading-snug">
                <span className="truncate">{d.title}</span>
                <span className="text-[10px] uppercase tracking-wide font-mono text-muted-foreground">{d.kind}</span>
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                <span className="truncate">{d.originalName}</span>
                <span>·</span>
                <span>{formatBytes(d.sizeBytes)}</span>
                <span>·</span>
                <span className={
                  d.extractStatus === "done" ? "text-emerald-600"
                  : d.extractStatus === "failed" ? "text-red-600"
                  : "text-amber-600"
                }>
                  {d.extractStatus === "done" ? `extracted · ${d.extractedCharCount.toLocaleString()} chars`
                  : d.extractStatus === "failed" ? `extract failed${d.extractError ? `: ${d.extractError}` : ""}`
                  : "pending"}
                </span>
              </div>
            </div>
            <a href={`/api/knowledge/documents/${d.id}/download`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-muted text-muted-foreground">
              <Download className="h-3 w-3" />
            </a>
            <button
              onClick={() => reextract.mutate(d.id)}
              disabled={reextract.isPending}
              title="Re-extract text (also reindexes)"
              className="flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-muted text-muted-foreground disabled:opacity-50">
              <RefreshCw className={`h-3 w-3 ${reextract.isPending ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={() => reindex.mutate(d.id)}
              disabled={reindex.isPending}
              title="Re-index for search (chunk + embed from current text)"
              className="text-[10px] font-mono px-2 py-1 rounded hover:bg-muted text-muted-foreground disabled:opacity-50">
              {reindex.isPending ? "…" : "IDX"}
            </button>
            <button
              onClick={() => { if (confirm(`Delete "${d.title}"?`)) del.mutate(d.id); }}
              disabled={del.isPending}
              title="Delete"
              className="flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-red-50 text-red-600 disabled:opacity-50">
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function CreateOwnerModal({ tenant, onClose }: { tenant: TenantRow; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [showPwd, setShowPwd] = useState(false);

  const create = useMutation({
    mutationFn: () => api.post("/api/staff", {
      name: form.name, email: form.email, password: form.password,
      role: "owner", tenantId: tenant.id,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["platform-staff"] }); onClose(); },
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-xl shadow-xl w-full max-w-md border p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-sm">Create Owner — {tenant.name}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{tenant.slug}.lire-help.com · role: Owner</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <input placeholder="Full name" className="w-full border rounded-lg px-3 py-2 text-sm bg-background" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <input type="email" placeholder="Email" className="w-full border rounded-lg px-3 py-2 text-sm bg-background" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          <div className="relative">
            <input type={showPwd ? "text" : "password"} placeholder="Password (min 8 chars)" className="w-full border rounded-lg px-3 py-2 pr-9 text-sm bg-background" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
            <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
              {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        {create.isError && <p className="text-xs text-red-500">{(create.error as any)?.message ?? "Error"}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="text-sm px-3 py-1.5 border rounded-lg hover:bg-muted">Cancel</button>
          <button onClick={() => create.mutate()} disabled={create.isPending || !form.name || !form.email || form.password.length < 8}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50">
            {create.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Create owner
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Metrics Tab ────────────────────────────────────────────────────────────

interface MetricsData {
  conversations: { total: number; leads: number; escalationRate: number; avgMessages: number; dailyTrend: { date: string; count: number }[] };
  tokens: { totalInput: number; totalOutput: number; totalCostUsd: string; byModel: { model: string; input: number; output: number; cost: string }[]; dailyCost: { date: string; cost: string }[] };
  perTenant: { tenantId: string | null; name: string; conversations: number; tokens: number; cost: string; escalationRate: number; monthlyBudgetUsd: string | null }[];
  projection: { monthlyEstimate: string };
}

function MetricsTab() {
  const [period, setPeriod] = useState<7 | 30>(7);
  const { data, isLoading } = useQuery<MetricsData>({
    queryKey: ["metrics", period],
    queryFn: () => api.get(`/api/admin/metrics?days=${period}`),
    refetchInterval: 60000,
  });

  if (isLoading || !data) return <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center"><Loader2 className="h-4 w-4 animate-spin" /> Loading metrics...</div>;

  const totalCost = parseFloat(data.tokens.totalCostUsd || "0");
  const totalTokens = data.tokens.totalInput + data.tokens.totalOutput;
  const maxDaily = Math.max(...(data.conversations.dailyTrend.map(d => d.count)), 1);

  return (
    <div className="space-y-6">
      {/* Period toggle */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Metrics</h2>
        <div className="flex gap-1 bg-muted rounded-lg p-0.5">
          {([7, 30] as const).map(d => (
            <button key={d} onClick={() => setPeriod(d)}
              className={`text-xs px-3 py-1 rounded-md transition-colors ${period === d ? "bg-background shadow text-foreground font-medium" : "text-muted-foreground hover:text-foreground"}`}>
              {d} days
            </button>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><MessageSquare className="h-3 w-3" /> Conversations</p>
          <p className="text-3xl font-bold mt-1">{data.conversations.total}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" /> Leads</p>
          <p className="text-3xl font-bold mt-1">{data.conversations.leads}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><DollarSign className="h-3 w-3" /> Token Cost</p>
          <p className="text-3xl font-bold mt-1">${totalCost.toFixed(2)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Avg Messages</p>
          <p className="text-3xl font-bold mt-1">{data.conversations.avgMessages.toFixed(1)}</p>
        </div>
      </div>

      {/* Cost breakdown + Daily trend row */}
      <div className="grid grid-cols-2 gap-4">
        {/* Cost breakdown */}
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <h3 className="text-sm font-semibold">Cost Breakdown</h3>
          {data.tokens.byModel.length === 0 ? (
            <p className="text-xs text-muted-foreground">No token usage yet</p>
          ) : (
            <div className="space-y-2">
              {data.tokens.byModel.map(m => {
                const pct = totalCost > 0 ? (parseFloat(m.cost) / totalCost) * 100 : 0;
                const label = m.model.includes("haiku") ? "Haiku" : m.model.includes("sonnet") ? "Sonnet" : m.model;
                return (
                  <div key={m.model}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium">{label}</span>
                      <span className="text-muted-foreground">${m.cost} ({pct.toFixed(0)}%)</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.max(pct, 2)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground">Monthly projection</p>
            <p className="text-lg font-bold">${data.projection.monthlyEstimate}/mo</p>
          </div>
          {totalTokens > 0 && (
            <p className="text-xs text-muted-foreground">{(totalTokens / 1000).toFixed(1)}K tokens ({(data.tokens.totalInput / 1000).toFixed(1)}K in / {(data.tokens.totalOutput / 1000).toFixed(1)}K out)</p>
          )}
        </div>

        {/* Daily trend */}
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <h3 className="text-sm font-semibold">Daily Conversations</h3>
          {data.conversations.dailyTrend.length === 0 ? (
            <p className="text-xs text-muted-foreground">No data yet</p>
          ) : (
            <div className="flex items-end gap-[2px] h-32">
              {data.conversations.dailyTrend.map(d => {
                const pct = (d.count / maxDaily) * 100;
                return (
                  <div key={d.date} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                    <div className="w-full bg-primary/80 rounded-t transition-all hover:bg-primary" style={{ height: `${Math.max(pct, 4)}%` }} />
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] bg-foreground text-background px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                      {d.date.slice(5)}: {d.count}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>{data.conversations.dailyTrend[0]?.date.slice(5) ?? ""}</span>
            <span>{data.conversations.dailyTrend[data.conversations.dailyTrend.length - 1]?.date.slice(5) ?? ""}</span>
          </div>
        </div>
      </div>

      {/* Per-tenant table */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/30">
          <h3 className="text-sm font-semibold">Per-Tenant Usage</h3>
        </div>
        {data.perTenant.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-muted-foreground">No tenant data</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="text-left px-4 py-2 font-medium">Tenant</th>
                <th className="text-right px-4 py-2 font-medium">Conversations</th>
                <th className="text-right px-4 py-2 font-medium">Tokens</th>
                <th className="text-right px-4 py-2 font-medium">Cost</th>
                <th className="text-right px-4 py-2 font-medium">Escalation</th>
                <th className="px-4 py-2 font-medium w-48">Budget</th>
              </tr>
            </thead>
            <tbody>
              {data.perTenant.map(t => {
                const budget = parseFloat(t.monthlyBudgetUsd || "0");
                const cost = parseFloat(t.cost || "0");
                const budgetPct = budget > 0 ? Math.min((cost / budget) * 100, 100) : 0;
                const budgetColor = budgetPct > 90 ? "bg-red-500" : budgetPct > 70 ? "bg-amber-500" : "bg-emerald-500";
                return (
                  <tr key={t.tenantId ?? "platform"} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-2.5 font-medium">{t.name}</td>
                    <td className="px-4 py-2.5 text-right">{t.conversations}</td>
                    <td className="px-4 py-2.5 text-right">{t.tokens > 1000 ? `${(t.tokens / 1000).toFixed(1)}K` : t.tokens}</td>
                    <td className="px-4 py-2.5 text-right">${t.cost}</td>
                    <td className="px-4 py-2.5 text-right">{(t.escalationRate * 100).toFixed(0)}%</td>
                    <td className="px-4 py-2.5">
                      {budget > 0 ? (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div className={`h-full ${budgetColor} rounded-full`} style={{ width: `${budgetPct}%` }} />
                          </div>
                          <span className="text-[10px] text-muted-foreground w-16 text-right">${t.cost}/${t.monthlyBudgetUsd}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">No budget</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Theme Toggle ───────────────────────────────────────────────────────────

function ThemeToggle() {
  const [dark, setDark] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("lire-theme") === "dark" || (!localStorage.getItem("lire-theme") && window.matchMedia("(prefers-color-scheme: dark)").matches);
    }
    return false;
  });

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("lire-theme", next ? "dark" : "light");
  };

  return (
    <button onClick={toggle} className="p-1.5 rounded-md hover:bg-accent transition-colors text-muted-foreground" title="Toggle theme">
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

export default function PlatformDashboard() {
  const { user, logout } = useAuth();

  const { data: tenants = [], isLoading: loadingTenants } = useQuery<TenantRow[]>({
    queryKey: ["platform-tenants"],
    queryFn: () => api.get("/api/properties/tenants"),
  });

  const { data: properties = [], isLoading: loadingProps } = useQuery<PropertyRow[]>({
    queryKey: ["platform-properties"],
    queryFn: () => api.get("/api/properties"),
  });

  const { data: allAgents = [], isLoading: loadingAgents } = useQuery<AgentRow[]>({
    queryKey: ["platform-agents"],
    queryFn: () => api.get("/api/agents"),
  });

  const loading = loadingTenants || loadingProps || loadingAgents;

  const propsByTenant = properties.reduce<Record<string, PropertyRow[]>>((acc, p) => {
    const key = p.tenantId ?? "__no_tenant__";
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {});

  const agentByProp = allAgents.reduce<Record<string, AgentRow>>((acc, a) => {
    acc[a.propertyId] = a;
    return acc;
  }, {});

  const [creatingOwnerFor, setCreatingOwnerFor] = useState<TenantRow | null>(null);
  const [activeTab, setActiveTab] = useState<"tenants" | "kb" | "conversations" | "metrics">("tenants");

  const planBadge = (plan: string) => {
    const colors: Record<string, string> = {
      starter: "bg-gray-100 text-gray-700",
      growth: "bg-blue-100 text-blue-700",
      scale: "bg-purple-100 text-purple-700",
      enterprise: "bg-amber-100 text-amber-700",
    };
    return colors[plan] ?? "bg-gray-100 text-gray-600";
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-6 py-3 flex items-center gap-3">
        <svg style={{ width: 28, height: 28, stroke: "#2563EB", fill: "none", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }} viewBox="0 0 24 24">
          <path d="M3 21V9l5-4v16H3zm6 0V7l6-5v19H9zm8 0V5l4-3v19h-4z"/>
        </svg>
        <h1 className="text-lg font-bold">LIRE Help</h1>
        <span className="text-xs bg-primary/10 text-primary rounded px-2 py-0.5 font-medium">Platform Admin</span>
        <div className="flex-1" />
        <ThemeToggle />
        <span className="text-xs text-muted-foreground mr-2">{user?.email}</span>
        <button onClick={logout} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <LogOut className="h-3.5 w-3.5" /> Sign out
        </button>
      </header>

      <nav className="border-b bg-card px-6 flex gap-1">
        {([
          { id: "tenants" as const, label: "Tenants", icon: <Building2 className="h-3.5 w-3.5" /> },
          { id: "kb" as const, label: "Knowledge Base", icon: <MessageSquare className="h-3.5 w-3.5" /> },
          { id: "conversations" as const, label: "Conversations", icon: <MessageSquare className="h-3.5 w-3.5" /> },
          { id: "metrics" as const, label: "Metrics", icon: <BarChart3 className="h-3.5 w-3.5" /> },
        ]).map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </nav>

      <main className="p-6 max-w-5xl mx-auto space-y-8">
        {activeTab === "kb" && (
          <div className="space-y-6">
            <PlatformKbPanel />
            <PlatformDocumentsPanel />
          </div>
        )}

        {activeTab === "conversations" && (
          <div className="space-y-6">
            <PlatformSessionsPanel />
          </div>
        )}

        {activeTab === "metrics" && <MetricsTab />}

        {activeTab === "tenants" && <>
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg border bg-card p-4">
              <p className="text-xs text-muted-foreground">Active tenants</p>
              <p className="text-3xl font-bold mt-1">{tenants.filter(t => t.isActive).length}</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-xs text-muted-foreground">Properties</p>
              <p className="text-3xl font-bold mt-1">{properties.length}</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-xs text-muted-foreground">Active agents</p>
              <p className="text-3xl font-bold mt-1">{allAgents.filter(a => a.isActive).length}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Tenants</h2>
              <button className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-primary text-primary-foreground hover:bg-primary/90">
                <Plus className="h-3.5 w-3.5" /> New tenant
              </button>
            </div>

            {loading && <p className="text-sm text-muted-foreground">Loading...</p>}

            {!loading && tenants.length === 0 && (
              <div className="rounded-lg border bg-muted/30 p-8 text-center">
                <Building2 className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No tenants yet.</p>
              </div>
            )}

            {tenants.map((tenant) => {
              const props = propsByTenant[tenant.id] ?? [];
              return (
                <div key={tenant.id} className="rounded-lg border bg-card overflow-hidden">
                  <div className="px-4 py-3 border-b bg-muted/30 flex items-center gap-3">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-sm">{tenant.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">/{tenant.slug}</span>
                    </div>
                    <span className={`text-[11px] px-2 py-0.5 rounded font-medium ${planBadge(tenant.plan)}`}>{tenant.plan}</span>
                    {!tenant.isActive && <span className="text-[11px] px-2 py-0.5 rounded bg-red-100 text-red-700">inactive</span>}
                    <button onClick={() => setCreatingOwnerFor(tenant)}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary border rounded-md px-2 py-1 hover:border-primary transition-colors">
                      <UserPlus className="h-3 w-3" /> Owner
                    </button>
                    <a href={`https://${tenant.slug}.lire-help.com`} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                      <ExternalLink className="h-3 w-3" /> {tenant.slug}.lire-help.com
                    </a>
                  </div>

                  {props.length === 0 ? (
                    <div className="px-4 py-3 text-xs text-muted-foreground">No properties</div>
                  ) : (
                    <div className="divide-y">
                      {props.map((prop) => {
                        const agent = agentByProp[prop.id];
                        return (
                          <div key={prop.id} className="px-4 py-3 flex items-center gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-sm font-medium">{prop.name}</span>
                                <span className="text-xs text-muted-foreground font-mono">#{prop.id.slice(0, 8)}</span>
                              </div>
                              {prop.location && <p className="text-xs text-muted-foreground mt-0.5 ml-5">{prop.location}</p>}
                            </div>
                            {agent ? (
                              <div className="flex items-center gap-2 text-xs bg-muted/50 rounded px-2 py-1">
                                <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                                <span>{agent.emoji} {agent.name}</span>
                                <span className="text-muted-foreground font-mono">#{agent.id.slice(0, 8)}</span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">No agent</span>
                            )}
                            <a href={`https://${tenant.slug}.lire-help.com/dashboard/knowledge`} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1" title="Open Knowledge Base">
                              <BookMarked className="h-3.5 w-3.5" />
                            </a>
                            <a href={`https://${tenant.slug}.lire-help.com/dashboard`} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-muted-foreground hover:text-foreground" title="Open dashboard">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>}
      </main>

      {creatingOwnerFor && <CreateOwnerModal tenant={creatingOwnerFor} onClose={() => setCreatingOwnerFor(null)} />}
    </div>
  );
}
