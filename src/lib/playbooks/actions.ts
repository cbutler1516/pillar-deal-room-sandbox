"use server";

import { revalidatePath } from "next/cache";
import { requireInternalUser } from "@/lib/auth/session";
import { insertCommunicationAttempt } from "@/lib/communications/data";
import { buildContactedAttempt } from "@/lib/communications/records";
import { contactActionChannel, markTaskContactedPatch, nextFollowUpFromCadence, pickContactForPlaybook } from "@/lib/contacts/logic";
import { CONTACT_MISSING } from "@/lib/contacts/types";
import {
  canCreateProcessorTask,
  canMutateProcessorTask,
} from "@/lib/playbooks/authorization";
import {
  applyTaskCompletion,
  clientNeedInsertFromPlaybook,
  dealAlreadyHasPlaybookTask,
  instantiatePlaybook,
  isEscalationLevelValue,
  resolveClientNeedForPlaybook,
} from "@/lib/playbooks/logic";
import {
  getPlaybook,
  baselinePlaybooksForLoanType,
} from "@/lib/playbooks/registry";
import { isTaskTiming } from "@/lib/playbooks/types";
import { assertSandboxGuard } from "@/lib/sandbox";
import { logAuthorizedActivity } from "@/lib/workflow/activity";

export type PlaybookActionResult = {
  error: string | null;
  createdCount?: number;
};

function asString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function refreshDeal(dealId: string) {
  revalidatePath("/dashboard");
  revalidatePath("/deals");
  revalidatePath("/processor-queue");
  revalidatePath("/tasks");
  revalidatePath(`/deals/${dealId}`);
}

type DealContext =
  | { ok: false; error: string }
  | {
      ok: true;
      supabase: Awaited<ReturnType<typeof requireInternalUser>>["supabase"];
      user: Awaited<ReturnType<typeof requireInternalUser>>["user"];
      profile: Awaited<ReturnType<typeof requireInternalUser>>["profile"];
      deal: {
        id: string;
        assigned_processor_id: string | null;
        loan_type: string | null;
      };
    };

async function loadDealContext(dealId: string): Promise<DealContext> {
  assertSandboxGuard();
  const { supabase, user, profile } = await requireInternalUser();
  const { data: deal } = await supabase
    .from("deals")
    .select("id, assigned_processor_id, loan_type")
    .eq("id", dealId)
    .maybeSingle();
  if (!deal) {
    return { ok: false, error: "Deal not found." };
  }
  return { ok: true, supabase, user, profile, deal };
}

async function loadMutableTask(taskId: string) {
  assertSandboxGuard();
  const { supabase, user, profile } = await requireInternalUser();
  const { data: task } = await supabase
    .from("tasks")
    .select(
      "id, deal_id, status, assigned_to, follow_up_interval_hours, playbook_key, title, client_need_id, deal_contact_id, source_type, last_contacted_at",
    )
    .eq("id", taskId)
    .maybeSingle();
  if (!task) {
    return { error: "Task not found." as const };
  }
  const { data: deal } = await supabase
    .from("deals")
    .select("id, assigned_processor_id")
    .eq("id", task.deal_id)
    .maybeSingle();
  if (!deal) {
    return { error: "Deal not found." as const };
  }
  if (
    !canMutateProcessorTask({
      role: profile.role,
      userId: user.id,
      dealAssignedProcessorId: deal.assigned_processor_id,
      taskAssignedTo: task.assigned_to,
    })
  ) {
    return { error: "Your role cannot update this task." as const };
  }
  return { error: null, supabase, user, profile, task, deal };
}

