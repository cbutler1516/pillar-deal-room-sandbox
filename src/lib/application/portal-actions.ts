"use server";

import { revalidatePath } from "next/cache";
import { readPortalToken } from "@/lib/application/token";
import {
  completeDocumentUploadSession,
  createDocumentUploadSession,
  type DocumentIntakeStore,
} from "@/lib/documents/sessions";
import { assertDocumentProviderGuard } from "@/lib/documents/config";
import { sanitizeActivityMetadata } from "@/lib/ops/workflow";
import { assertSandboxGuard } from "@/lib/sandbox";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { DocumentMetadataRecord, SafeUploadSession } from "@/lib/documents/types";

export type PortalActionResult<T> = {
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

function createPortalStore(): DocumentIntakeStore {
  const admin = createServiceRoleClient();
  return {
    async getDeal(dealId) {
      const { data } = await admin
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
      const { data } = await admin
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
      const { data, error } = await admin
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
        throw new Error("Unable to record document metadata.");
      }
      return { id: data.id };
    },
    async linkDocument(input) {
      const { error } = await admin.from("document_client_needs").insert({
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
      const { data: links } = await admin
        .from("document_client_needs")
        .select("document_id")
        .eq("client_need_id", needId);
      const ids = (links ?? []).map((row) => row.document_id);
      if (ids.length === 0) {
        return [];
      }
      const { data } = await admin.from("documents").select("id, status").in("id", ids);
      return (data ?? []).map((row) => ({ id: row.id, status: row.status }));
    },
    async updateNeedStatus(needId, status, at) {
      const patch: Record<string, unknown> = { status };
      if (status === "received" || status === "needs_review") {
        patch.received_at = at;
      }
      const { error } = await admin.from("client_needs").update(patch).eq("id", needId);
      if (error) {
        throw new Error("Unable to update the client need.");
      }
    },
    async getDocument(documentId) {
      const { data } = await admin
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

async function portalDeps(token: string) {
  assertSandboxGuard();
  assertDocumentProviderGuard();
  const dealId = readPortalToken(token);
  if (!dealId) {
    return null;
  }
  const admin = createServiceRoleClient();
  return {
    dealId,
    deps: {
      actor: { userId: null, role: null },
      store: createPortalStore(),
      evaluation: true,
      async logActivity(event: {
        dealId: string;
        actorId: string;
        eventType: string;
        metadata?: Record<string, unknown>;
      }) {
        await admin.from("activity_log").insert({
          deal_id: event.dealId,
          event_type: event.eventType,
          actor_type: "system",
          actor_id: null,
          safe_metadata: sanitizeActivityMetadata(event.metadata ?? {}),
        });
      },
    },
  };
}

export async function createPortalUploadSessionAction(
  formData: FormData,
): Promise<PortalActionResult<SafeUploadSession>> {
  if (formData.get("file") != null || formData.get("bytes") != null) {
    return { error: "Raw file bytes are not accepted.", data: null };
  }
  const context = await portalDeps(asString(formData.get("portalToken")));
  if (!context) {
    return { error: "This sandbox portal link is not valid.", data: null };
  }
  const result = await createDocumentUploadSession(context.deps, {
    dealId: context.dealId,
    clientNeedId: asString(formData.get("clientNeedId")),
    fileName: asString(formData.get("fileName")),
    mimeType: asString(formData.get("mimeType")),
    fileSize: asOptionalFileSize(formData.get("fileSize")),
  });
  if (!result.ok) {
    return { error: result.error, data: null };
  }
  return { error: null, data: result.data };
}

export async function completePortalUploadSessionAction(
  formData: FormData,
): Promise<PortalActionResult<DocumentMetadataRecord>> {
  if (formData.get("file") != null || formData.get("bytes") != null) {
    return { error: "Raw file bytes are not accepted.", data: null };
  }
  const context = await portalDeps(asString(formData.get("portalToken")));
  if (!context) {
    return { error: "This sandbox portal link is not valid.", data: null };
  }
  const result = await completeDocumentUploadSession(context.deps, {
    sessionId: asString(formData.get("sessionId")),
    dealId: context.dealId,
  });
  if (!result.ok) {
    return { error: result.error, data: null };
  }
  revalidatePath(`/portal/${asString(formData.get("portalToken"))}`);
  return { error: null, data: result.data.document };
}
