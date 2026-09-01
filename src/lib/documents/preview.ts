/**
 * Human-facing document preview helpers.
 *
 * Preview is for processor review only. It never feeds Document Intelligence,
 * Processor Assist, or any AI path. Temporary URLs stay ephemeral in the
 * browser and are not persisted.
 */

export const PREVIEWABLE_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
] as const;

export type PreviewKind = "pdf" | "image" | "unsupported";

export type PreviewAccess = {
  url: string;
  expiresAt: string;
  simulated: boolean;
};

export type PreviewDisplay =
  | { mode: "unsupported"; fileName: string; kindLabel: string }
  | { mode: "loading"; fileName: string; kindLabel: string }
  | { mode: "unavailable"; fileName: string; kindLabel: string; canRetry: true }
  | {
      mode: "sandbox";
      fileName: string;
      kindLabel: string;
      kind: "pdf" | "image";
    }
  | {
      mode: "pdf";
      fileName: string;
      kindLabel: string;
      url: string;
    }
  | {
      mode: "image";
      fileName: string;
      kindLabel: string;
      url: string;
    };

const IMAGE_MIME = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const IMAGE_EXT = new Set(["jpg", "jpeg", "png", "webp"]);

export function fileExtension(fileName: string | null | undefined): string {
  const name = (fileName ?? "").trim().toLowerCase();
  const dot = name.lastIndexOf(".");
  if (dot < 0 || dot === name.length - 1) {
    return "";
  }
  return name.slice(dot + 1);
}

export function previewKindFromFile(input: {
  mimeType?: string | null;
  fileName?: string | null;
}): PreviewKind {
  const mime = (input.mimeType ?? "").trim().toLowerCase();
  if (mime === "application/pdf" || mime === "application/x-pdf") {
    return "pdf";
  }
  if (IMAGE_MIME.has(mime)) {
    return "image";
  }
  const ext = fileExtension(input.fileName);
  if (ext === "pdf") {
    return "pdf";
  }
  if (IMAGE_EXT.has(ext)) {
    return "image";
  }
  return "unsupported";
}

export function previewKindLabel(kind: PreviewKind, fileName?: string | null): string {
  if (kind === "pdf") {
    return "PDF";
  }
  if (kind === "image") {
    const ext = fileExtension(fileName);
    if (ext === "png") return "PNG";
    if (ext === "webp") return "WEBP";
    if (ext === "jpg" || ext === "jpeg") return "JPEG";
    return "IMAGE";
  }
  const ext = fileExtension(fileName);
  return ext ? ext.toUpperCase() : "FILE";
}

export function shouldRequestPreviewAccess(kind: PreviewKind): boolean {
  return kind === "pdf" || kind === "image";
}

export function resolvePreviewDisplay(input: {
  fileName: string;
  mimeType?: string | null;
  loading: boolean;
  failed: boolean;
  access: PreviewAccess | null;
}): PreviewDisplay {
  const kind = previewKindFromFile(input);
  const kindLabel = previewKindLabel(kind, input.fileName);
  const fileName = input.fileName.trim() || "Document";

  if (kind === "unsupported") {
    return { mode: "unsupported", fileName, kindLabel };
  }
  if (input.loading && !input.access) {
    return { mode: "loading", fileName, kindLabel };
  }
  if (input.failed || !input.access) {
    return { mode: "unavailable", fileName, kindLabel, canRetry: true };
  }
  if (input.access.simulated) {
    return { mode: "sandbox", fileName, kindLabel, kind };
  }
  if (kind === "pdf") {
    return { mode: "pdf", fileName, kindLabel, url: input.access.url };
  }
  return { mode: "image", fileName, kindLabel, url: input.access.url };
}

export const PREVIEW_COPY = {
  unsupported: "Preview unavailable for this file type.",
  unavailable: "Preview unavailable.",
  sandbox:
    "File preview is unavailable because mock storage does not retain document contents.",
  retry: "Try again",
  refresh: "Refresh preview",
  openTab: "Open in new tab",
} as const;

export const DOCUMENT_INTELLIGENCE_PREVIEW_FORBIDDEN_KEYS = [
  "bytes",
  "base64",
  "blob",
  "arrayBuffer",
  "ocr",
  "previewUrl",
  "downloadUrl",
  "accessUrl",
  "providerToken",
] as const;
