// DB helpers for kb_documents. Kept separate from server/storage.ts to
// avoid bloating that file while the feature grows. All queries are
// tenant-scoped by construction.

import { and, desc, eq } from "drizzle-orm";
import { db } from "../db.js";
import { kbDocuments } from "../../shared/schema.js";
import type {
  KbDocument,
  KbDocumentExtractStatus,
  KbDocumentKind,
} from "../../shared/schema.js";

export interface InsertKbDocument {
  tenantId: string;
  propertyId: string | null;
  kind: KbDocumentKind;
  title: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  uploadedByStaffId: string | null;
}

export async function listKbDocuments(tenantId: string): Promise<KbDocument[]> {
  return db
    .select()
    .from(kbDocuments)
    .where(eq(kbDocuments.tenantId, tenantId))
    .orderBy(desc(kbDocuments.createdAt));
}

export async function getKbDocument(id: string, tenantId: string): Promise<KbDocument | null> {
  const rows = await db
    .select()
    .from(kbDocuments)
    .where(and(eq(kbDocuments.id, id), eq(kbDocuments.tenantId, tenantId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function createKbDocument(input: InsertKbDocument): Promise<KbDocument> {
  const [row] = await db
    .insert(kbDocuments)
    .values({
      tenantId: input.tenantId,
      propertyId: input.propertyId,
      kind: input.kind,
      title: input.title,
      originalName: input.originalName,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      storagePath: input.storagePath,
      uploadedByStaffId: input.uploadedByStaffId,
    })
    .returning();
  return row!;
}

export async function setKbDocumentExtract(
  id: string,
  tenantId: string,
  patch: { status: KbDocumentExtractStatus; text?: string | null; error?: string | null },
): Promise<void> {
  await db
    .update(kbDocuments)
    .set({
      extractStatus: patch.status,
      extractedText: patch.text ?? null,
      extractError: patch.error ?? null,
      updatedAt: new Date(),
    })
    .where(and(eq(kbDocuments.id, id), eq(kbDocuments.tenantId, tenantId)));
}

export async function deleteKbDocument(id: string, tenantId: string): Promise<KbDocument | null> {
  const rows = await db
    .delete(kbDocuments)
    .where(and(eq(kbDocuments.id, id), eq(kbDocuments.tenantId, tenantId)))
    .returning();
  return rows[0] ?? null;
}
