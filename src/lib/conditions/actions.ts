"use server";

import { revalidatePath } from "next/cache";
import { requireInternalUser } from "@/lib/auth/session";
import {
  CONDITION_TASK_TYPE,
  formatConditionInstructions,
  isLenderCondition,
} from "@/lib/conditions/model";
import {
  canCreateProcessorTask,
  canMutateProcessorTask,
} from "@/lib/playbooks/authorization";
import { isTaskTiming } from "@/lib/playbooks/types";
import { assertSandboxGuard } from "@/lib/sandbox";
import { logAuthorizedActivity } from "@/lib/workflow/activity";

export type ConditionActionResult = { error: string | null };

function asString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function refresh(dealId: string) {
  revalidatePath("/dashboard");
  revalidatePath("/deals");
  revalidatePath("/processor-queue");
  revalidatePath("/tasks");
  revalidatePath("/team");
  revalidatePath(`/deals/${dealId}`);
}

export async function createConditionAction(
  formData: FormData,
): Promise<ConditionActionResult> {
  assertSandboxGuard();
  const dealId = asString(formData.get("dealId"));
  const title = asString(formData.get("title"));
  const source = asString(formData.get("source")) || "Lender";
  const timing = asString(formData.get("timing")) || "required_now";
  const contactName = asString(formData.get("contactName"));
  const clientNeedId = asString(formData.get("clientNeedId"));
  const notes = asString(formData.get("notes"));
  const dueRaw = asString(formData.get("dueAt"));
  const dueParsed = dueRaw ? new Date(dueRaw) : null;
  const dueAt =
    dueParsed && !Number.isNaN(dueParsed.getTime())
      ? dueParsed.toISOString()
      : "";
  if (!dealId || !title) {
    return { error: "Enter a condition title." };
  }
  if (!isTaskTiming(timing)) {
    return { error: "Choose when this condition is needed." };
  }

  const { supabase, user, profile } = await requireInternalUser();
  const { data: deal } = await supabase
    .from("deals")
    .select("id, assigned_processor_id")
    .eq("id", dealId)
    .maybeSingle();
  if (!deal) {
    return { error: "Deal not found." };
  }
  if (
    !canCreateProcessorTask({
      role: profile.role,
      userId: user.id,
      dealAssignedProcessorId: deal.assigned_processor_id,
    })
  ) {
    return { error: "Your role cannot add conditions on this file." };
  }

  const now = new Date().toISOString();
  const { error } = await supabase.from("tasks").insert({
    deal_id: dealId,
    task_type: CONDITION_TASK_TYPE,
    title,
    description: notes || title,
    priority: "normal",
    assigned_to: deal.assigned_processor_id,
    status: "open",
    due_at: dueAt || null,
    source_type: "lender",
    task_kind: "request_document",
    timing,
    client_need_id: clientNeedId || null,
    contact_name: contactName || null,
    follow_up_interval_hours: 24,
    next_follow_up_at: dueAt || null,
    escalation_after_hours: 48,
    escalation_level: "none",
    playbook_key: CONDITION_TASK_TYPE,
    instructions: formatConditionInstructions(source, notes),
    created_at: now,
    updated_at: now,
  });
  if (error) {
    return { error: "Unable to add this condition." };
  }

  await logAuthorizedActivity({
    dealId,
    actorId: user.id,
    eventType: "task_created",
    metadata: {
      kind: "condition",
      title,
      source_type: "lender",
    },
  });
  refresh(dealId);
  return { error: null };
}

export async function clearConditionAction(
  formData: FormData,
): Promise<ConditionActionResult> {
  assertSandboxGuard();
  const taskId = asString(formData.get("taskId"));
  const { supabase, user, profile } = await requireInternalUser();
  const { data: task } = await supabase
    .from("tasks")
    .select(
      "id, deal_id, status, assigned_to, title, source_type, task_type, playbook_key",
    )
    .eq("id", taskId)
    .maybeSingle();
  if (!task) {
    return { error: "Condition not found." };
  }
  if (
    !isLenderCondition({
      sourceType: task.source_type,
      taskType: task.task_type,
      playbookKey: task.playbook_key,
    })
  ) {
    return { error: "This item is not a condition." };
  }

  const { data: deal } = await supabase
    .from("deals")
    .select("assigned_processor_id")
    .eq("id", task.deal_id)
    .maybeSingle();
  if (
    !canMutateProcessorTask({
      role: profile.role,
      userId: user.id,
      dealAssignedProcessorId: deal?.assigned_processor_id ?? null,
      taskAssignedTo: task.assigned_to,
    })
  ) {
    return { error: "Your role cannot clear this condition." };
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("tasks")
    .update({
      status: "completed",
      completed_at: now,
      updated_at: now,
    })
    .eq("id", task.id);
  if (error) {
    return { error: "Unable to clear this condition." };
  }

  await logAuthorizedActivity({
    dealId: task.deal_id,
    actorId: user.id,
    eventType: "task_completed",
    metadata: {
      kind: "condition",
      title: task.title,
      from: task.status,
      to: "completed",
      cleared_by: user.id,
      cleared_at: now,
    },
  });
  refresh(task.deal_id);
  return { error: null };
}
