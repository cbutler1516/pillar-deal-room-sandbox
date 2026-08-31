import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CommunicationAttempt,
  CommunicationAttemptInput,
} from "@/lib/communications/types";
import type { StaffName } from "@/lib/data/deals";

const ATTEMPT_COLUMNS =
  "id, deal_id, task_id, client_need_id, deal_contact_id, direction, channel, status, subject, body_snapshot, attempted_at, created_by, outbound_sent, draft_type, audience, sandbox_simulated";

function mapAttempt(row: Record<string, unknown>): CommunicationAttempt {
  return {
    id: String(row.id),
    dealId: String(row.deal_id),
    taskId: (row.task_id as string | null) ?? null,
    clientNeedId: (row.client_need_id as string | null) ?? null,
    dealContactId: (row.deal_contact_id as string | null) ?? null,
    direction: row.direction as CommunicationAttempt["direction"],
    channel: row.channel as CommunicationAttempt["channel"],
    status: row.status as CommunicationAttempt["status"],
    subject: (row.subject as string | null) ?? null,
    bodySnapshot: String(row.body_snapshot ?? ""),
    attemptedAt: String(row.attempted_at),
    createdBy: (row.created_by as string | null) ?? null,
    outboundSent: false,
    draftType: (row.draft_type as CommunicationAttempt["draftType"]) ?? null,
    audience: (row.audience as CommunicationAttempt["audience"]) ?? "internal",
    sandboxSimulated: row.sandbox_simulated === true,
  };
}

export async function listCommunications(
  supabase: SupabaseClient,
  dealId: string,
): Promise<CommunicationAttempt[]> {
  const { data, error } = await supabase
    .from("communication_attempts")
    .select(ATTEMPT_COLUMNS)
    .eq("deal_id", dealId)
    .order("attempted_at", { ascending: false });
  if (error || !data) {
    return [];
  }
  return data.map((row) => mapAttempt(row as Record<string, unknown>));
}

export async function listQueueCommunications(
  supabase: SupabaseClient,
): Promise<CommunicationAttempt[]> {
  const { data, error } = await supabase
    .from("communication_attempts")
    .select(ATTEMPT_COLUMNS)
    .order("attempted_at", { ascending: false })
    .limit(200);
  if (error || !data) {
    return [];
  }
  return data.map((row) => mapAttempt(row as Record<string, unknown>));
}

export async function listTaskCommunications(
  supabase: SupabaseClient,
  taskId: string,
): Promise<CommunicationAttempt[]> {
  const { data, error } = await supabase
    .from("communication_attempts")
    .select(ATTEMPT_COLUMNS)
    .eq("task_id", taskId)
    .order("attempted_at", { ascending: false });
  if (error || !data) {
    return [];
  }
  return data.map((row) => mapAttempt(row as Record<string, unknown>));
}

export async function insertCommunicationAttempt(
  supabase: SupabaseClient,
  attempt: CommunicationAttemptInput,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("communication_attempts").insert({
    deal_id: attempt.dealId,
    task_id: attempt.taskId,
    client_need_id: attempt.clientNeedId,
    deal_contact_id: attempt.dealContactId,
    direction: attempt.direction,
    channel: attempt.channel,
    status: attempt.status,
    subject: attempt.subject,
    body_snapshot: attempt.bodySnapshot,
    attempted_at: attempt.attemptedAt,
    created_by: attempt.createdBy,
    outbound_sent: false,
    draft_type: attempt.draftType,
    audience: attempt.audience,
    sandbox_simulated: attempt.sandboxSimulated,
  });
  if (error) {
    return { error: "Unable to record this communication." };
  }
  return { error: null };
}

export async function listActiveStaff(
  supabase: SupabaseClient,
): Promise<StaffName[]> {
  const { data, error } = await supabase
    .from("users")
    .select("id, full_name, email")
    .eq("is_active", true)
    .in("role", ["admin", "processor", "loan_officer"])
    .order("full_name", { ascending: true });
  if (error || !data) {
    return [];
  }
  return data.map((row) => ({
    id: row.id,
    fullName: row.full_name,
    email: row.email,
  }));
}
