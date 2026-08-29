"use server";

import { revalidatePath } from "next/cache";
import { requireInternalUser } from "@/lib/auth/session";
import { assertDocumentProviderGuard } from "@/lib/documents/config";
import {
  completeDocumentUploadSession,
  createDocumentUploadSession,
  requestTemporaryDocumentAccess,
  type DocumentIntakeStore,
} from "@/lib/documents/sessions";
import type { DocumentMetadataRecord, SafeUploadSession, TemporaryAccess } from "@/lib/documents/types";
import { assertSandboxGuard } from "@/lib/sandbox";
import { logAuthorizedActivity } from "@/lib/workflow/activity";
import type { SupabaseClient } from "@supabase/supabase-js";

export type DocumentIntakeResult<T> = {
  error: string | null;
  data: T | null;
};

function asString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function asOptionalFileSize(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 25_000_000) {
    return null;
  }
  return Math.round(parsed);
}

const REJECTED_BYTE_FIELDS = [
  "file",
  "bytes",
  "content",
  "base64",
  "buffer",
  "blob",
  "document",
  "filedata",
  "binary",
] as const;

function formContainsFilePayload(formData: FormData): boolean {
  return REJECTED_BYTE_FIELDS.some((field) => formData.get(field) != null);
}

function refreshDeal(dealId: string) {
  revalidatePath("/dashboard");
  revalidatePath("/deals");
  revalidatePath("/processor-queue");
  revalidatePath(`/deals/${dealId}`);
}

function createUserScopedStore(supabase: SupabaseClient): DocumentIntakeStore {
  return {
    async getDeal(dealId) {
      const { data } = await supabase
        .from("deals")
        .select("id, assigned_processor_id, deal_reference")
        .eq("id", dealId)
        .maybeSingle();
      if (!data) {
        return null;
      }
      return {
        id: data.id,
        assignedProcessorId: data.assigned_processor_id,
        dealReference: data.deal_reference,
      };
    },
    async getNeed(needId) {
      const { data } = await supabase
        .from("client_needs")
        .select("id, deal_id, status, document_type")
        .eq("id", needId)
        .maybeSingle();
      if (!data) {
        return null;
      }
      return {
        id: data.id,
        dealId: data.deal_id,
        status: data.status,
        documentType: data.document_type,
      };
    },
    async insertDocument(row) {
      const { data, error } = await supabase
        .from("documents")
        .insert({
          deal_id: row.dealId,
          file_name: row.fileName,
          document_type: row.documentType,
          storage_provider: row.storageProvider,
          external_file_id: row.externalFileId,
          mime_type: row.mimeType,
          status: row.status,
          uploaded_at: row.uploadedAt,
        })
        .select("id")
        .single();
      if (error || !data) {
        throw new Error(error?.message ?? "Unable to record document metadata.");
      }
      return { id: data.id };
    },
    async linkDocument(input) {
      const { error } = await supabase.from("document_client_needs").insert({
        document_id: input.documentId,
        client_need_id: input.clientNeedId,
        linked_by: input.linkedBy,
        link_source: input.linkSource,
      });
      if (error) {
        throw new Error("Unable to link the document to the Client Need.");
      }
    },
    async listNeedDocuments(needId) {
      const { data: links } = await supabase
        .from("document_client_needs")
        .select("document_id")
        .eq("client_need_id", needId);
      const ids = (links ?? []).map((row) => row.document_id);
      if (ids.length === 0) {
        return [];
      }
      const { data } = await supabase
        .from("documents")
        .select("id, status")
        .in("id", ids);
      return (data ?? []).map((row) => ({ id: row.id, status: row.status }));
    },
    async updateNeedStatus(needId, status, at) {
      const patch: Record<string, unknown> = { status };
      if (status === "received" || status === "needs_review") {
        patch.received_at = at;
      }
      const { error } = await supabase.from("client_needs").update(patch).eq("id", needId);
      if (error) {
        throw new Error("Unable to update the client need.");
      }
    },
    async getDocument(documentId) {
      const { data } = await supabase
        .from("documents")
        .select("id, deal_id, file_name, external_file_id, storage_provider")
        .eq("id", documentId)
        .maybeSingle();
      if (!data) {
        return null;
      }
      return {
        id: data.id,
        dealId: data.deal_id,
        fileName: data.file_name,
        externalFileId: data.external_file_id,
        storageProvider: data.storage_provider,
      };
    },
  };
}

export async function createUploadSessionAction(
  formData: FormData,
): Promise<DocumentIntakeResult<SafeUploadSession>> {
  assertSandboxGuard();
  assertDocumentProviderGuard();
  if (formContainsFilePayload(formData)) {
    return { error: "Raw file bytes are not accepted.", data: null };
  }

  const { supabase, user, profile } = await requireInternalUser();
  try {
    const result = await createDocumentUploadSession(
      {
        actor: { userId: user.id, role: profile.role },
        store: createUserScopedStore(supabase),
        logActivity: logAuthorizedActivity,
      },
      {
        dealId: asString(formData.get("dealId")),
        clientNeedId: asString(formData.get("clientNeedId")),
        fileName: asString(formData.get("fileName")),
        mimeType: asString(formData.get("mimeType")),
        fileSize: asOptionalFileSize(formData.get("fileSize")),
      },
    );

    if (!result.ok) {
      return { error: result.error, data: null };
    }
    return { error: null, data: result.data };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Unable to create an upload session.",
      data: null,
    };
  }
}

export async function completeUploadSessionAction(
  formData: FormData,
): Promise<
  DocumentIntakeResult<{ document: DocumentMetadataRecord; needUpdated: boolean }>
> {
  assertSandboxGuard();
  assertDocumentProviderGuard();
  if (formContainsFilePayload(formData)) {
    return { error: "Raw file bytes are not accepted.", data: null };
  }

  const { supabase, user, profile } = await requireInternalUser();
  const dealId = asString(formData.get("dealId"));
  try {
    const result = await completeDocumentUploadSession(
      {
        actor: { userId: user.id, role: profile.role },
        store: createUserScopedStore(supabase),
        logActivity: logAuthorizedActivity,
      },
      {
        sessionId: asString(formData.get("sessionId")),
        dealId,
      },
    );
    if (!result.ok) {
      return { error: result.error, data: null };
    }
    refreshDeal(dealId);
    return { error: null, data: result.data };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Unable to complete the upload.",
      data: null,
    };
  }
}

export async function requestTemporaryAccessAction(
  formData: FormData,
): Promise<DocumentIntakeResult<TemporaryAccess>> {
  assertSandboxGuard();
  assertDocumentProviderGuard();

  const { supabase, user, profile } = await requireInternalUser();
  const result = await requestTemporaryDocumentAccess(
    {
      actor: { userId: user.id, role: profile.role },
      store: createUserScopedStore(supabase),
      logActivity: logAuthorizedActivity,
    },
    {
      documentId: asString(formData.get("documentId")),
      dealId: asString(formData.get("dealId")),
    },
  );

  if (!result.ok) {
    return { error: result.error, data: null };
  }
  return { error: null, data: result.data };
}
