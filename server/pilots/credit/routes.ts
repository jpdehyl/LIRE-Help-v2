import express, { Router, type Request, type Response } from "express";
import { and, desc, eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import { db } from "../../db.js";
import {
  archiveLog,
  creditApprovals,
  creditChecklistRuns,
  creditDocuments,
  creditExtractions,
  creditMemos,
  insertCreditApprovalSchema,
  insertCreditChecklistRunSchema,
  insertCreditDocumentSchema,
  insertCreditMemoSchema,
  insertLesseeSchema,
  lessees,
} from "../../../shared/schema.js";
import { requireStaff, requireStaffRole } from "../../middleware/auth.js";
import { getBlobStore } from "../../platform/blob-store.js";
import { loadTenantConfigRaw, loadTenantYaml } from "../tenant-config.js";
import { classifyDocument, draftMemo, extractLineItems } from "./claude-pipeline.js";
import {
  evaluateChecklist,
  type ExtractedValue,
  type Rubric,
} from "./checklist-evaluator.js";

type ChecklistRubric = {
  version: string;
  rules: Array<{ id: string; category: string; description: string }>;
};

const router = Router();
router.use(requireStaff);

function getTenantContext(req: Request) {
  const sess = req.session as any;
  return {
    tenantId: sess?.staffTenantId as string | null | undefined,
    tenantSlug: sess?.staffTenantSlug as string | null | undefined,
    staffId: sess?.staffId as string | null | undefined,
  };
}

async function appendArchive(params: {
  tenantId: string;
  subjectType: string;
  subjectId: string;
  actorStaffId: string | null;
  eventType: string;
  payload: unknown;
}) {
  const serialized = JSON.stringify(params.payload ?? {});
  const payloadSha256 = createHash("sha256").update(serialized).digest("hex");
  await db.insert(archiveLog).values({
    tenantId: params.tenantId,
    subjectType: params.subjectType,
    subjectId: params.subjectId,
    actorStaffId: params.actorStaffId,
    eventType: params.eventType,
    payloadJson: params.payload as any,
    payloadSha256,
  });
}

router.get("/rubric", async (req: Request, res: Response) => {
  const { tenantSlug } = getTenantContext(req);
  if (!tenantSlug) return res.status(400).json({ message: "Missing tenant context" });
  try {
    const rubric = await loadTenantYaml<ChecklistRubric>(tenantSlug, "credit-checklist.yaml");
    return res.json(rubric);
  } catch (err) {
    console.error("[credit rubric]", err);
    return res.status(404).json({ message: "Rubric not found for tenant" });
  }
});

router.get("/lessees", async (req: Request, res: Response) => {
  const { tenantId } = getTenantContext(req);
  if (!tenantId) return res.status(400).json({ message: "Missing tenant context" });
  const rows = await db.select().from(lessees).where(eq(lessees.tenantId, tenantId)).orderBy(desc(lessees.updatedAt));
  return res.json({ lessees: rows });
});

router.get("/lessees/:lesseeId", async (req: Request, res: Response) => {
  const { tenantId } = getTenantContext(req);
  if (!tenantId) return res.status(400).json({ message: "Missing tenant context" });
  const lesseeId = req.params["lesseeId"] as string;

  const [lessee] = await db
    .select()
    .from(lessees)
    .where(and(eq(lessees.id, lesseeId), eq(lessees.tenantId, tenantId)))
    .limit(1);
  if (!lessee) return res.status(404).json({ message: "Lessee not found" });

  const docs = await db
    .select()
    .from(creditDocuments)
    .where(eq(creditDocuments.lesseeId, lesseeId))
    .orderBy(desc(creditDocuments.createdAt));

  const runs = await db
    .select()
    .from(creditChecklistRuns)
    .where(eq(creditChecklistRuns.lesseeId, lesseeId))
    .orderBy(desc(creditChecklistRuns.startedAt));

  const memos = await db
    .select()
    .from(creditMemos)
    .where(eq(creditMemos.lesseeId, lesseeId))
    .orderBy(desc(creditMemos.createdAt));

  return res.json({ lessee, documents: docs, runs, memos });
});

router.post("/lessees", async (req: Request, res: Response) => {
  const { tenantId, staffId } = getTenantContext(req);
  if (!tenantId) return res.status(400).json({ message: "Missing tenant context" });
  const parsed = insertLesseeSchema.safeParse({ ...req.body, tenantId });
  if (!parsed.success) return res.status(400).json({ message: "Invalid lessee payload", issues: parsed.error.issues });
  const [row] = await db.insert(lessees).values(parsed.data).returning();
  await appendArchive({
    tenantId,
    subjectType: "lessee",
    subjectId: row.id,
    actorStaffId: staffId ?? null,
    eventType: "lessee.created",
    payload: row,
  });
  return res.status(201).json({ lessee: row });
});

router.post("/documents", async (req: Request, res: Response) => {
  const { tenantId, staffId } = getTenantContext(req);
  if (!tenantId) return res.status(400).json({ message: "Missing tenant context" });
  const parsed = insertCreditDocumentSchema.safeParse({ ...req.body, tenantId });
  if (!parsed.success) return res.status(400).json({ message: "Invalid document payload", issues: parsed.error.issues });
  const [row] = await db.insert(creditDocuments).values(parsed.data).returning();
  await appendArchive({
    tenantId,
    subjectType: "credit_document",
    subjectId: row.id,
    actorStaffId: staffId ?? null,
    eventType: "document.uploaded",
    payload: { id: row.id, sha256: row.sha256, classification: row.classification },
  });
  return res.status(201).json({ document: row });
});

// Upload a file: body is JSON with { lesseeId, filename, mimeType, base64 }.
// Small-file path — acceptable for pilot. Large files should upload directly
// to Azure via SAS URL and then POST metadata to /documents above.
const ALLOWED_UPLOAD_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/tiff",
]);
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

