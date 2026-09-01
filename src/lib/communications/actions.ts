"use server";

import { revalidatePath } from "next/cache";
import { requireInternalUser } from "@/lib/auth/session";
import {
  buildCommunicationDraft,
  type DraftContext,
} from "@/lib/communications/drafts";
import { insertCommunicationAttempt } from "@/lib/communications/data";
import {
  buildContactedAttempt,
  buildCopiedAttempt,
  buildPortalMessageAttempt,
  buildResponseReceivedAttempt,
  responseReceivedTaskPatch,
} from "@/lib/communications/records";
import { recommendedDraftType } from "@/lib/communications/sequence";
import {
  isCommunicationAudience,
  isCommunicationChannel,
  isDraftType,
} from "@/lib/communications/types";
import { canMutateProcessorTask } from "@/lib/playbooks/authorization";
import { getPlaybook } from "@/lib/playbooks/registry";
import { templateContextFromDeal } from "@/lib/playbooks/templates";
import { assertSandboxGuard } from "@/lib/sandbox";
import {
  contactActionChannel,
  markTaskContactedPatch,
  markTaskWaitingPatch,
} from "@/lib/contacts/logic";
import { logAuthorizedActivity } from "@/lib/workflow/activity";

export type CommunicationActionResult = {
  error: string | null;
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

async function loadMutableTask(taskId: string) {
  assertSandboxGuard();
  const { supabase, user, profile } = await requireInternalUser();
  const expanded = await supabase
    .from("tasks")
    .select(
      "id, deal_id, status, assigned_to, follow_up_interval_hours, playbook_key, title, client_need_id, deal_contact_id, contact_name, last_contacted_at, last_response_at, waiting_since, next_follow_up_at, escalation_after_hours, escalation_level, source_type",
    )
    .eq("id", taskId)
    .maybeSingle();
  const staff = expanded.error
    ? await supabase
        .from("tasks")
        .select(
          "id, deal_id, status, assigned_to, follow_up_interval_hours, playbook_key, title, client_need_id, deal_contact_id, contact_name, last_contacted_at, waiting_since, next_follow_up_at, escalation_after_hours, escalation_level, source_type",
        )
        .eq("id", taskId)
        .maybeSingle()
    : expanded;
  const task = staff.data
    ? { last_response_at: null, ...staff.data }
    : null;
  if (staff.error || !task) {
    return { error: "Task not found." as const };
  }
  const { data: deal } = await supabase
    .from("deals")
    .select(
      "id, assigned_processor_id, borrower_name, entity_name, property_address, property_city, property_state, loan_type, deal_reference",
    )
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

async function draftForTask(
  task: {
    playbook_key: string | null;
    contact_name: string | null;
    client_need_id: string | null;
    last_contacted_at: string | null;
    last_response_at: string | null;
    waiting_since: string | null;
    next_follow_up_at: string | null;
    follow_up_interval_hours: number | null;
    escalation_after_hours: number | null;
    escalation_level: string | null;
    source_type: string | null;
    status: string;
  },
  deal: {
    borrower_name: string | null;
    entity_name: string | null;
    property_address: string | null;
    property_city: string | null;
    property_state: string | null;
    loan_type: string | null;
    deal_reference: string | null;
  },
  extras: {
    draftType?: string;
    audience?: string;
    channel?: string;
    clientNeed?: string | null;
    processorName?: string | null;
    replacementNeeded?: boolean;
  },
) {
  const playbook = task.playbook_key ? getPlaybook(task.playbook_key) : null;
  const requestedType = extras.draftType ?? "";
  const requestedAudience = extras.audience ?? "";
  const requestedChannel = extras.channel ?? "";
  const draftType = isDraftType(requestedType)
    ? requestedType
    : recommendedDraftType(
        {
          status: task.status,
          sourceType: task.source_type,
          lastContactedAt: task.last_contacted_at,
          lastResponseAt: task.last_response_at,
          nextFollowUpAt: task.next_follow_up_at,
          waitingSince: task.waiting_since,
          followUpIntervalHours: task.follow_up_interval_hours,
          escalationAfterHours: task.escalation_after_hours,
          escalationLevel: task.escalation_level,
        },
        { replacementNeeded: extras.replacementNeeded },
      ) ?? "initial";
  const context: DraftContext = {
    ...templateContextFromDeal({
      borrowerName: deal.borrower_name,
      entityName: deal.entity_name,
      propertyAddress: deal.property_address,
      propertyCity: deal.property_city,
      propertyState: deal.property_state,
      loanType: deal.loan_type,
      dealReference: deal.deal_reference,
      contactName: task.contact_name,
    }),
    client_need: extras.clientNeed,
    requested_items: extras.clientNeed,
    processor_name: extras.processorName,
  };
  return buildCommunicationDraft({
    draftType,
    audience: isCommunicationAudience(requestedAudience)
      ? requestedAudience
      : "internal",
    channel: isCommunicationChannel(requestedChannel)
      ? requestedChannel
      : "email",
    requestTemplate: playbook?.requestTemplate,
    context,
  });
}

export async function markTaskContactedWithCommunicationAction(
  formData: FormData,
): Promise<CommunicationActionResult> {
  const loaded = await loadMutableTask(asString(formData.get("taskId")));
  if (loaded.error) {
    return { error: loaded.error };
  }
  const { supabase, user, profile, task, deal } = loaded;
  const now = new Date().toISOString();
  const markWaiting = asString(formData.get("markWaiting")) !== "false";
  const requestedChannel = asString(formData.get("channel"));
  const channel = isCommunicationChannel(requestedChannel)
    ? requestedChannel
    : "email";
  const { data: need } = task.client_need_id
    ? await supabase
        .from("client_needs")
        .select("document_type, status")
        .eq("id", task.client_need_id)
        .maybeSingle()
    : { data: null };
  const draft = await draftForTask(task, deal, {
    draftType: asString(formData.get("draftType")),
    audience: asString(formData.get("audience")),
    channel,
    clientNeed: need?.document_type ?? null,
    processorName: profile.fullName,
    replacementNeeded: need?.status === "rejected",
  });
  const patch = markTaskContactedPatch({
    nowIso: now,
    followUpIntervalHours: task.follow_up_interval_hours,
    sourceType: task.source_type,
    markWaiting,
  });
  const channelStub = contactActionChannel();
  const recorded = await insertCommunicationAttempt(
    supabase,
    buildContactedAttempt({
      dealId: task.deal_id,
      taskId: task.id,
      clientNeedId: task.client_need_id,
      dealContactId: task.deal_contact_id,
      createdBy: user.id,
      channel,
      draft,
      attemptedAt: now,
      audience: draft.audience,
    }),
  );
  if (recorded.error) {
    return { error: recorded.error };
  }
  const { data: updated, error } = await supabase
    .from("tasks")
    .update(patch)
    .eq("id", task.id)
    .select("id, last_contacted_at, next_follow_up_at")
    .maybeSingle();
  if (error || !updated?.last_contacted_at || !updated.next_follow_up_at) {
    return { error: "Unable to mark this task contacted." };
  }
  await logAuthorizedActivity({
    dealId: task.deal_id,
    actorId: user.id,
    eventType: "contact_marked",
    metadata: {
      from: task.status,
      outbound_sent: String(channelStub.outboundSent),
      channel,
    },
  });
  refreshDeal(task.deal_id);
  return { error: null };
}

export async function markResponseReceivedAction(
  formData: FormData,
): Promise<CommunicationActionResult> {
  const loaded = await loadMutableTask(asString(formData.get("taskId")));
  if (loaded.error) {
    return { error: loaded.error };
  }
  const { supabase, user, task } = loaded;
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("tasks")
    .update(responseReceivedTaskPatch(now))
    .eq("id", task.id);
  if (error) {
    return { error: "Unable to mark the response received." };
  }
  const recorded = await insertCommunicationAttempt(
    supabase,
    buildResponseReceivedAttempt({
      dealId: task.deal_id,
      taskId: task.id,
      clientNeedId: task.client_need_id,
      dealContactId: task.deal_contact_id,
      createdBy: user.id,
      attemptedAt: now,
      note: asString(formData.get("note")) || null,
    }),
  );
  if (recorded.error) {
    return { error: recorded.error };
  }
  await logAuthorizedActivity({
    dealId: task.deal_id,
    actorId: user.id,
    eventType: "response_received",
    metadata: { from: task.status, to: "in_progress", auto_complete: "false" },
  });
  refreshDeal(task.deal_id);
  return { error: null };
}

export async function simulateInboundResponseAction(
  formData: FormData,
): Promise<CommunicationActionResult> {
  const loaded = await loadMutableTask(asString(formData.get("taskId")));
  if (loaded.error) {
    return { error: loaded.error };
  }
  const { supabase, user, task } = loaded;
  const now = new Date().toISOString();
  const recorded = await insertCommunicationAttempt(
    supabase,
    buildResponseReceivedAttempt({
      dealId: task.deal_id,
      taskId: task.id,
      clientNeedId: task.client_need_id,
      dealContactId: task.deal_contact_id,
      createdBy: user.id,
      attemptedAt: now,
      sandboxSimulated: true,
    }),
  );
  if (recorded.error) {
    return { error: recorded.error };
  }
  await logAuthorizedActivity({
    dealId: task.deal_id,
    actorId: user.id,
    eventType: "response_received",
    metadata: {
      sandbox_simulated: "true",
      outbound_sent: "false",
    },
  });
  refreshDeal(task.deal_id);
  return { error: null };
}

export async function recordDraftCopiedAction(
  formData: FormData,
): Promise<CommunicationActionResult> {
  const loaded = await loadMutableTask(asString(formData.get("taskId")));
  if (loaded.error) {
    return { error: loaded.error };
  }
  const { supabase, user, profile, task, deal } = loaded;
  const requestedChannel = asString(formData.get("channel"));
  const channel = isCommunicationChannel(requestedChannel)
    ? requestedChannel
    : "email";
  const { data: need } = task.client_need_id
    ? await supabase
        .from("client_needs")
        .select("document_type, status")
        .eq("id", task.client_need_id)
        .maybeSingle()
    : { data: null };
  const draft = await draftForTask(task, deal, {
    draftType: asString(formData.get("draftType")),
    audience: channel === "portal" ? "borrower" : asString(formData.get("audience")),
    channel,
    clientNeed: need?.document_type ?? null,
    processorName: profile.fullName,
    replacementNeeded: need?.status === "rejected",
  });
  const now = new Date().toISOString();
  const attempt =
    channel === "portal"
      ? buildPortalMessageAttempt({
          dealId: task.deal_id,
          taskId: task.id,
          clientNeedId: task.client_need_id,
          dealContactId: task.deal_contact_id,
          createdBy: user.id,
          draft,
          attemptedAt: now,
        })
      : buildCopiedAttempt({
          dealId: task.deal_id,
          taskId: task.id,
          clientNeedId: task.client_need_id,
          dealContactId: task.deal_contact_id,
          createdBy: user.id,
          channel,
          draft,
          attemptedAt: now,
        });
  const recorded = await insertCommunicationAttempt(supabase, attempt);
  if (recorded.error) {
    return { error: recorded.error };
  }
  await logAuthorizedActivity({
    dealId: task.deal_id,
    actorId: user.id,
    eventType:
      channel === "portal" ? "portal_message_created" : "communication_draft_copied",
    metadata: { channel, outbound_sent: "false" },
  });
  refreshDeal(task.deal_id);
  return { error: null };
}

export async function scheduleFollowUpAction(
  formData: FormData,
): Promise<CommunicationActionResult> {
  const loaded = await loadMutableTask(asString(formData.get("taskId")));
  if (loaded.error) {
    return { error: loaded.error };
  }
  const { supabase, user, task } = loaded;
  const nextFollowUpAt = asString(formData.get("nextFollowUpAt"));
  if (!nextFollowUpAt) {
    return { error: "Choose a follow-up time." };
  }
  const iso = new Date(nextFollowUpAt).toISOString();
  const { error } = await supabase
    .from("tasks")
    .update({ next_follow_up_at: iso })
    .eq("id", task.id);
  if (error) {
    return { error: "Unable to set follow-up." };
  }
  await logAuthorizedActivity({
    dealId: task.deal_id,
    actorId: user.id,
    eventType: "follow_up_scheduled",
    metadata: { next_follow_up_at: iso },
  });
  refreshDeal(task.deal_id);
  return { error: null };
}

export async function markTaskWaitingWithCadenceAction(
  formData: FormData,
): Promise<CommunicationActionResult> {
  const loaded = await loadMutableTask(asString(formData.get("taskId")));
  if (loaded.error) {
    return { error: loaded.error };
  }
  const { supabase, user, task } = loaded;
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("tasks")
    .update(
      markTaskWaitingPatch({
        nowIso: now,
        followUpIntervalHours: task.follow_up_interval_hours,
        sourceType: task.source_type,
      }),
    )
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