async function resolveOrCreateNeed(input: {
  supabase: Awaited<ReturnType<typeof requireInternalUser>>["supabase"];
  dealId: string;
  playbook: NonNullable<ReturnType<typeof getPlaybook>>;
  explicitNeedId: string | null;
}): Promise<{ clientNeedId: string | null; createdNeed: boolean }> {
  if (input.explicitNeedId) {
    const { data: need } = await input.supabase
      .from("client_needs")
      .select("id, deal_id")
      .eq("id", input.explicitNeedId)
      .maybeSingle();
    if (need && need.deal_id === input.dealId) {
      return { clientNeedId: need.id, createdNeed: false };
    }
  }

  const { data: needs } = await input.supabase
    .from("client_needs")
    .select("id, document_type, category")
    .eq("deal_id", input.dealId);

  const resolution = resolveClientNeedForPlaybook(
    input.playbook,
    (needs ?? []).map((need) => ({
      id: need.id,
      documentType: need.document_type,
      category: need.category,
    })),
  );
  if (resolution.clientNeedId) {
    return { clientNeedId: resolution.clientNeedId, createdNeed: false };
  }
  if (!resolution.shouldCreateNeed) {
    return { clientNeedId: null, createdNeed: false };
  }

  const { data: created, error } = await input.supabase
    .from("client_needs")
    .insert(clientNeedInsertFromPlaybook(input.dealId, input.playbook))
    .select("id")
    .maybeSingle();
  if (error || !created) {
    return { clientNeedId: null, createdNeed: false };
  }
  return { clientNeedId: created.id, createdNeed: true };
}

async function resolveContactForPlaybookInsert(input: {
  supabase: Awaited<ReturnType<typeof requireInternalUser>>["supabase"];
  dealId: string;
  playbook: NonNullable<ReturnType<typeof getPlaybook>>;
}): Promise<{
  dealContactId: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  blockedReason: string | null;
}> {
  const { data: contacts } = await input.supabase
    .from("deal_contacts")
    .select("id, contact_type, is_primary, archived_at, name, email, phone")
    .eq("deal_id", input.dealId);
  const picked = pickContactForPlaybook(
    input.playbook,
    (contacts ?? []).map((contact) => ({
      id: contact.id,
      contactType: contact.contact_type,
      isPrimary: contact.is_primary,
      archivedAt: contact.archived_at,
    })),
  );
  const chosen = (contacts ?? []).find((contact) => contact.id === picked.contactId);
  return {
    dealContactId: picked.contactId,
    contactName: chosen?.name ?? null,
    contactEmail: chosen?.email ?? null,
    contactPhone: chosen?.phone ?? null,
    blockedReason: picked.blockedReason,
  };
}