router.post(
  "/documents/upload",
  express.json({ limit: "35mb" }),
  async (req: Request, res: Response) => {
    const { tenantId, tenantSlug, staffId } = getTenantContext(req);
    if (!tenantId || !tenantSlug) return res.status(400).json({ message: "Missing tenant context" });

    const { lesseeId, filename, mimeType, base64 } = req.body ?? {};
    if (typeof lesseeId !== "string" || typeof filename !== "string" || typeof base64 !== "string") {
      return res.status(400).json({ message: "lesseeId, filename, and base64 required" });
    }
    if (typeof mimeType !== "string" || !ALLOWED_UPLOAD_MIME.has(mimeType)) {
      return res.status(400).json({ message: "Unsupported mimeType" });
    }

    const [lessee] = await db
      .select()
      .from(lessees)
      .where(and(eq(lessees.id, lesseeId), eq(lessees.tenantId, tenantId)))
      .limit(1);
    if (!lessee) return res.status(404).json({ message: "Lessee not found" });

    let buffer: Buffer;
    try {
      buffer = Buffer.from(base64, "base64");
    } catch {
      return res.status(400).json({ message: "Invalid base64 payload" });
    }
    if (buffer.length === 0 || buffer.length > MAX_UPLOAD_BYTES) {
      return res.status(413).json({ message: "Payload too small or too large" });
    }

    const sha256 = createHash("sha256").update(buffer).digest("hex");
    const [existing] = await db
      .select()
      .from(creditDocuments)
      .where(and(
        eq(creditDocuments.tenantId, tenantId),
        eq(creditDocuments.lesseeId, lesseeId),
        eq(creditDocuments.sha256, sha256),
      ))
      .limit(1);
    if (existing) {
      return res.status(200).json({ document: existing, dedup: true });
    }

    const store = getBlobStore();
    const blob = await store.put({
      tenantSlug,
      kind: "credit-documents",
      filename,
      mimeType,
      data: buffer,
    });

    const [row] = await db
      .insert(creditDocuments)
      .values({
        tenantId,
        lesseeId,
        uploadedByStaffId: staffId ?? null,
        blobUrl: blob.blobUrl,
        sha256: blob.sha256,
        mimeType: blob.mimeType,
      })
      .returning();

    await appendArchive({
      tenantId,
      subjectType: "credit_document",
      subjectId: row.id,
      actorStaffId: staffId ?? null,
      eventType: "document.uploaded",
      payload: { id: row.id, sha256: blob.sha256, size: blob.size, mimeType: blob.mimeType },
    });

    return res.status(201).json({ document: row });
  },
);

