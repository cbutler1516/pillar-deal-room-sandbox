"use server";

import { revalidatePath } from "next/cache";
import { canRequestAIAssist } from "@/lib/ai/authorization";
import { getAIProvider } from "@/lib/ai/factory";
import { buildAIDealSnapshot } from "@/lib/ai/snapshot";
import {
  isAIDraftRewriteIntent,
  isAIRewriteChannel,
  type AIDraftRewriteResult,
} from "@/lib/ai/types";
import { requireInternalUser } from "@/lib/auth/session";
import { listCommunications } from "@/lib/communications/data";
import {
  getDealById,
  listActivity,
  listClientNeeds,
  listDealContacts,
  listDocuments,
  listTasks,
} from "@/lib/data/deals";
import { decorateRankedActions } from "@/lib/playbooks/decorate";
import { canCreateProcessorTask } from "@/lib/playbooks/authorization";
import { assertSandboxGuard } from "@/lib/sandbox";
import { logAuthorizedActivity } from "@/lib/workflow/activity";

export type AIRewriteActionResult = {
  error: string | null;
  result: AIDraftRewriteResult | null;
};

function asString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function rewriteCommunicationDraftAction(
  formData: FormData,
): Promise<AIRewriteActionResult> {
  assertSandboxGuard();
  const { supabase, user, profile } = await requireInternalUser();
  if (!canRequestAIAssist(profile.role)) {
    return { error: "Only processors and admins can request AI rewrites.", result: null };
  }

  const dealId = asString(formData.get("dealId"));
  if (!dealId) {
    return { error: "Deal is required.", result: null };
  }

  const deal = await getDealById(supabase, dealId);
  if (!deal) {
    return { error: "Deal not found.", result: null };
  }
  if (
    !canCreateProcessorTask({
      role: profile.role,
      userId: user.id,
      dealAssignedProcessorId: deal.assignedProcessorId,
    })
  ) {
    return { error: "Your role cannot request AI assist on this deal.", result: null };
  }

  const channelRaw = asString(formData.get("channel")) || "email";
  if (!isAIRewriteChannel(channelRaw)) {
    return { error: "Unsupported rewrite channel.", result: null };
  }
  const intentRaw = asString(formData.get("intent")) || "clarify";
  if (!isAIDraftRewriteIntent(intentRaw)) {
    return { error: "Unsupported rewrite intent.", result: null };
  }

  const taskId = asString(formData.get("taskId")) || null;
  const [needs, documents, tasks, contacts, activity, attempts] = await Promise.all([
    listClientNeeds(supabase, deal.id),
    listDocuments(supabase, deal.id),
    listTasks(supabase, deal.id),
    listDealContacts(supabase, deal.id),
    listActivity(supabase, deal.id),
    listCommunications(supabase, deal.id),
  ]);
  if (taskId && !tasks.some((task) => task.id === taskId)) {
    return { error: "Task not found on this deal.", result: null };
  }

  const snapshot = buildAIDealSnapshot({
    deal,
    needs,
    documents,
    tasks,
    nextActions: decorateRankedActions(tasks, [deal], contacts, needs),
    communications: attempts,
    activity,
  });

  const provider = getAIProvider();
  const result = await provider.rewriteDraft({
    snapshot,
    channel: channelRaw,
    currentSubject: asString(formData.get("subject")) || null,
    currentBody: asString(formData.get("body")),
    intent: intentRaw,
    taskId,
  });

  await logAuthorizedActivity({
    dealId: deal.id,
    actorId: profile.id,
    eventType: "ai_assist_requested",
    metadata: {
      capability: "rewrite_communication",
      channel: channelRaw,
      intent: intentRaw,
      provider: result.provider,
      outbound_sent: "false",
      task: taskId,
    },
  });

  revalidatePath(`/deals/${deal.id}`);
  return { error: null, result };
}