export async function createTaskFromPlaybookAction(
  formData: FormData,
): Promise<PlaybookActionResult> {
  const dealId = asString(formData.get("dealId"));
  const playbookKey = asString(formData.get("playbookKey"));
  const timingOverride = asString(formData.get("timing"));
  const dueAt = asString(formData.get("dueAt"));
  const explicitNeedId = asString(formData.get("clientNeedId"));
  const context = await loadDealContext(dealId);
  if (!context.ok) {
    return { error: context.error };
  }
  const { supabase, user, profile, deal } = context;
  if (
    !canCreateProcessorTask({
      role: profile.role,
      userId: user.id,
      dealAssignedProcessorId: deal.assigned_processor_id,
    })
  ) {
    return { error: "Your role cannot create tasks on this deal." };
  }

  const playbook = getPlaybook(playbookKey);
  if (!playbook) {
    return { error: "Unknown playbook." };
  }
  if (timingOverride && !isTaskTiming(timingOverride)) {
    return { error: "Invalid timing." };
  }

  const { clientNeedId } = await resolveOrCreateNeed({
    supabase,
    dealId,
    playbook,
    explicitNeedId: explicitNeedId || null,
  });
  const instance = instantiatePlaybook(playbook, {
    timing: timingOverride && isTaskTiming(timingOverride) ? timingOverride : undefined,
    clientNeedId,
  });
  const contact = await resolveContactForPlaybookInsert({
    supabase,
    dealId,
    playbook,
  });
  const now = new Date().toISOString();

  const { error } = await supabase.from("tasks").insert({
    deal_id: dealId,
    task_type: instance.taskType,
    title: instance.title,
    description: instance.description,
    priority: instance.priority,
    assigned_to: deal.assigned_processor_id,
    status: "open",
    due_at: dueAt || null,
    source_type: instance.sourceType,
    task_kind: instance.taskKind,
    timing: instance.timing,
    client_need_id: instance.clientNeedId,
    deal_contact_id: contact.dealContactId,
    contact_name: asString(formData.get("contactName")) || contact.contactName,
    contact_email: asString(formData.get("contactEmail")) || contact.contactEmail,
    contact_phone: asString(formData.get("contactPhone")) || contact.contactPhone,
    follow_up_interval_hours: instance.followUpIntervalHours,
    next_follow_up_at: null,
    escalation_after_hours: instance.escalationAfterHours,
    escalation_level: instance.escalationLevel,
    completion_rule: instance.completionRule,
    playbook_key: instance.playbookKey,
    instructions: instance.instructions,
    last_contacted_at: null,
    waiting_since: null,
    blocked_reason: contact.blockedReason,
    created_at: now,
    updated_at: now,
  });
  if (error) {
    return { error: "Unable to create this task." };
  }

  await logAuthorizedActivity({
    dealId,
    actorId: user.id,
    eventType: "task_created",
    metadata: {
      playbook_key: instance.playbookKey,
      source_type: instance.sourceType,
      task_kind: instance.taskKind,
    },
  });
  if (contact.blockedReason === CONTACT_MISSING) {
    await logAuthorizedActivity({
      dealId,
      actorId: user.id,
      eventType: "task_blocked_contact_missing",
      metadata: { playbook_key: instance.playbookKey },
    });
  }
  refreshDeal(dealId);
  return { error: null, createdCount: 1 };
}

export async function generateBaselineTasksAction(
  formData: FormData,
): Promise<PlaybookActionResult> {
  const dealId = asString(formData.get("dealId"));
  const context = await loadDealContext(dealId);
  if (!context.ok) {
    return { error: context.error };
  }
  const { supabase, user, profile, deal } = context;
  if (
    !canCreateProcessorTask({
      role: profile.role,
      userId: user.id,
      dealAssignedProcessorId: deal.assigned_processor_id,
    })
  ) {
    return { error: "Your role cannot generate tasks on this deal." };
  }

  const playbooks = baselinePlaybooksForLoanType(deal.loan_type ?? "");
  if (playbooks.length === 0) {
    return { error: "No baseline playbook for this loan type." };
  }

  const { data: existingTasks } = await supabase
    .from("tasks")
    .select("playbook_key, status")
    .eq("deal_id", dealId);
  const already = (existingTasks ?? []).map(
    (task: { playbook_key: string | null; status: string }) => ({
      playbookKey: task.playbook_key,
      status: task.status,
    }),
  );

  let createdCount = 0;
  const now = new Date().toISOString();
  for (const playbook of playbooks) {
    if (dealAlreadyHasPlaybookTask(already, playbook.playbookKey)) {
      continue;
    }
    const { clientNeedId } = await resolveOrCreateNeed({
      supabase,
      dealId,
      playbook,
      explicitNeedId: null,
    });
    const instance = instantiatePlaybook(playbook, { clientNeedId });
    const contact = await resolveContactForPlaybookInsert({
      supabase,
      dealId,
      playbook,
    });
    const { error } = await supabase.from("tasks").insert({
      deal_id: dealId,
      task_type: instance.taskType,
      title: instance.title,
      description: instance.description,
      priority: instance.priority,
      assigned_to: deal.assigned_processor_id,
      status: "open",
      due_at: null,
      source_type: instance.sourceType,
      task_kind: instance.taskKind,
      timing: instance.timing,
      client_need_id: instance.clientNeedId,
      deal_contact_id: contact.dealContactId,
      contact_name: contact.contactName,
      contact_email: contact.contactEmail,
      contact_phone: contact.contactPhone,
      follow_up_interval_hours: instance.followUpIntervalHours,
      escalation_after_hours: instance.escalationAfterHours,
      escalation_level: instance.escalationLevel,
      completion_rule: instance.completionRule,
      playbook_key: instance.playbookKey,
      instructions: instance.instructions,
      blocked_reason: contact.blockedReason,
    });
    if (error) {
      continue;
    }
    already.push({ playbookKey: playbook.playbookKey, status: "open" });
    createdCount += 1;
    await logAuthorizedActivity({
      dealId,
      actorId: user.id,
      eventType: "task_created",
      metadata: {
        playbook_key: instance.playbookKey,
        source: "baseline",
        created_at_iso: now,
      },
    });
  }

  refreshDeal(dealId);
  return { error: null, createdCount };
}