router.get("/lessees/:lesseeId/extractions", async (req: Request, res: Response) => {
  const { tenantId } = getTenantContext(req);
  if (!tenantId) return res.status(400).json({ message: "Missing tenant context" });
  const lesseeId = req.params["lesseeId"] as string;
  const [lessee] = await db
    .select()
    .from(lessees)
    .where(and(eq(lessees.id, lesseeId), eq(lessees.tenantId, tenantId)))
    .limit(1);
  if (!lessee) return res.status(404).json({ message: "Lessee not found" });

  const docs = await db
    .select()
    .from(creditDocuments)
    .where(eq(creditDocuments.lesseeId, lesseeId));

  const docIds = docs.map((d: { id: string }) => d.id);
  if (docIds.length === 0) return res.json({ extractions: [] });

  const extractions = await db
    .select()
    .from(creditExtractions)
    .where(eq(creditExtractions.tenantId, tenantId));

  return res.json({
    extractions: extractions.filter((e: { documentId: string }) => docIds.includes(e.documentId)),
  });
});

router.post("/checklist-runs", async (req: Request, res: Response) => {
  const { tenantId, staffId } = getTenantContext(req);
  if (!tenantId) return res.status(400).json({ message: "Missing tenant context" });
  const parsed = insertCreditChecklistRunSchema.safeParse({ ...req.body, tenantId });
  if (!parsed.success) return res.status(400).json({ message: "Invalid checklist run payload", issues: parsed.error.issues });
  const [row] = await db.insert(creditChecklistRuns).values(parsed.data).returning();
  await appendArchive({
    tenantId,
    subjectType: "credit_checklist_run",
    subjectId: row.id,
    actorStaffId: staffId ?? null,
    eventType: "checklist_run.started",
    payload: { id: row.id, rubricVersion: row.rubricVersion, lesseeId: row.lesseeId },
  });
  return res.status(201).json({ run: row });
});

router.post("/memos", async (req: Request, res: Response) => {
  const { tenantId, staffId } = getTenantContext(req);
  if (!tenantId) return res.status(400).json({ message: "Missing tenant context" });
  const parsed = insertCreditMemoSchema.safeParse({ ...req.body, tenantId });
  if (!parsed.success) return res.status(400).json({ message: "Invalid memo payload", issues: parsed.error.issues });
  const [row] = await db.insert(creditMemos).values(parsed.data).returning();
  await appendArchive({
    tenantId,
    subjectType: "credit_memo",
    subjectId: row.id,
    actorStaffId: staffId ?? null,
    eventType: "memo.drafted",
    payload: { id: row.id, templateVersion: row.templateVersion, aiModel: row.aiModel },
  });
  return res.status(201).json({ memo: row });
});

router.post(
  "/memos/:memoId/approvals",
  requireStaffRole("analyst", "manager", "senior_reviewer", "superadmin"),
  async (req: Request, res: Response) => {
    const { tenantId, staffId } = getTenantContext(req);
    if (!tenantId || !staffId) return res.status(400).json({ message: "Missing tenant or staff context" });
    const memoId = req.params["memoId"] as string;
    const parsed = insertCreditApprovalSchema.safeParse({
      ...req.body,
      tenantId,
      memoId,
      analystStaffId: staffId,
    });
    if (!parsed.success) return res.status(400).json({ message: "Invalid approval payload", issues: parsed.error.issues });
    const [row] = await db.insert(creditApprovals).values(parsed.data).returning();
    await appendArchive({
      tenantId,
      subjectType: "credit_memo",
      subjectId: memoId,
      actorStaffId: staffId,
      eventType: `memo.${row.decision}`,
      payload: { approvalId: row.id, reason: row.reason },
    });
    return res.status(201).json({ approval: row });
  },
);

// ─── Claude-backed pipeline endpoints ───────────────────────────────────────

