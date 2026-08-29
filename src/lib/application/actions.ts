"use server";

import { persistSandboxApplication } from "@/lib/application/persist";
import { emptyApplicationDraft, type ApplicationDraft } from "@/lib/application/types";
import { APPLICATION_FIELD_KEYS } from "@/lib/application/types";
import { assertSandboxGuard } from "@/lib/sandbox";

export type SubmitApplicationResult =
  | { error: null; dealReference: string; portalPath: string }
  | { error: string; dealReference: null; portalPath: null };

function draftFromForm(formData: FormData): ApplicationDraft {
  const draft = emptyApplicationDraft();
  for (const key of APPLICATION_FIELD_KEYS) {
    const value = formData.get(key);
    draft[key] = typeof value === "string" ? value : "";
  }
  return draft;
}

export async function submitSandboxApplicationAction(
  formData: FormData,
): Promise<SubmitApplicationResult> {
  assertSandboxGuard();
  if (formData.get("file") != null || formData.get("bytes") != null) {
    return {
      error: "Raw file bytes are not accepted.",
      dealReference: null,
      portalPath: null,
    };
  }

  const result = await persistSandboxApplication(draftFromForm(formData));
  if (!result.ok) {
    return { error: result.error, dealReference: null, portalPath: null };
  }
  return {
    error: null,
    dealReference: result.dealReference,
    portalPath: `/portal/${encodeURIComponent(result.portalToken)}`,
  };
}
