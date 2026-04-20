// Character-based chunking with overlap. Good enough for v1 — Voyage
// voyage-3-large accepts up to 32k tokens per input so our 800-char chunks
// are well inside the limit with headroom for any multibyte oddities.
//
// We chunk on paragraph boundaries when possible (\n\n splits), falling
// back to word and finally character splits. Keeps chunks semantically
// coherent so embeddings aren't mid-sentence hash. Page labels come from
// the caller — this module stays format-agnostic.

export interface ChunkOptions {
  // Soft target size. Chunks may exceed by up to ~20% to avoid breaking
  // mid-paragraph when a paragraph is larger than chunkSize.
  chunkSize?: number;
  overlap?: number;
}

const DEFAULT_CHUNK_SIZE = 800;
const DEFAULT_OVERLAP = 100;

export function chunkText(text: string, opts: ChunkOptions = {}): string[] {
  const chunkSize = opts.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const overlap = opts.overlap ?? DEFAULT_OVERLAP;
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];
  if (normalized.length <= chunkSize) return [normalized];

  const chunks: string[] = [];
  let cursor = 0;
  while (cursor < normalized.length) {
    const end = Math.min(cursor + chunkSize, normalized.length);
    let slice = normalized.slice(cursor, end);

    if (end < normalized.length) {
      // Prefer breaking on the last paragraph or sentence boundary inside
      // the slice so chunks end cleanly. Only bother if we're not at the
      // very end of the document.
      const lastBreak = Math.max(
        slice.lastIndexOf("\n\n"),
        slice.lastIndexOf("\n"),
        slice.lastIndexOf(". "),
      );
      if (lastBreak > chunkSize * 0.6) {
        slice = slice.slice(0, lastBreak + 1);
      }
    }

    chunks.push(slice.trim());
    if (cursor + slice.length >= normalized.length) break;
    cursor += Math.max(1, slice.length - overlap);
  }

  return chunks.filter((c) => c.length > 0);
}
