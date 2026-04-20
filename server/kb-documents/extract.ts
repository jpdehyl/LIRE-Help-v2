// Extract plaintext from uploaded KB documents. Dispatch by MIME type:
// PDF → pdf-parse, DOCX → mammoth, text/markdown → passthrough. Other
// types (images, drawings) currently throw; Phase 2 adds Claude vision.
//
// Kept small and synchronous on purpose — Phase 1 runs extraction inline
// in the upload request. If PDFs get huge (>10MB) we'll move this to a
// queued worker in Phase 2.

import mammoth from "mammoth";

export interface ExtractResult {
  text: string;
  // Informational — how many chars of text we recovered. Not used for
  // chunking yet (Phase 2) but useful for surfacing "0-char extract" as a
  // failure mode in the UI.
  charCount: number;
}

export class UnsupportedMimeTypeError extends Error {
  constructor(mimeType: string) {
    super(`kb-documents: no extractor for mime type "${mimeType}"`);
    this.name = "UnsupportedMimeTypeError";
  }
}

export async function extractText(mimeType: string, bytes: Buffer): Promise<ExtractResult> {
  const mt = mimeType.toLowerCase();

  if (mt === "application/pdf") {
    // pdf-parse 2.x is ESM and exposes a PDFParse class. Instantiate per
    // call since each parser owns a pdfjs document handle we must destroy.
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: bytes });
    try {
      const out = await parser.getText();
      const text = out.text ?? "";
      return { text, charCount: text.length };
    } finally {
      await parser.destroy().catch(() => {});
    }
  }

  if (
    mt === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    || mt === "application/msword"
  ) {
    const { value } = await mammoth.extractRawText({ buffer: bytes });
    return { text: value ?? "", charCount: value?.length ?? 0 };
  }

  if (mt.startsWith("text/")) {
    const text = bytes.toString("utf8");
    return { text, charCount: text.length };
  }

  throw new UnsupportedMimeTypeError(mimeType);
}
