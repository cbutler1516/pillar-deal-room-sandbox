"use server";

import { revalidatePath } from "next/cache";
import { requireInternalUser } from "@/lib/auth/session";
import { canMutateWorkflow } from "@/lib/ops/workflow";
import { assertSandboxGuard } from "@/lib/sandbox";
import { polishSubmissionEmail } from "@/lib/submission/email";
import { readinessFromRows } from "@/lib/submission/readiness";
import { logAuthorizedActivity } from "@/lib/workflow/activity";

export type SubmissionActionResult = {
  error: string | null;
  body?: string;
};

function asString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function refresh(dealId: string) {
  revalidatePath("/dashboard");
  revalidatePath("/deals");
  revalidatePath("/processor-queue");
  revalidatePath("/team");
  revalidatePath(`/deals/${dealId}`);
}

export async function markSubmittedAction(
  formData: FormData,
): Promise<SubmissionActionResult> {
  assertSandboxGuard();
  const dealId = asString(formData.get("dealId"));
  const { supabase, user, profile } = await requireInternalUser();
  if (!canMutateWorkflow(profile.role)) {
    return { error: "Your role cannot mark a file submitted." };
  }

  const { data: deal } = await supabase
    .from("deals")
    .select("id, status")
    .eq("id", dealId)
    .maybeSingle();
  if (!deal) {
    return { error: "Deal not found." };
  }
  if (deal.status === "submitted") {
    return { error: "This file is already marked submitted." };
  }

  const [{ data: needs }, { data: tasks }] = await Promise.all([
    supabase
      .from("client_needs")
      .select("id, required, status, document_type")
      .eq("deal_id", dealId),
    supabase
      .from("tasks")
      .select(
        "status, blocked_reason, timing, client_need_id, title, source_type, task_type, playbook_key",
      )
      .eq("deal_id", dealId),
  ]);
  const readiness = readinessFromRows({
    needs: (needs ?? []).map((need) => ({
      id: need.id,
      required: Boolean(need.required),
      status: need.status,
      documentType: need.document_type,
    })),
    tasks: (tasks ?? []).map((task) => ({
      status: task.status,
      blockedReason: task.blocked_reason,
      timing: task.timing,
      clientNeedId: task.client_need_id,
      title: task.title,
      sourceType: task.source_type,
      taskType: task.task_type,
      playbookKey: task.playbook_key,
    })),
  });
  if (!readiness.ready) {
    return {
      error:
        readiness.blockers[0] ??
        "This file is not ready to mark submitted until required items are complete.",
    };
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("deals")
    .update({ status: "submitted", updated_at: now })
    .eq("id", deal.id);
  if (error) {
    return { error: "Unable to mark this file submitted." };
  }

  await logAuthorizedActivity({
    dealId: deal.id,
    actorId: user.id,
    eventType: "deal_status_changed",
    metadata: {
      kind: "submission",
      from: deal.status,
      to: "submitted",
    },
  });
  refresh(deal.id);
  return { error: null };
}

export async function suggestSubmissionRewriteAction(
  formData: FormData,
): Promise<SubmissionActionResult> {
  assertSandboxGuard();
  await requireInternalUser();
  const body = asString(formData.get("body"));
  if (!body) {
    return { error: "There is no email draft to rewrite." };
  }
  const polished = polishSubmissionEmail(body);
  return { error: null, body: polished.body };
}
