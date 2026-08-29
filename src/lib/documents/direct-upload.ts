import type { SafeUploadSession } from "@/lib/documents/types";

export function createFictitiousTestBlob(
  fileName: string,
  mimeType: string,
): Blob {
  const body = `PILLAR-SANDBOX-TEST\n${fileName}\n`;
  return new Blob([body], { type: mimeType });
}

export async function uploadBlobToProviderSession(
  session: Pick<
    SafeUploadSession,
    "uploadUrl" | "uploadMethod" | "rawBody" | "formFieldName" | "fileName"
  >,
  blob: Blob,
): Promise<void> {
  const method = session.uploadMethod ?? "POST";
  let response: Response;
  try {
    if (session.rawBody) {
      response = await fetch(session.uploadUrl, {
        method,
        body: blob,
      });
    } else {
      const form = new FormData();
      form.set(session.formFieldName ?? "Filedata", blob, session.fileName);
      response = await fetch(session.uploadUrl, {
        method,
        body: form,
      });
    }
  } catch {
    throw new Error(
      "The browser could not reach the provider upload URL. ShareFile must allow this origin for CORS / trusted-domain browser upload.",
    );
  }

  if (!response.ok) {
    throw new Error("Direct provider upload failed.");
  }
}
