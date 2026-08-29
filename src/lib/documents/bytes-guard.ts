/**
 * Reject any attempt to send raw file contents through Pillar.
 * Upload sessions accept metadata only (filename + MIME). Completions
 * accept a session id only. Never persist bytes, base64, OCR, or extracted PII.
 */
const FILE_PAYLOAD_KEYS = [
  "file",
  "files",
  "bytes",
  "byte",
  "base64",
  "content",
  "buffer",
  "blob",
  "arraybuffer",
  "filebytes",
  "raw",
  "payload",
  "body",
  "filecontent",
  "documentcontent",
  "ocr",
  "extractedtext",
  "textcontent",
];

function isBinaryPayload(value: unknown): boolean {
  if (value == null) {
    return false;
  }
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(value)) {
    return true;
  }
  if (typeof ArrayBuffer !== "undefined" && value instanceof ArrayBuffer) {
    return true;
  }
  if (typeof ArrayBuffer !== "undefined" && ArrayBuffer.isView(value)) {
    return true;
  }
  if (typeof Blob !== "undefined" && value instanceof Blob) {
    return true;
  }
  return false;
}

export function assertNoFilePayload(input: unknown): void {
  if (input == null) {
    return;
  }
  if (isBinaryPayload(input)) {
    throw new Error("Raw file bytes are not accepted.");
  }
  if (typeof input !== "object") {
    return;
  }

  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (value == null || value === "") {
      continue;
    }
    if (FILE_PAYLOAD_KEYS.includes(key.toLowerCase()) || isBinaryPayload(value)) {
      throw new Error("Raw file bytes are not accepted.");
    }
  }
}

export function isValidSandboxFileName(fileName: string): boolean {
  const trimmed = fileName.trim();
  if (trimmed.length < 1 || trimmed.length > 180) {
    return false;
  }
  if (/[\\/\0]/.test(trimmed)) {
    return false;
  }
  return true;
}