router.post("/documents/:documentId/classify", async (req: Request, res: Response) => {
  const { tenantId, staffId } = getTenantContext(req);
  if (!tenantId) return res.status(400).json({ message: "Missing tenant context" });
  const documentId = req.params["documentId"] as string;
  const documentText = typeof req.body?.documentText === "string" ? req.body.documentText : "";
  if (!documentText) return res.status(400).json({ message: "documentText required" });

  try {
    const result = await classifyDocument({ tenantId, documentText });
    const [row] = await db
      .update(creditDocuments)
      .set({ classification: result.classification, classificationConfidence: result.confidence })
      .where(and(eq(creditDocuments.id, documentId), eq(creditDocuments.tenantId, tenantId)))
      .returning();
    await appendArchive({
      tenantId,
      subjectType: "credit_document",
      subjectId: documentId,
      actorStaffId: staffId ?? null,
      eventType: "document.classified",
      payload: result,
    });
    return res.json({ document: row, classification: result });
  } catch (err) {
    console.error("[credit classify]", err);
    return res.status(502).json({ message: "Classification failed" });
  }
});

router.post("/documents/:documentId/extract", async (req: Request, res: Response) => {
  const { tenantId, staffId, tenantSlug } = getTenantContext(req);
  if (!tenantId || !tenantSlug) return res.status(400).json({ message: "Missing tenant context" });
  const documentId = req.params["documentId"] as string;
  const documentText = typeof req.body?.documentText === "string" ? req.body.documentText : "";
  if (!documentText) return res.status(400).json({ message: "documentText required" });

  const rubric = await loadTenantYaml<Rubric>(tenantSlug, "credit-checklist.yaml");
  const requested = Array.from(new Set(rubric.rules.flatMap((r) => r.required_inputs)));

  try {
    const result = await extractLineItems({ tenantId, documentText, requestedItems: requested });
    for (const e of result.extractions) {
      await db.insert(creditExtractions).values({
        tenantId,
        documentId,
        lineItem: e.line_item,
        value: e.value,
        unit: e.unit,
        page: e.page,
        bboxJson: null,
        rawText: e.raw_text,
        confidence: e.confidence,
      });
    }
    await appendArchive({
      tenantId,
      subjectType: "credit_document",
      subjectId: documentId,
      actorStaffId: staffId ?? null,
      eventType: "document.extracted",
      payload: { count: result.extractions.length, rubric_version: rubric.version },
    });
    return res.json({ extractions: result.extractions });
  } catch (err) {
    console.error("[credit extract]", err);
    return res.status(502).json({ message: "Extraction failed" });
  }
});

router.post("/checklist-runs/:runId/evaluate", async (req: Request, res: Response) => {
  const { tenantId, staffId, tenantSlug } = getTenantContext(req);
  if (!tenantId || !tenantSlug) return res.status(400).json({ message: "Missing tenant context" });
  const runId = req.params["runId"] as string;

  const [run] = await db
    .select()
    .from(creditChecklistRuns)
    .where(and(eq(creditChecklistRuns.id, runId), eq(creditChecklistRuns.tenantId, tenantId)))
    .limit(1);
  if (!run) return res.status(404).json({ message: "Checklist run not found" });

  const rubric = await loadTenantYaml<Rubric>(tenantSlug, "credit-checklist.yaml");
  const docs = await db.select().from(creditDocuments).where(eq(creditDocuments.lesseeId, run.lesseeId));
  const docIds = docs.map((d: { id: string }) => d.id);

  const rawExtractions = docIds.length === 0
    ? []
    : await db.select().from(creditExtractions).where(eq(creditExtractions.tenantId, tenantId));

  const relevant: ExtractedValue[] = rawExtractions
    .filter((e: { documentId: string }) => docIds.includes(e.documentId))
    .map((e: { lineItem: string; value: string | null; unit: string | null; page: number | null; rawText: string | null; confidence: number | null; documentId: string }) => ({
      line_item: e.lineItem,
      value: e.value,
      unit: e.unit,
      page: e.page,
      raw_text: e.rawText ?? "",
      confidence: e.confidence ?? 0,
      document_id: e.documentId,
    }));

  const evaluation = evaluateChecklist(rubric, relevant);

  const [updated] = await db
    .update(creditChecklistRuns)
    .set({
      rubricVersion: rubric.version,
      status: "complete",
      resultsJson: evaluation as any,
      redFlagCount: evaluation.red_flag_count,
      yellowFlagCount: evaluation.yellow_flag_count,
      completedAt: new Date(),
    })
    .where(eq(creditChecklistRuns.id, runId))
    .returning();

  await appendArchive({
    tenantId,
    subjectType: "credit_checklist_run",
    subjectId: runId,
    actorStaffId: staffId ?? null,
    eventType: "checklist_run.evaluated",
    payload: {
      rubric_version: rubric.version,
      red: evaluation.red_flag_count,
      yellow: evaluation.yellow_flag_count,
    },
  });

  return res.json({ run: updated, evaluation });
});

