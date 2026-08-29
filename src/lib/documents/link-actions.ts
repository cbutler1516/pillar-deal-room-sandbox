"use server";

import { revalidatePath } from "next/cache";
import { requireInternalUser } from "@/lib/auth/session";
import {
  attachDocumentsToClientNeed,
  cloneClientNeed,
  detachDocumentFromClientNeed,
  type DocumentRelationStore,
} from "@/lib/documents/relations";
import { assertSandboxGuard } from "@/lib/sandbox";
import { logAuthorizedActivity } from "@/lib/workflow/activity";
import type { SupabaseClient } from "@supabase/supabase-js";

export type LinkActionResult<T> = {
  error: string | null;
  data: T | null;
};

function asString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function refreshDeal(dealId: string) {
  revalidatePath("/dashboard");
  revalidatePath("/deals");
  revalidatePath("/processor-queue");
  revalidatePath(`/deals/${dealId}`);
}

function createRelationStore(supabase: SupabaseClient): DocumentRelationStore {
  return {
    async getDeal(dealId) {
      const { data } = await supabase
        .from("deals")
        .select("id, assigned_processor_id")
        .eq("id", dealId)
        .maybeSingle();
      return data
        ? { id: data.id, assignedProcessorId: data.assigned_processor_id }
        : null;
    },
    async getNeed(needId) {
      const { data } = await supabase
        .from("client_needs")
        .select(
          "id, deal_id, status, document_type, category, description, required, expected_document_count, require_all_linked_approved, notes",
        )
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
        category: data.category,
        description: data.description,
        required: data.required,
        expectedDocumentCount: data.expected_document_count,
        requireAllLinkedApproved: data.require_all_linked_approved ?? true,
        notes: data.notes,
      };
    },
    async getDocument(documentId) {
      const { data } = await supabase
        .from("documents")
        .select("id, deal_id, file_name, document_type, status")
        .eq("id", documentId)
        .maybeSingle();
      if (!data) {
        return null;
      }
      return {
        id: data.id,
        dealId: data.deal_id,
        fileName: data.file_name,
        documentType: data.document_type,
        status: data.status,
      };
    },
    async listDocumentsForDeal(dealId) {
      const { data } = await supabase
        .from("documents")
        .select("id, deal_id, file_name, document_type, status")
        .eq("deal_id", dealId);
      return (data ?? []).map((row) => ({
        id: row.id,
        dealId: row.deal_id,
        fileName: row.file_name,
        documentType: row.document_type,
        status: row.status,
      }));
    },
    async listLinksForNeed(needId) {
      const { data } = await supabase
        .from("document_client_needs")
        .select("document_id, client_need_id")
        .eq("client_need_id", needId);
      return (data ?? []).map((row) => ({
        documentId: row.document_id,
        clientNeedId: row.client_need_id,
      }));
    },
    async listLinksForDocument(documentId) {
      const { data } = await supabase
        .from("document_client_needs")
        .select("document_id, client_need_id")
        .eq("document_id", documentId);
      return (data ?? []).map((row) => ({
        documentId: row.document_id,
        clientNeedId: row.client_need_id,
      }));
    },
    async insertLink(input) {
      const { error } = await supabase.from("document_client_needs").insert({
        document_id: input.documentId,
        client_need_id: input.clientNeedId,
        linked_by: input.linkedBy,
        link_source: input.linkSource,
      });
      if (error?.code === "23505") {
        return "already_linked";
      }
      if (error) {
        throw new Error(error.message);
      }
      return "created";
    },
    async deleteLink(documentId, clientNeedId) {
      const { data, error } = await supabase
        .from("document_client_needs")
        .delete()
        .eq("document_id", documentId)
        .eq("client_need_id", clientNeedId)
        .select("id");
      if (error) {
        throw new Error(error.message);
      }
      return (data ?? []).length > 0;
    },
    async updateNeedStatus(needId, status, at) {
      const patch: Record<string, unknown> = { status };
      if (status === "received" || status === "needs_review") {
        patch.received_at = at;
      }
      const { error } = await supabase.from("client_needs").update(patch).eq("id", needId);
      if (error) {
        throw new Error(error.message);
      }
    },
    async insertNeed(row) {
      const { data, error } = await supabase
        .from("client_needs")
        .insert({
          deal_id: row.dealId,
          category: row.category,
          document_type: row.documentType,
          description: row.description,
          required: row.required,
          expected_document_count: row.expectedDocumentCount,
          require_all_linked_approved: row.requireAllLinkedApproved,
          status: row.status,
        })
        .select("id")
        .single();
      if (error || !data) {
        throw new Error(error?.message ?? "Unable to clone this Client Need.");
      }
      return { id: data.id };
    },
  };
}

