# KB Documents — leases, drawings, policy PDFs

**Goal:** Let operators drop documents (lease contracts, site drawings, policy PDFs, vendor SOWs) into the KB and have the concierge agent cite from them at answer time. Today the KB is a single-row `platform_knowledge` text table — no files, no embeddings, no property scoping for docs.

**Shape:** Railway volume for bytes, Postgres for metadata + extracted text + vector chunks, pgvector for retrieval, a new `lookup_document` custom tool (or extend `lookup_knowledge`) surfaced to the concierge agent. Embedding provider is Voyage (Anthropic's recommended partner — already aligned with our stack). No new runtime.

## Architecture

```
upload ──▶ multer ──▶ Railway volume: /data/kb-documents/<tenantId>/<uuid>.<ext>
             │
             └──▶ extract (pdf-parse | mammoth | Claude vision for images)
                     │
                     └──▶ chunk (~800 tokens, overlap 100)
                             │
                             └──▶ embed (Voyage voyage-3-large)
                                     │
                                     └──▶ insert kb_document_chunks
```

At retrieval time: `lookup_document(query, kind?, property_id?)` embeds the query, pgvector cosine-top-K, returns chunk text + citations (document title, section/page).

## Data model

**`kb_documents`** — one row per uploaded file.

```ts
id             varchar pk default gen_random_uuid()
tenantId       varchar → tenants.id notNull
propertyId     varchar → properties.id nullable  // null = operator-wide
kind           text notNull  // 'lease'|'drawing'|'policy'|'sow'|'other'
title          text notNull  // operator-editable, defaults to filename
originalName   text notNull
mimeType       text notNull
sizeBytes      integer notNull
storagePath    text notNull  // relative to RAILWAY_VOLUME_MOUNT_PATH
extractStatus  text notNull default 'pending'  // 'pending'|'done'|'failed'
extractError   text
uploadedBy     varchar → staffUsers.id
uploadedAt     timestamp default now()
```

**`kb_document_chunks`** — retrievable units with embeddings.

```ts
id            varchar pk
documentId    varchar → kb_documents.id notNull on delete cascade
chunkIndex    integer notNull
content       text notNull
tokenCount    integer
pageLabel     text  // e.g. "p.3" or "Section 4.2" — citation hint
embedding     vector(1024)  // voyage-3-large
// index: ivfflat on embedding (cosine_ops), btree on (tenantId, documentId)
```

Tenant scope: queries join `kb_documents` on `tenantId = $sess.staffTenantId`. Never query chunks alone.

## Storage — Railway volume

- Mount a volume at `/data` on the Railway service; env `RAILWAY_VOLUME_MOUNT_PATH=/data`.
- Files live at `<mount>/kb-documents/<tenantId>/<documentId>.<ext>`. Keeping tenant in the path lets a bad-case `rm -rf <tenantId>/` isolate blast radius.
- All reads go through a `getDocumentBytes(tenantId, documentId)` helper that verifies the row belongs to the tenant before `fs.readFile`. Never expose the volume via a static route.
- Max size: 25 MB per file (multer limit). Drawings/PDFs larger than that should be split by the operator.

## Extraction

One extractor per `mimeType`, all sync (small files) or queued (larger). Start sync — we're not at queue-worth volume yet.

- `application/pdf` → `pdf-parse` → text per page, preserving page boundaries as `pageLabel`.
- `application/vnd.openxmlformats-officedocument.wordprocessingml.document` → `mammoth` → text with heading markers.
- `image/png` | `image/jpeg` → Claude vision (`claude-opus-4-7`) with a fixed prompt: "Describe this document/drawing as structured plaintext suitable for retrieval. Preserve labels, measurements, room names, and any printed text verbatim." Cheap relative to getting a human to transcribe a floor plan.
- `text/plain` | `text/markdown` → pass-through.

Store raw extracted text on `kb_documents.extractedText` (audit + re-chunk without re-parsing). Failed extractions set `extractStatus='failed'` and `extractError`; the upload still succeeds so the operator can retry.

## Chunking

Token-aware sliding window via `@anthropic-ai/tokenizer` (already in our bundle) — 800 tokens, 100 overlap. For PDFs, chunk within page boundaries so `pageLabel` stays truthful. For DOCX, chunk within top-level heading.

## Embeddings

- Provider: Voyage AI (Anthropic's recommended partner). New dep `voyageai`. Env `VOYAGE_API_KEY` on Railway.
- Model: `voyage-3-large` (1024-dim). Batch 128 chunks per call.
- At query time, embed the tenant's query once and reuse for retrieval.

## Retrieval

Option A (preferred — minimal surface): extend `lookup_knowledge` to also search document chunks. Current shape returns `{ entries }`; add an `includes_documents: boolean` flag and a `documents[]` section in the response. Agent already knows when to call it — one tool is easier for the model to use well than two.

Option B: new `lookup_document` tool with `kind` and `property_id` filters. Cleaner separation but forces the agent to pick between two tools. Skip unless we see the agent misusing A.

Go with A for v1; split to B if telemetry shows the agent under-using documents.

## Upload UX

New `/settings/workspace/documents` page (extend the existing KB editor). Table of uploaded docs with kind, title, property, status, actions (rename, reassign, delete, re-extract). Drag-and-drop or file picker. No inline preview in v1 — link to download via signed-ish short-lived token URL (session-scoped, not public).

## Server surface

- `POST /api/knowledge/documents` — multer → volume write → DB insert (status=pending) → kick extraction → return row. Admin-only.
- `GET  /api/knowledge/documents` — tenant-scoped list with filters.
- `GET  /api/knowledge/documents/:id/download` — streams from volume after tenant check.
- `DELETE /api/knowledge/documents/:id` — cascades chunks, unlinks file.
- `POST /api/knowledge/documents/:id/reextract` — idempotent retry.

All routes gated by `requireAdmin` (same as existing KB routes).

## Rollout

1. **Schema + volume + upload + extract** — ship behind admin UI only. No agent wiring yet. Validate on real Berkeley lease PDFs and a floor plan. (~1 day.)
2. **Embeddings + pgvector + retrieval extension to `lookup_knowledge`** — flip the agent on for document retrieval. Measure cost per conversation (chunks × tokens). (~1 day.)
3. **Operator polish** — rename / reassign / re-extract. Download. Property-scoped filter in the agent tool. (~0.5 day.)

## Open questions

- Do we redact PII out of extracted text before embedding (SSN, bank account) or rely on tenant isolation? Leases have sensitive numbers. Lean: scrub obvious patterns (regex for SSN / routing / account) before embed, keep raw in `extractedText` behind admin-only read.
- Deletion semantics — hard delete vs. soft delete with a tombstone. If we get a compliance request to remove a former tenant's lease we need hard delete of bytes + chunks. Start hard-delete-only.
- Vector index tuning — ivfflat defaults are fine for <100k chunks. Revisit when a tenant exceeds that.

## Not in scope

- OCR of handwritten notes (Claude vision is good enough for typed/printed content).
- Multi-file "packet" handling (e.g. lease + amendments as one unit). Treat each file as one document; link via a shared `title` convention for v1.
- Re-embedding on model upgrade. When we bump voyage-3-large → next, we'll re-embed in a single batch job and swap the index; not worth building a UI for.