export async function startTaskAction(
  formData: FormData,
): Promise<PlaybookActionResult> {
  const loaded = await loadMutableTask(asString(formData.get("taskId")));
  if (loaded.error) {
    return { error: loaded.error };
  }
  const { supabase, user, task } = loaded;
  const { error } = await supabase
    .from("tasks")
    .update({ status: "in_progress", completed_at: null })
    .eq("id", task.id);
  if (error) {
    return { error: "Unable to start this task." };
  }
  await logAuthorizedActivity({
    dealId: task.deal_id,
    actorId: user.id,
    eventType: "task_started",
    metadata: { from: task.status, to: "in_progress" },
  });
  refreshDeal(task.deal_id);
  return { error: null };
}

export async function markTaskContactedAction(
  formData: FormData,
): Promise<PlaybookActionResult> {
  const loaded = await loadMutableTask(asString(formData.get("taskId")));
  if (loaded.error) {
    return { error: loaded.error };
  }
  const { supabase, user, task } = loaded;
  const now = new Date().toISOString();
  const markWaiting = asString(formData.get("markWaiting")) !== "false";
  const patch = markTaskContactedPatch({
    nowIso: now,
    followUpIntervalHours: task.follow_up_interval_hours,
    sourceType: task.source_type,
    markWaiting,
  });
  const channel = contactActionChannel();
  const { error } = await supabase.from("tasks").update(patch).eq("id", task.id);
  if (error) {
    return { error: "Unable to mark this task contacted." };
  }
  await insertCommunicationAttempt(
    supabase,
    buildContactedAttempt({
      dealId: task.deal_id,
      taskId: task.id,
      clientNeedId: task.client_need_id,
      dealContactId: task.deal_contact_id,
      createdBy: user.id,
      attemptedAt: now,
    }),
  );
  await logAuthorizedActivity({
    dealId: task.deal_id,
    actorId: user.id,
    eventType: "contact_marked",
    metadata: {
      from: task.status,
      outbound_sent: String(channel.outboundSent),
    },
  });
  refreshDeal(task.deal_id);
  return { error: null };
}

export async function markTaskWaitingAction(
  formData: FormData,
): Promise<PlaybookActionResult> {
  const loaded = await loadMutableTask(asString(formData.get("taskId")));
  if (loaded.error) {
    return { error: loaded.error };
  }
  const { supabase, user, task } = loaded;
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("tasks")
    .update({
      status: "waiting",
      waiting_since: now,
      next_follow_up_at: nextFollowUpFromCadence(now, {
        followUpIntervalHours: task.follow_up_interval_hours,
        sourceType: task.source_type,
      }),
      completed_at: null,
    })
    .eq("id", task.id);
  if (error) {
    return { error: "Unable to mark this task waiting." };
  }
  await logAuthorizedActivity({
    dealId: task.deal_id,
    actorId: user.id,
    eventType: "task_waiting",
    metadata: { from: task.status, to: "waiting" },
  });
  refreshDeal(task.deal_id);
  return { error: null };
}

