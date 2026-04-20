// Voyage AI embeddings. Voyage is Anthropic's recommended embedding
// partner; we use their HTTP API directly rather than pulling in the
// voyageai Node SDK (one less dep, trivial surface).
//
// Env: VOYAGE_API_KEY. If unset, embedding calls throw; the caller
// (upload/reextract path) catches and marks the document as "failed"
// on the chunks side without poisoning the rest of the row.

const VOYAGE_URL = "https://api.voyageai.com/v1/embeddings";
const VOYAGE_MODEL = "voyage-3-large";
const VOYAGE_BATCH_MAX = 128;
// Truncate input text before send — voyage-3-large accepts 32k tokens but
// we don't count tokens client-side; char length ~4x tokens, so 120k chars
// is a safe upper bound per chunk. Our chunks are 800 chars so this never
// trips in practice; exists to catch pathological upstream bugs.
const VOYAGE_MAX_INPUT_CHARS = 120_000;

export class EmbeddingProviderError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(`voyage: ${message}`);
    this.name = "EmbeddingProviderError";
  }
}

interface VoyageResponse {
  data: { embedding: number[]; index: number }[];
  model: string;
  usage: { total_tokens: number };
}

export function embeddingsConfigured(): boolean {
  return typeof process.env.VOYAGE_API_KEY === "string" && process.env.VOYAGE_API_KEY.length > 0;
}

async function embedBatch(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) throw new EmbeddingProviderError("VOYAGE_API_KEY missing");

  const res = await fetch(VOYAGE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: texts.map((t) => (t.length > VOYAGE_MAX_INPUT_CHARS ? t.slice(0, VOYAGE_MAX_INPUT_CHARS) : t)),
      model: VOYAGE_MODEL,
      output_dimension: 1024,
      input_type: "document",
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new EmbeddingProviderError(`HTTP ${res.status}: ${body.slice(0, 200)}`);
  }

  const json = (await res.json()) as VoyageResponse;
  // Voyage returns entries in request order with .index, but sort defensively.
  return json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += VOYAGE_BATCH_MAX) {
    const batch = texts.slice(i, i + VOYAGE_BATCH_MAX);
    const embeddings = await embedBatch(batch);
    if (embeddings.length !== batch.length) {
      throw new EmbeddingProviderError(
        `batch returned ${embeddings.length} embeddings for ${batch.length} inputs`,
      );
    }
    out.push(...embeddings);
  }
  return out;
}

// Embed a single query at retrieval time. Voyage wants input_type="query"
// for retrieval queries — it applies asymmetric embedding tuning so the
// query matches documents better than cosine over a shared-type embedding.
export async function embedQuery(text: string): Promise<number[]> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) throw new EmbeddingProviderError("VOYAGE_API_KEY missing");

  const res = await fetch(VOYAGE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: [text],
      model: VOYAGE_MODEL,
      output_dimension: 1024,
      input_type: "query",
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new EmbeddingProviderError(`HTTP ${res.status}: ${body.slice(0, 200)}`);
  }

  const json = (await res.json()) as VoyageResponse;
  const embedding = json.data[0]?.embedding;
  if (!embedding) throw new EmbeddingProviderError("empty response");
  return embedding;
}