export async function attachExistingAction(
  formData: FormData,
): Promise<LinkActionResult<{ linked: string[]; alreadyLinked: string[] }>> {
  assertSandboxGuard();
  const { supabase, user, profile } = await requireInternalUser();
  const dealId = asString(formData.get("dealId"));
  const documentIds = formData
    .getAll("documentIds")
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0);

  try {
    const result = await attachDocumentsToClientNeed(
      {
        actor: { userId: user.id, role: profile.role },
        store: createRelationStore(supabase),
        logActivity: logAuthorizedActivity,
      },
      {
        dealId,
        clientNeedId: asString(formData.get("clientNeedId")),
        documentIds,
      },
    );
    if (!result.ok) {
      return { error: result.error, data: null };
    }
    refreshDeal(dealId);
    return { error: null, data: result.data };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to attach documents.",
      data: null,
    };
  }
}

export async function detachExistingAction(
  formData: FormData,
): Promise<LinkActionResult<{ documentKept: true }>> {
  assertSandboxGuard();
  const { supabase, user, profile } = await requireInternalUser();
  const dealId = asString(formData.get("dealId"));
  try {
    const result = await detachDocumentFromClientNeed(
      {
        actor: { userId: user.id, role: profile.role },
        store: createRelationStore(supabase),
        logActivity: logAuthorizedActivity,
      },
      {
        dealId,
        documentId: asString(formData.get("documentId")),
        clientNeedId: asString(formData.get("clientNeedId")),
      },
    );
    if (!result.ok) {
      return { error: result.error, data: null };
    }
    refreshDeal(dealId);
    return { error: null, data: { documentKept: true } };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to detach the document.",
      data: null,
    };
  }
}

export async function cloneClientNeedAction(
  formData: FormData,
): Promise<LinkActionResult<{ id: string }>> {
  assertSandboxGuard();
  const { supabase, user, profile } = await requireInternalUser();
  const dealId = asString(formData.get("dealId"));
  try {
    const result = await cloneClientNeed(
      {
        actor: { userId: user.id, role: profile.role },
        store: createRelationStore(supabase),
        logActivity: logAuthorizedActivity,
      },
      {
        dealId,
        clientNeedId: asString(formData.get("clientNeedId")),
      },
    );
    if (!result.ok) {
      return { error: result.error, data: null };
    }
    refreshDeal(dealId);
    return { error: null, data: result.data };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to clone this Client Need.",
      data: null,
    };
  }
}

export async function updateNeedNotesAction(
  formData: FormData,
): Promise<LinkActionResult<{ saved: true }>> {
  assertSandboxGuard();
  const { supabase, user, profile } = await requireInternalUser();
  if (profile.role === "loan_officer") {
    return { error: "Loan officers cannot update Client Need notes.", data: null };
  }
  const needId = asString(formData.get("needId"));
  const notes = asString(formData.get("notes"));
  const { data: need } = await supabase
    .from("client_needs")
    .select("id, deal_id")
    .eq("id", needId)
    .maybeSingle();
  if (!need) {
    return { error: "Client need not found.", data: null };
  }
  const { error } = await supabase.from("client_needs").update({ notes }).eq("id", needId);
  if (error) {
    return { error: "Unable to save this note.", data: null };
  }
  await logAuthorizedActivity({
    dealId: need.deal_id,
    actorId: user.id,
    eventType: "client_need_note_updated",
    metadata: { updated: "true" },
  });
  refreshDeal(need.deal_id);
  return { error: null, data: { saved: true } };
}
