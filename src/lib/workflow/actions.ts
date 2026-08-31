"use server";

import { revalidatePath } from "next/cache";
import { requireInternalUser } from "@/lib/auth/session";
import {
  DOCUMENT_STATUSES,
  DEAL_STATUSES,
  NEED_STATUSES,
  TASK_MUTATIONS,
  TASK_STATUS_EVENTS,
  canClaimDeal,
  canMutateWorkflow,
  canUnclaimDeal,
  evaluateSubmissionReadiness,
} from "@/lib/ops/workflow";
import { nextFollowUpFromCadence } from "@/lib/contacts/logic";
import { assertSandboxGuard } from "@/lib/sandbox";
import { logAuthorizedActivity } from "@/lib/workflow/activity";

export type WorkflowResult = {
  error: string | null;
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

export async function claimDealAction(formData: FormData): Promise<WorkflowResult> {
  assertSandboxGuard();
  const dealId = asString(formData.get("dealId"));
  const { supabase, user, profile } = await requireInternalUser();
  if (!canMutateWorkflow(profile.role)) {
    return { error: "Your role cannot claim deals." };
  }

  const { data: deal } = await supabase
    .from("deals")
    .select("id, assigned_processor_id, status")
    .eq("id", dealId)
    .maybeSingle();

  if (!deal) {
    return { error: "Deal not found." };
  }
  if (!canClaimDeal(deal.assigned_processor_id, user.id, profile.role)) {
    return { error: "This deal is already assigned." };
  }

  const { error } = await supabase
    .from("deals")
    .update({ assigned_processor_id: user.id })
    .eq("id", dealId);

  if (error) {
    return { error: "Unable to claim this deal." };
  }

  await supabase
    .from("tasks")
    .update({ assigned_to: user.id })
    .eq("deal_id", dealId)
    .is("assigned_to", null);

  await logAuthorizedActivity({
    dealId,
    actorId: user.id,
    eventType: "deal_claimed",
    metadata: { from: deal.assigned_processor_id ?? "unassigned", to: user.id },
  });
  refreshDeal(dealId);
  return { error: null };
}

export async function unclaimDealAction(formData: FormData): Promise<WorkflowResult> {
  assertSandboxGuard();
  const dealId = asString(formData.get("dealId"));
  const { supabase, user, profile } = await requireInternalUser();
  if (!canMutateWorkflow(profile.role)) {
    return { error: "Your role cannot unclaim deals." };
  }

  const { data: deal } = await supabase
    .from("deals")
    .select("id, assigned_processor_id")
    .eq("id", dealId)
    .maybeSingle();

  if (!deal) {
    return { error: "Deal not found." };
  }
  if (!canUnclaimDeal(deal.assigned_processor_id, user.id, profile.role)) {
    return { error: "You can only unclaim a deal assigned to you." };
  }

  const { error } = await supabase
    .from("deals")
    .update({ assigned_processor_id: null })
    .eq("id", dealId);

  if (error) {
    return { error: "Unable to unclaim this deal." };
  }

  await logAuthorizedActivity({
    dealId,
    actorId: user.id,
    eventType: "deal_unclaimed",
    metadata: { from: deal.assigned_processor_id ?? "" },
  });
  refreshDeal(dealId);
  return { error: null };
}

export async function updateDealStatusAction(
  formData: FormData,
): Promise<WorkflowResult> {
  assertSandboxGuard();
  const dealId = asString(formData.get("dealId"));
  const status = asString(formData.get("status"));
  if (!DEAL_STATUSES.includes(status as (typeof DEAL_STATUSES)[number])) {
    return { error: "Invalid deal status." };
  }

  const { supabase, user, profile } = await requireInternalUser();
  if (!canMutateWorkflow(profile.role)) {
    return { error: "Your role cannot change deal status." };
  }

  const { data: deal } = await supabase
    .from("deals")
    .select("id, status")
    .eq("id", dealId)
    .maybeSingle();
  if (!deal) {
    return { error: "Deal not found." };
  }

  if (status === "ready_for_submission") {
    const [{ data: needs }, { data: tasks }] = await Promise.all([
      supabase
        .from("client_needs")
        .select("id, required, status, document_type")
        .eq("deal_id", dealId),
      supabase
        .from("tasks")
        .select("status, blocked_reason, timing, client_need_id")
        .eq("deal_id", dealId),
    ]);
    const timingByNeed = new Map(
      (tasks ?? [])
        .filter((task) => task.client_need_id)
        .map((task) => [task.client_need_id as string, task.timing as string | null]),
    );
    const readiness = evaluateSubmissionReadiness({
      needs: (needs ?? []).map((need) => ({
        required: Boolean(need.required),
        status: need.status,
        documentType: need.document_type,
        timing: timingByNeed.get(need.id) ?? null,
      })),
      tasks: (tasks ?? []).map((task) => ({
        status: task.status,
        blockedReason: task.blocked_reason,
        timing: task.timing,
      })),
    });
    if (!readiness.ready) {
      return {
        error:
          readiness.blockers[0] ??
          "This file is not ready for submission until required items are complete.",
      };
    }
  }

  const { error } = await supabase.from("deals").update({ status }).eq("id", dealId);
  if (error) {
    return { error: "Unable to update deal status." };
  }

  await logAuthorizedActivity({
    dealId,
    actorId: user.id,
    eventType: "deal_status_changed",
    metadata: { from: deal.status, to: status },
  });
  refreshDeal(dealId);
  return { error: null };
}

export async function updateNeedStatusAction(
  formData: FormData,
): Promise<WorkflowResult> {
  assertSandboxGuard();
  const needId = asString(formData.get("needId"));
  const status = asString(formData.get("status"));
  if (!NEED_STATUSES.includes(status as (typeof NEED_STATUSES)[number])) {
    return { error: "Invalid client need status." };
  }

  const { supabase, user, profile } = await requireInternalUser();
  if (!canMutateWorkflow(profile.role)) {
    return { error: "Your role cannot update client needs." };
  }

  const { data: need } = await supabase
    .from("client_needs")
    .select("id, deal_id, status")
    .eq("id", needId)
    .maybeSingle();
  if (!need) {
    return { error: "Client need not found." };
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status };
  if (status === "requested" ) patch.requested_at = now;
  if (status === "received" || status === "needs_review") patch.received_at = now;
  if (status === "approved" || status === "rejected" || status === "waived") {
    patch.reviewed_at = now;
    patch.reviewed_by = user.id;
  }

  const { error } = await supabase.from("client_needs").update(patch).eq("id", needId);
  if (error) {
    return { error: "Unable to update this client need." };
  }

  await logAuthorizedActivity({
    dealId: need.deal_id,
    actorId: user.id,
    eventType: "client_need_status_changed",
    metadata: { from: need.status, to: status },
  });
  refreshDeal(need.deal_id);
  return { error: null };
}

export async function updateDocumentStatusAction(
  formData: FormData,
): Promise<WorkflowResult> {
  assertSandboxGuard();
  const documentId = asString(formData.get("documentId"));
  const status = asString(formData.get("status"));
  if (!DOCUMENT_STATUSES.includes(status as (typeof DOCUMENT_STATUSES)[number])) {
    return { error: "Invalid document status." };
  }

  const { supabase, user, profile } = await requireInternalUser();
  if (!canMutateWorkflow(profile.role)) {
    return { error: "Your role cannot update documents." };
  }

  const { data: document } = await supabase
    .from("documents")
    .select("id, deal_id, status")
    .eq("id", documentId)
    .maybeSingle();
  if (!document) {
    return { error: "Document not found." };
  }

  const { error } = await supabase
    .from("documents")
    .update({ status })
    .eq("id", documentId);
  if (error) {
    return { error: "Unable to update this document." };
  }

  await logAuthorizedActivity({
    dealId: document.deal_id,
    actorId: user.id,
    eventType: "document_status_changed",
    metadata: { from: document.status, to: status },
  });
  refreshDeal(document.deal_id);
  return { error: null };
}

export async function classifyDocumentAction(
  formData: FormData,
): Promise<WorkflowResult> {
  assertSandboxGuard();
  const documentId = asString(formData.get("documentId"));
  const documentType = asString(formData.get("documentType"));
  if (!documentType) {
    return { error: "Enter a document type." };
  }

  const { supabase, user, profile } = await requireInternalUser();
  if (!canMutateWorkflow(profile.role)) {
    return { error: "Your role cannot classify documents." };
  }

  const { data: document } = await supabase
    .from("documents")
    .select("id, deal_id, document_type")
    .eq("id", documentId)
    .maybeSingle();
  if (!document) {
    return { error: "Document not found." };
  }

  const { error } = await supabase
    .from("documents")
    .update({ document_type: documentType, ai_classification: documentType })
    .eq("id", documentId);
  if (error) {
    return { error: "Unable to classify this document." };
  }

  await logAuthorizedActivity({
    dealId: document.deal_id,
    actorId: user.id,
    eventType: "document_classified",
    metadata: { from: document.document_type ?? "unclassified", to: documentType },
  });
  refreshDeal(document.deal_id);
  return { error: null };
}

export async function updateTaskStatusAction(
  formData: FormData,
): Promise<WorkflowResult> {
  assertSandboxGuard();
  const taskId = asString(formData.get("taskId"));
  const status = asString(formData.get("status"));
  if (!TASK_MUTATIONS.includes(status as (typeof TASK_MUTATIONS)[number])) {
    return { error: "Invalid task action." };
  }

  const { supabase, user, profile } = await requireInternalUser();
  if (!canMutateWorkflow(profile.role)) {
    return { error: "Your role cannot update tasks." };
  }

  const { data: task } = await supabase
    .from("tasks")
    .select("id, deal_id, status, follow_up_interval_hours, source_type, last_contacted_at")
    .eq("id", taskId)
    .maybeSingle();
  if (!task) {
    return { error: "Task not found." };
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    status,
    completed_at: status === "completed" ? now : null,
  };
  if (status === "waiting") {
    patch.waiting_since = now;
    patch.next_follow_up_at = nextFollowUpFromCadence(now, {
      followUpIntervalHours: task.follow_up_interval_hours,
      sourceType: task.source_type,
    });
  }
  if (status === "in_progress") {
    patch.completed_at = null;
  }

  const { error } = await supabase.from("tasks").update(patch).eq("id", taskId);
  if (error) {
    return { error: "Unable to update this task." };
  }

  await logAuthorizedActivity({
    dealId: task.deal_id,
    actorId: user.id,
    eventType: TASK_STATUS_EVENTS[status as (typeof TASK_MUTATIONS)[number]],
    metadata: { from: task.status, to: status },
  });
  refreshDeal(task.deal_id);
  return { error: null };
}