router.post("/memos/:memoId/draft", async (req: Request, res: Response) => {
  const { tenantId, staffId, tenantSlug } = getTenantContext(req);
  if (!tenantId || !tenantSlug) return res.status(400).json({ message: "Missing tenant context" });
  const memoId = req.params["memoId"] as string;

  const [memo] = await db
    .select()
    .from(creditMemos)
    .where(and(eq(creditMemos.id, memoId), eq(creditMemos.tenantId, tenantId)))
    .limit(1);
  if (!memo) return res.status(404).json({ message: "Memo not found" });
  if (!memo.checklistRunId) return res.status(400).json({ message: "Memo not linked to a checklist run" });

  const [run] = await db
    .select()
    .from(creditChecklistRuns)
    .where(eq(creditChecklistRuns.id, memo.checklistRunId))
    .limit(1);
  if (!run) return res.status(404).json({ message: "Checklist run not found" });

  const [lessee] = await db.select().from(lessees).where(eq(lessees.id, memo.lesseeId)).limit(1);
  const docs = await db.select().from(creditDocuments).where(eq(creditDocuments.lesseeId, memo.lesseeId));
  const docIds = docs.map((d: { id: string }) => d.id);
  const extractions = docIds.length === 0
    ? []
    : (await db.select().from(creditExtractions).where(eq(creditExtractions.tenantId, tenantId)))
        .filter((e: { documentId: string }) => docIds.includes(e.documentId));

  const template = await loadTenantConfigRaw(tenantSlug, "memo-template.md");

  try {
    const result = await draftMemo({
      tenantId,
      lesseeName: lessee?.legalName ?? "Unknown lessee",
      rubricVersion: run.rubricVersion,
      templateMarkdown: template,
      checklistResults: run.resultsJson,
      extractions,
      documentRefs: docs.map((d: { id: string; classification: string | null; sha256: string; pageCount: number | null }) => ({
        id: d.id,
        classification: d.classification,
        sha256: d.sha256,
        page_count: d.pageCount,
      })),
    });

    const [updated] = await db
      .update(creditMemos)
      .set({ draftMarkdown: result.markdown, aiModel: result.model, status: "draft" })
      .where(eq(creditMemos.id, memoId))
      .returning();

    await appendArchive({
      tenantId,
      subjectType: "credit_memo",
      subjectId: memoId,
      actorStaffId: staffId ?? null,
      eventType: "memo.redrafted",
      payload: { model: result.model, length: result.markdown.length },
    });

    return res.json({ memo: updated });
  } catch (err) {
    console.error("[credit memo draft]", err);
    return res.status(502).json({ message: "Memo draft failed" });
  }
});

router.get("/archive", requireStaffRole("compliance", "superadmin"), async (req: Request, res: Response) => {
  const { tenantId } = getTenantContext(req);
  if (!tenantId) return res.status(400).json({ message: "Missing tenant context" });
  const subjectType = typeof req.query["subjectType"] === "string" ? req.query["subjectType"] : null;
  const subjectId = typeof req.query["subjectId"] === "string" ? req.query["subjectId"] : null;

  const base = subjectType && subjectId
    ? and(eq(archiveLog.tenantId, tenantId), eq(archiveLog.subjectType, subjectType), eq(archiveLog.subjectId, subjectId))
    : eq(archiveLog.tenantId, tenantId);

  const rows = await db.select().from(archiveLog).where(base).orderBy(desc(archiveLog.createdAt)).limit(500);
  return res.json({ entries: rows });
});

export default router;