export async function completeTaskAction(
  formData: FormData,
): Promise<PlaybookActionResult> {
  const loaded = await loadMutableTask(asString(formData.get("taskId")));
  if (loaded.error) {
    return { error: loaded.error };
  }
  const { supabase, user, task } = loaded;
  const completion = applyTaskCompletion();
  const { error } = await supabase
    .from("tasks")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", task.id);
  if (error) {
    return { error: "Unable to complete this task." };
  }
  await logAuthorizedActivity({
    dealId: task.deal_id,
    actorId: user.id,
    eventType: "task_completed",
    metadata: {
      from: task.status,
      to: "completed",
      auto_underwrite: String(completion.autoUnderwrite),
    },
  });
  refreshDeal(task.deal_id);
  return { error: null };
}

export async function dismissTaskAction(
  formData: FormData,
): Promise<PlaybookActionResult> {
  const loaded = await loadMutableTask(asString(formData.get("taskId")));
  if (loaded.error) {
    return { error: loaded.error };
  }
  const { supabase, user, task } = loaded;
  const { error } = await supabase
    .from("tasks")
    .update({ status: "dismissed", completed_at: null })
    .eq("id", task.id);
  if (error) {
    return { error: "Unable to dismiss this task." };
  }
  await logAuthorizedActivity({
    dealId: task.deal_id,
    actorId: user.id,
    eventType: "task_dismissed",
    metadata: { from: task.status, to: "dismissed" },
  });
  refreshDeal(task.deal_id);
  return { error: null };
}

export async function updateTaskContactAction(
  formData: FormData,
): Promise<PlaybookActionResult> {
  const loaded = await loadMutableTask(asString(formData.get("taskId")));
  if (loaded.error) {
    return { error: loaded.error };
  }
  const { supabase, task } = loaded;
  const { error } = await supabase
    .from("tasks")
    .update({
      contact_name: asString(formData.get("contactName")) || null,
      contact_email: asString(formData.get("contactEmail")) || null,
      contact_phone: asString(formData.get("contactPhone")) || null,
    })
    .eq("id", task.id);
  if (error) {
    return { error: "Unable to update contact." };
  }
  refreshDeal(task.deal_id);
  return { error: null };
}

export async function setTaskFollowUpAction(
  formData: FormData,
): Promise<PlaybookActionResult> {
  const loaded = await loadMutableTask(asString(formData.get("taskId")));
  if (loaded.error) {
    return { error: loaded.error };
  }
  const { supabase, user, task } = loaded;
  const nextFollowUpAt = asString(formData.get("nextFollowUpAt"));
  if (!nextFollowUpAt) {
    return { error: "Choose a follow-up time." };
  }
  const { error } = await supabase
    .from("tasks")
    .update({ next_follow_up_at: new Date(nextFollowUpAt).toISOString() })
    .eq("id", task.id);
  if (error) {
    return { error: "Unable to set follow-up." };
  }
  await logAuthorizedActivity({
    dealId: task.deal_id,
    actorId: user.id,
    eventType: "follow_up_scheduled",
    metadata: { next_follow_up_at: nextFollowUpAt },
  });
  refreshDeal(task.deal_id);
  return { error: null };
}

export async function escalateTaskAction(
  formData: FormData,
): Promise<PlaybookActionResult> {
  const loaded = await loadMutableTask(asString(formData.get("taskId")));
  if (loaded.error) {
    return { error: loaded.error };
  }
  const { supabase, user, task } = loaded;
  const requested = asString(formData.get("escalationLevel")) || "loan_officer";
  if (!isEscalationLevelValue(requested)) {
    return { error: "Invalid escalation level." };
  }
  const { error } = await supabase
    .from("tasks")
    .update({ escalation_level: requested })
    .eq("id", task.id);
  if (error) {
    return { error: "Unable to escalate this task." };
  }
  await logAuthorizedActivity({
    dealId: task.deal_id,
    actorId: user.id,
    eventType: "escalation_triggered",
    metadata: { to: requested },
  });
  refreshDeal(task.deal_id);
  return { error: null };
}
