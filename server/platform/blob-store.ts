import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

// ─────────────────────────────────────────────────────────────────────────────
// BlobStore — the storage boundary for anything binary (uploaded financial
// PDFs, generated unit-sheet PDFs, future artifacts). One interface, two
// implementations. The Berkeley Azure deployment flips on AzureBlobStore via
// env vars without any application code changing.
// ─────────────────────────────────────────────────────────────────────────────

export type PutBlobInput = {
  tenantSlug: string;
  kind: string;
  filename: string;
  mimeType?: string;
  data: Buffer;
};

export type Blob = {
  blobUrl: string;
  sha256: string;
  size: number;
  mimeType: string | null;
};

export interface BlobStore {
  put(input: PutBlobInput): Promise<Blob>;
  get(blobUrl: string): Promise<Buffer>;
}

// ─── Local filesystem impl (dev + Railway) ──────────────────────────────────

const LOCAL_ROOT = path.resolve(process.cwd(), ".blobs");

export class LocalFsBlobStore implements BlobStore {
  async put(input: PutBlobInput): Promise<Blob> {
    const sha256 = createHash("sha256").update(input.data).digest("hex");
    const id = randomUUID();
    const dir = path.join(LOCAL_ROOT, input.tenantSlug, input.kind);
    await mkdir(dir, { recursive: true });
    const absPath = path.join(dir, `${id}-${input.filename}`);
    await writeFile(absPath, input.data);
    return {
      blobUrl: `file://${absPath}`,
      sha256,
      size: input.data.length,
      mimeType: input.mimeType ?? null,
    };
  }

  async get(blobUrl: string): Promise<Buffer> {
    if (!blobUrl.startsWith("file://")) throw new Error("LocalFsBlobStore only handles file:// URLs");
    const absPath = blobUrl.replace(/^file:\/\//, "");
    await stat(absPath); // throws if missing
    return readFile(absPath);
  }
}

// ─── Azure Blob Storage impl ────────────────────────────────────────────────
// Enabled when AZURE_BLOB_ACCOUNT + AZURE_BLOB_CONTAINER + AZURE_BLOB_SAS_TOKEN
// are present. Uses the REST API directly — no @azure/storage-blob dep yet
// (swap in the official SDK once Berkeley IT provisions managed-identity
// auth).

export class AzureBlobStore implements BlobStore {
  constructor(
    private readonly account: string,
    private readonly container: string,
    private readonly sasToken: string,
  ) {}

  private blobUrlFor(blobName: string): string {
    return `https://${this.account}.blob.core.windows.net/${this.container}/${blobName}`;
  }

  private requestUrl(blobName: string): string {
    return `${this.blobUrlFor(blobName)}?${this.sasToken}`;
  }

  async put(input: PutBlobInput): Promise<Blob> {
    const sha256 = createHash("sha256").update(input.data).digest("hex");
    const id = randomUUID();
    const blobName = `${input.tenantSlug}/${input.kind}/${id}-${input.filename}`;

    const res = await fetch(this.requestUrl(blobName), {
      method: "PUT",
      headers: {
        "x-ms-blob-type": "BlockBlob",
        "x-ms-blob-content-type": input.mimeType ?? "application/octet-stream",
        "Content-Length": String(input.data.length),
      },
      // Node's fetch accepts a Buffer at runtime, but TypeScript's lib
      // BodyInit is strict (Node's Uint8Array<ArrayBufferLike> vs the web
      // Uint8Array<ArrayBuffer> disagreement). The cast is safe: Node's
      // undici fetch handles Buffer natively.
      body: input.data as unknown as BodyInit,
    });

    if (!res.ok) {
      throw new Error(`Azure Blob PUT failed: ${res.status} ${await res.text()}`);
    }

    return {
      blobUrl: this.blobUrlFor(blobName),
      sha256,
      size: input.data.length,
      mimeType: input.mimeType ?? null,
    };
  }

  async get(blobUrl: string): Promise<Buffer> {
    if (!blobUrl.startsWith(`https://${this.account}.blob.core.windows.net`)) {
      throw new Error("AzureBlobStore received a blobUrl for a different account");
    }
    const res = await fetch(`${blobUrl}?${this.sasToken}`);
    if (!res.ok) throw new Error(`Azure Blob GET failed: ${res.status}`);
    const arr = await res.arrayBuffer();
    return Buffer.from(arr);
  }
}

// ─── Factory ────────────────────────────────────────────────────────────────

let singleton: BlobStore | null = null;

export function getBlobStore(): BlobStore {
  if (singleton) return singleton;
  const account = process.env["AZURE_BLOB_ACCOUNT"];
  const container = process.env["AZURE_BLOB_CONTAINER"];
  const sas = process.env["AZURE_BLOB_SAS_TOKEN"];
  if (account && container && sas) {
    singleton = new AzureBlobStore(account, container, sas);
  } else {
    singleton = new LocalFsBlobStore();
  }
  return singleton;
}

export function __resetBlobStoreForTests() {
  singleton = null;
}
