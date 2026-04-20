// File storage for KB documents on the Railway volume.
//
// All bytes live under `${RAILWAY_VOLUME_MOUNT_PATH}/kb-documents/<tenantId>/<documentId>.<ext>`.
// Keeping tenantId in the path means a rogue `rm -rf <tenantId>/` blast radius
// is contained. Nothing here is exposed via a static route — downloads go
// through an authenticated API that verifies tenant ownership first.

import { promises as fs } from "node:fs";
import path from "node:path";
import { extname } from "node:path";

function volumeRoot(): string {
  // Railway sets RAILWAY_VOLUME_MOUNT_PATH when a volume is attached. Local
  // dev falls back to a repo-relative directory so the feature works without
  // Railway. Tests use KB_DOCUMENTS_ROOT to isolate to a tmpdir.
  return (
    process.env.KB_DOCUMENTS_ROOT
    ?? (process.env.RAILWAY_VOLUME_MOUNT_PATH
      ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, "kb-documents")
      : path.join(process.cwd(), ".data", "kb-documents"))
  );
}

function tenantDir(tenantId: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(tenantId)) {
    throw new Error(`kb-documents: refusing unsafe tenantId "${tenantId}"`);
  }
  return path.join(volumeRoot(), tenantId);
}

export function documentPath(tenantId: string, documentId: string, originalName: string): string {
  const ext = extname(originalName).toLowerCase().replace(/[^a-z0-9.]/g, "");
  return path.join(tenantDir(tenantId), `${documentId}${ext}`);
}

export async function writeDocumentBytes(
  tenantId: string,
  documentId: string,
  originalName: string,
  bytes: Buffer,
): Promise<string> {
  const dir = tenantDir(tenantId);
  await fs.mkdir(dir, { recursive: true });
  const full = documentPath(tenantId, documentId, originalName);
  await fs.writeFile(full, bytes);
  // Return the relative path we persist in DB so moving the volume root
  // later doesn't require a data migration.
  return path.relative(volumeRoot(), full);
}

export async function readDocumentBytes(relativePath: string): Promise<Buffer> {
  const full = path.resolve(volumeRoot(), relativePath);
  if (!full.startsWith(path.resolve(volumeRoot()) + path.sep)) {
    throw new Error("kb-documents: path escapes volume root");
  }
  return fs.readFile(full);
}

export async function deleteDocumentBytes(relativePath: string): Promise<void> {
  const full = path.resolve(volumeRoot(), relativePath);
  if (!full.startsWith(path.resolve(volumeRoot()) + path.sep)) {
    throw new Error("kb-documents: path escapes volume root");
  }
  await fs.unlink(full).catch((err: NodeJS.ErrnoException) => {
    // Missing file is fine — this is a cleanup op that should be idempotent.
    if (err.code !== "ENOENT") throw err;
  });
}
