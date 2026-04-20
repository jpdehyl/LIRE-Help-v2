// Chunk + embed + persist a document's text so it becomes retrievable
// through lookup_knowledge. Called after extraction in the upload path
// and from the backfill endpoint for documents uploaded before Phase 2.
//
// Idempotent: deletes existing chunks for the document before inserting
// the new set. Safe to call repeatedly after a re-extract.

import { chunkText } from "./chunk.js";
import { embedTexts, embeddingsConfigured, EmbeddingProviderError } from "./embed.js";
import {
  deleteChunksForDocument,
  getKbDocument,
  insertChunks,
  type InsertChunk,
} from "./storage-db.js";

export interface IndexResult {
  chunkCount: number;
  embedded: boolean;
  reason?: string;
}

// Populate kb_document_chunks for one document. Assumes the document's
// extractedText is already up to date. Returns { embedded: false } with
// a reason when VOYAGE_API_KEY is unset — chunks still land in the DB
// so text search remains possible, they just lack vectors until the key
// is configured and the document is re-indexed.
export async function indexDocument(documentId: string, tenantId: string): Promise<IndexResult> {
  const doc = await getKbDocument(documentId, tenantId);
  if (!doc) throw new Error(`kb-documents: document ${documentId} not found for tenant ${tenantId}`);
  if (!doc.extractedText || !doc.extractedText.trim()) {
    await deleteChunksForDocument(documentId, tenantId);
    return { chunkCount: 0, embedded: false, reason: "no extracted text" };
  }

  const slices = chunkText(doc.extractedText);
  await deleteChunksForDocument(documentId, tenantId);

  if (slices.length === 0) return { chunkCount: 0, embedded: false, reason: "chunking produced 0 slices" };

  let embeddings: number[][] | null = null;
  let embedded = false;
  let reason: string | undefined;

  if (embeddingsConfigured()) {
    try {
      embeddings = await embedTexts(slices);
      embedded = true;
    } catch (err) {
      // Don't throw — we still want to persist the chunks so operators can
      // see what was extracted. Reason surfaces to the caller for logs.
      reason = err instanceof EmbeddingProviderError ? err.message : err instanceof Error ? err.message : String(err);
    }
  } else {
    reason = "VOYAGE_API_KEY not configured";
  }

  const rows: InsertChunk[] = slices.map((content, i) => ({
    documentId,
    tenantId,
    chunkIndex: i,
    content,
    charCount: content.length,
    pageLabel: null,
    embedding: embeddings ? embeddings[i] ?? null : null,
  }));

  await insertChunks(rows);
  return { chunkCount: rows.length, embedded, reason };
}
