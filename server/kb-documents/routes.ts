// Admin API for KB documents. Mounted under /api/knowledge/documents by
// knowledge-routes.ts. All routes are tenant-scoped via the authenticated
// staff session and gated behind requireAdmin upstream.
//
// Flow on upload:
//   multer parses multipart → write bytes to volume → insert row (pending)
//   → extract inline → update row (done|failed). Extraction failure does
//   NOT fail the upload — the file is still stored and downloadable, only
//   the text index is missing. Operators can retry via POST /:id/reextract.

import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import {
  createKbDocument,
  deleteKbDocument,
  getKbDocument,
  listKbDocuments,
  setKbDocumentExtract,
} from "./storage-db.js";
import {
  deleteDocumentBytes,
  readDocumentBytes,
  writeDocumentBytes,
} from "./storage.js";
import { extractText, UnsupportedMimeTypeError } from "./extract.js";
import { kbDocumentKinds, type KbDocumentKind } from "../../shared/schema.js";

const router = Router();

// 25 MB cap — PDFs bigger than this almost always need to be split per
// the plan. We surface a clear error rather than letting Railway timeout.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

function sessTenantId(req: { session?: unknown }): string | null {
  const sess = req.session as { staffTenantId?: string | null } | undefined;
  return typeof sess?.staffTenantId === "string" && sess.staffTenantId ? sess.staffTenantId : null;
}

function sessStaffId(req: { session?: unknown }): string | null {
  const sess = req.session as { staffId?: string | null } | undefined;
  return typeof sess?.staffId === "string" && sess.staffId ? sess.staffId : null;
}

const UploadMetaSchema = z.object({
  kind: z.enum(kbDocumentKinds),
  title: z.string().trim().min(1).max(200).optional(),
  propertyId: z.string().trim().uuid().optional(),
});

router.get("/", async (req, res) => {
  try {
    const tenantId = sessTenantId(req);
    if (!tenantId) return res.status(403).json({ message: "Tenant context required" });
    const docs = await listKbDocuments(tenantId);
    // Don't ship raw extractedText in list responses — can be large.
    res.json(
      docs.map((d) => ({
        id: d.id,
        propertyId: d.propertyId,
        kind: d.kind as KbDocumentKind,
        title: d.title,
        originalName: d.originalName,
        mimeType: d.mimeType,
        sizeBytes: d.sizeBytes,
        extractStatus: d.extractStatus,
        extractError: d.extractError,
        extractedCharCount: d.extractedText?.length ?? 0,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      })),
    );
  } catch (err) {
    console.error("[kb-documents list]", err);
    res.status(500).json({ message: "Unable to list documents" });
  }
});

router.post("/", upload.single("file"), async (req, res) => {
  try {
    const tenantId = sessTenantId(req);
    if (!tenantId) return res.status(403).json({ message: "Tenant context required" });
    if (!req.file) return res.status(400).json({ message: "Missing 'file' in multipart body" });

    const meta = UploadMetaSchema.safeParse({
      kind: req.body?.kind,
      title: req.body?.title,
      propertyId: req.body?.propertyId,
    });
    if (!meta.success) {
      return res.status(400).json({ message: meta.error.issues[0]?.message ?? "Invalid metadata" });
    }

    const staffId = sessStaffId(req);
    const row = await createKbDocument({
      tenantId,
      propertyId: meta.data.propertyId ?? null,
      kind: meta.data.kind,
      title: meta.data.title ?? req.file.originalname,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
      storagePath: "", // fill after write
      uploadedByStaffId: staffId,
    });

    // Write bytes using the new row's id so the on-disk name is stable.
    let relativePath: string;
    try {
      relativePath = await writeDocumentBytes(tenantId, row.id, req.file.originalname, req.file.buffer);
    } catch (err) {
      // Roll back the DB row if volume write fails — keeping a dangling
      // row that points at nothing will only confuse operators.
      await deleteKbDocument(row.id, tenantId);
      throw err;
    }

    // Second update to patch storage_path now that we know it. (Alternative:
    // compute the path from id before insert; kept in two steps because the
    // id isn't known until after insert when defaulted by gen_random_uuid.)
    await setKbDocumentExtract(row.id, tenantId, { status: "pending" });
    const { db } = await import("../db.js");
    const { kbDocuments } = await import("../../shared/schema.js");
    const { and, eq } = await import("drizzle-orm");
    await db
      .update(kbDocuments)
      .set({ storagePath: relativePath, updatedAt: new Date() })
      .where(and(eq(kbDocuments.id, row.id), eq(kbDocuments.tenantId, tenantId)));

    // Extraction inline. Failure is captured but does NOT 500 the upload —
    // the file is still safely stored and the operator can retry.
    try {
      const { text } = await extractText(req.file.mimetype, req.file.buffer);
      await setKbDocumentExtract(row.id, tenantId, { status: "done", text });
    } catch (err) {
      const message =
        err instanceof UnsupportedMimeTypeError
          ? `Unsupported file type: ${req.file.mimetype}. Supported: PDF, DOCX, plain text.`
          : err instanceof Error
          ? err.message
          : "Extraction failed";
      await setKbDocumentExtract(row.id, tenantId, { status: "failed", error: message });
    }

    const updated = await getKbDocument(row.id, tenantId);
    res.status(201).json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[kb-documents upload]", message);
    res.status(500).json({ message: "Unable to upload document" });
  }
});

router.get("/:id/download", async (req, res) => {
  try {
    const tenantId = sessTenantId(req);
    if (!tenantId) return res.status(403).json({ message: "Tenant context required" });
    const row = await getKbDocument(req.params["id"] as string, tenantId);
    if (!row) return res.status(404).json({ message: "Document not found" });
    const bytes = await readDocumentBytes(row.storagePath);
    res.setHeader("Content-Type", row.mimeType);
    res.setHeader("Content-Disposition", `attachment; filename="${row.originalName.replace(/"/g, "")}"`);
    res.send(bytes);
  } catch (err) {
    console.error("[kb-documents download]", err);
    res.status(500).json({ message: "Unable to download document" });
  }
});

router.post("/:id/reextract", async (req, res) => {
  try {
    const tenantId = sessTenantId(req);
    if (!tenantId) return res.status(403).json({ message: "Tenant context required" });
    const row = await getKbDocument(req.params["id"] as string, tenantId);
    if (!row) return res.status(404).json({ message: "Document not found" });

    try {
      const bytes = await readDocumentBytes(row.storagePath);
      const { text } = await extractText(row.mimeType, bytes);
      await setKbDocumentExtract(row.id, tenantId, { status: "done", text });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await setKbDocumentExtract(row.id, tenantId, { status: "failed", error: message });
    }

    const updated = await getKbDocument(row.id, tenantId);
    res.json(updated);
  } catch (err) {
    console.error("[kb-documents reextract]", err);
    res.status(500).json({ message: "Unable to re-extract document" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const tenantId = sessTenantId(req);
    if (!tenantId) return res.status(403).json({ message: "Tenant context required" });
    const row = await getKbDocument(req.params["id"] as string, tenantId);
    if (!row) return res.status(404).json({ message: "Document not found" });
    await deleteKbDocument(row.id, tenantId);
    // Best-effort file cleanup — row is already gone from DB, so a failure
    // here leaves an orphan byte-blob but no broken UI. We log and move on.
    try {
      await deleteDocumentBytes(row.storagePath);
    } catch (err) {
      console.error("[kb-documents delete-bytes]", err);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("[kb-documents delete]", err);
    res.status(500).json({ message: "Unable to delete document" });
  }
});

export default router;
