// DB helpers for kb_documents. Kept separate from server/storage.ts to
// avoid bloating that file while the feature grows. All queries are
// tenant-scoped by construction.

import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../db.js";
import { kbDocumentChunks, kbDocuments } from "../../shared/schema.js";
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

// ─── Chunks ─────────────────────────────────────────────────────────────────

export async function deleteChunksForDocument(documentId: string, tenantId: string): Promise<void> {
  await db
    .delete(kbDocumentChunks)
    .where(and(eq(kbDocumentChunks.documentId, documentId), eq(kbDocumentChunks.tenantId, tenantId)));
}

export interface InsertChunk {
  documentId: string;
  tenantId: string;
  chunkIndex: number;
  content: string;
  charCount: number;
  pageLabel: string | null;
  embedding: number[] | null;
}

export async function insertChunks(chunks: InsertChunk[]): Promise<void> {
  if (chunks.length === 0) return;
  await db.insert(kbDocumentChunks).values(chunks);
}

export async function countChunksForDocument(documentId: string, tenantId: string): Promise<number> {
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(kbDocumentChunks)
    .where(and(eq(kbDocumentChunks.documentId, documentId), eq(kbDocumentChunks.tenantId, tenantId)));
  return rows[0]?.n ?? 0;
}

export interface ChunkHit {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  documentKind: string;
  pageLabel: string | null;
  content: string;
  distance: number; // 0 = identical, smaller is better (cosine distance).
}

// Vector top-K over a tenant's chunks. The embedding is passed as a JSON-array
// literal cast to `vector` — portable across pg drivers without parameter-type
// inference surprises. pgvector's <=> is cosine distance; ORDER BY uses the
// ivfflat index from the migration.
export async function searchChunksByEmbedding(
  tenantId: string,
  embedding: number[],
  limit: number,
): Promise<ChunkHit[]> {
  const embeddingLiteral = JSON.stringify(embedding);
  const rows = await db.execute<{
    chunk_id: string;
    document_id: string;
    document_title: string;
    document_kind: string;
    page_label: string | null;
    content: string;
    distance: number;
  }>(sql`
    SELECT
      c.id           AS chunk_id,
      c.document_id  AS document_id,
      d.title        AS document_title,
      d.kind         AS document_kind,
      c.page_label,
      c.content,
      c.embedding <=> ${embeddingLiteral}::vector AS distance
    FROM kb_document_chunks c
    JOIN kb_documents d ON d.id = c.document_id
    WHERE c.tenant_id = ${tenantId}
      AND c.embedding IS NOT NULL
    ORDER BY c.embedding <=> ${embeddingLiteral}::vector
    LIMIT ${limit}
  `);

  const anyRows = rows as unknown as { rows?: unknown[] };
  const list = Array.isArray(anyRows.rows) ? (anyRows.rows as unknown[]) : (rows as unknown as unknown[]);
  return (list as Array<{
    chunk_id: string;
    document_id: string;
    document_title: string;
    document_kind: string;
    page_label: string | null;
    content: string;
    distance: number | string;
  }>).map((r) => ({
    chunkId: r.chunk_id,
    documentId: r.document_id,
    documentTitle: r.document_title,
    documentKind: r.document_kind,
    pageLabel: r.page_label,
    content: r.content,
    distance: Number(r.distance),
  }));
}
