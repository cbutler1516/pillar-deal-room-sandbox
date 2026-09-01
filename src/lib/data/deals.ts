import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { DealStatus } from "@/lib/data/types";

export type { DealStatus };

export type DealListItem = {
  id: string;
  dealReference: string;
  borrowerName: string;
  entityName: string | null;
  loanType: string | null;
  loanAmount: number | null;
  propertyAddress: string | null;
  propertyCity: string | null;
  propertyState: string | null;
  status: DealStatus;
  assignedProcessorId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DealDetail = DealListItem & {
  borrowerEmail: string | null;
  borrowerPhone: string | null;
  entityName: string | null;
  loanPurpose: string | null;
  propertyAddress: string | null;
  propertyType: string | null;
  creditBand: string | null;
  experience: string | null;
  createdAt: string;
  applicationIntake: unknown | null;
};

export type ClientNeedRow = {
  id: string;
  category: string;
  documentType: string;
  description: string | null;
  required: boolean;
  status: string;
  requestedAt: string | null;
  receivedAt: string | null;
  reviewedAt: string | null;
  notes: string | null;
  expectedDocumentCount: number | null;
  requireAllLinkedApproved: boolean;
};

export type DocumentRow = {
  id: string;
  dealId: string;
  fileName: string;
  documentType: string | null;
  mimeType: string | null;
  storageProvider: string | null;
  status: string;
  uploadedAt: string;
  aiClassification: string | null;
  aiConfidence: number | null;
  linkedNeedIds: string[];
};

export type TaskRow = {
  id: string;
  dealId: string;
  title: string;
  taskType: string;
  description: string | null;
  priority: string;
  status: string;
  dueAt: string | null;
  assignedTo: string | null;
  sourceType: string | null;
  taskKind: string | null;
  timing: string | null;
  clientNeedId: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  followUpIntervalHours: number | null;
  nextFollowUpAt: string | null;
  escalationAfterHours: number | null;
  escalationLevel: string | null;
  completionRule: string | null;
  playbookKey: string | null;
  instructions: string | null;
  lastContactedAt: string | null;
  lastResponseAt: string | null;
  waitingSince: string | null;
  blockedReason: string | null;
  createdAt: string | null;
  dealContactId: string | null;
};

export type DealContactRow = {
  id: string;
  dealId: string;
  contactType: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  isPrimary: boolean;
  archivedAt: string | null;
};

export type ActivityRow = {
  id: string;
  dealId?: string;
  eventType: string;
  actorType: string;
  actorId: string | null;
  createdAt: string;
  safeMetadata: Record<string, string>;
};

export type StaffName = {
  id: string;
  fullName: string | null;
  email: string;
};

const DEAL_LIST_COLUMNS =
  "id, deal_reference, borrower_name, entity_name, loan_type, loan_amount, property_address, property_city, property_state, status, assigned_processor_id, created_at, updated_at";

export async function listDeals(supabase: SupabaseClient): Promise<DealListItem[]> {
  const { data, error } = await supabase
    .from("deals")
    .select(DEAL_LIST_COLUMNS)
    .order("updated_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return data.map((row) => ({
    id: row.id,
    dealReference: row.deal_reference,
    borrowerName: row.borrower_name,
    entityName: row.entity_name,
    loanType: row.loan_type,
    loanAmount: row.loan_amount,
    propertyAddress: row.property_address,
    propertyCity: row.property_city,
    propertyState: row.property_state,
    status: row.status,
    assignedProcessorId: row.assigned_processor_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function getDealById(
  supabase: SupabaseClient,
  id: string,
): Promise<DealDetail | null> {
  const expanded = await supabase
    .from("deals")
    .select(
      `${DEAL_LIST_COLUMNS}, borrower_email, borrower_phone, loan_purpose, property_type, credit_band, experience, application_intake`,
    )
    .eq("id", id)
    .maybeSingle();

  const result = expanded.error
    ? await supabase
        .from("deals")
        .select(
          `${DEAL_LIST_COLUMNS}, borrower_email, borrower_phone, loan_purpose, property_type, credit_band, experience`,
        )
        .eq("id", id)
        .maybeSingle()
    : expanded;

  if (result.error || !result.data) {
    return null;
  }

  const data = result.data as typeof result.data & {
    application_intake?: unknown;
  };

  return {
    id: data.id,
    dealReference: data.deal_reference,
    borrowerName: data.borrower_name,
    entityName: data.entity_name,
    loanType: data.loan_type,
    loanAmount: data.loan_amount,
    propertyAddress: data.property_address,
    propertyCity: data.property_city,
    propertyState: data.property_state,
    status: data.status,
    assignedProcessorId: data.assigned_processor_id,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    borrowerEmail: data.borrower_email,
    borrowerPhone: data.borrower_phone,
    loanPurpose: data.loan_purpose,
    propertyType: data.property_type,
    creditBand: data.credit_band,
    experience: data.experience,
    applicationIntake: data.application_intake ?? null,
  };
}

export async function listClientNeeds(
  supabase: SupabaseClient,
  dealId: string,
): Promise<ClientNeedRow[]> {
  const { data, error } = await supabase
    .from("client_needs")
    .select(
      "id, category, document_type, description, required, status, requested_at, received_at, reviewed_at, notes, expected_document_count, require_all_linked_approved",
    )
    .eq("deal_id", dealId)
    .order("created_at", { ascending: true });

  if (error || !data) {
    return [];
  }

  return data.map((row) => ({
    id: row.id,
    category: row.category,
    documentType: row.document_type,
    description: row.description,
    required: row.required,
    status: row.status,
    requestedAt: row.requested_at,
    receivedAt: row.received_at,
    reviewedAt: row.reviewed_at,
    notes: row.notes,
    expectedDocumentCount: row.expected_document_count,
    requireAllLinkedApproved: row.require_all_linked_approved ?? true,
  }));
}

export async function listDocuments(
  supabase: SupabaseClient,
  dealId: string,
): Promise<DocumentRow[]> {
  const { data, error } = await supabase
    .from("documents")
    .select(
      "id, deal_id, file_name, document_type, mime_type, storage_provider, status, uploaded_at, ai_classification, ai_confidence",
    )
    .eq("deal_id", dealId)
    .order("uploaded_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  const documentIds = data.map((row) => row.id);
  const { data: links } = documentIds.length
    ? await supabase
        .from("document_client_needs")
        .select("document_id, client_need_id")
        .in("document_id", documentIds)
    : { data: [] };

  const linksByDocument = new Map<string, string[]>();
  for (const link of links ?? []) {
    const current = linksByDocument.get(link.document_id) ?? [];
    current.push(link.client_need_id);
    linksByDocument.set(link.document_id, current);
  }

  return data.map((row) => ({
    id: row.id,
    dealId: row.deal_id,
    fileName: row.file_name,
    documentType: row.document_type,
    mimeType: row.mime_type,
    storageProvider: row.storage_provider,
    status: row.status,
    uploadedAt: row.uploaded_at,
    aiClassification: row.ai_classification,
    aiConfidence: row.ai_confidence,
    linkedNeedIds: linksByDocument.get(row.id) ?? [],
  }));
}

const TASK_COLUMNS =
  "id, deal_id, title, task_type, description, priority, status, due_at, assigned_to, source_type, task_kind, timing, client_need_id, deal_contact_id, contact_name, contact_email, contact_phone, follow_up_interval_hours, next_follow_up_at, escalation_after_hours, escalation_level, completion_rule, playbook_key, instructions, last_contacted_at, last_response_at, waiting_since, blocked_reason, created_at";

const TASK_COLUMNS_WITHOUT_RESPONSE =
  "id, deal_id, title, task_type, description, priority, status, due_at, assigned_to, source_type, task_kind, timing, client_need_id, deal_contact_id, contact_name, contact_email, contact_phone, follow_up_interval_hours, next_follow_up_at, escalation_after_hours, escalation_level, completion_rule, playbook_key, instructions, last_contacted_at, waiting_since, blocked_reason, created_at";

const TASK_COLUMNS_LEGACY =
  "id, deal_id, title, task_type, description, priority, status, due_at, assigned_to";

function mapTaskRow(row: Record<string, unknown>, fallbackDealId?: string): TaskRow {
  return {
    id: String(row.id),
    dealId: String(row.deal_id ?? fallbackDealId ?? ""),
    title: String(row.title ?? ""),
    taskType: String(row.task_type ?? ""),
    description: (row.description as string | null) ?? null,
    priority: String(row.priority ?? "normal"),
    status: String(row.status ?? "open"),
    dueAt: (row.due_at as string | null) ?? null,
    assignedTo: (row.assigned_to as string | null) ?? null,
    sourceType: (row.source_type as string | null) ?? null,
    taskKind: (row.task_kind as string | null) ?? null,
    timing: (row.timing as string | null) ?? null,
    clientNeedId: (row.client_need_id as string | null) ?? null,
    contactName: (row.contact_name as string | null) ?? null,
    contactEmail: (row.contact_email as string | null) ?? null,
    contactPhone: (row.contact_phone as string | null) ?? null,
    followUpIntervalHours:
      typeof row.follow_up_interval_hours === "number"
        ? row.follow_up_interval_hours
        : null,
    nextFollowUpAt: (row.next_follow_up_at as string | null) ?? null,
    escalationAfterHours:
      typeof row.escalation_after_hours === "number"
        ? row.escalation_after_hours
        : null,
    escalationLevel: (row.escalation_level as string | null) ?? null,
    completionRule: (row.completion_rule as string | null) ?? null,
    playbookKey: (row.playbook_key as string | null) ?? null,
    instructions: (row.instructions as string | null) ?? null,
    lastContactedAt: (row.last_contacted_at as string | null) ?? null,
    lastResponseAt: (row.last_response_at as string | null) ?? null,
    waitingSince: (row.waiting_since as string | null) ?? null,
    blockedReason: (row.blocked_reason as string | null) ?? null,
    createdAt: (row.created_at as string | null) ?? null,
    dealContactId: (row.deal_contact_id as string | null) ?? null,
  };
}

export async function listDealContacts(
  supabase: SupabaseClient,
  dealId: string,
): Promise<DealContactRow[]> {
  const { data, error } = await supabase
    .from("deal_contacts")
    .select(
      "id, deal_id, contact_type, name, company, email, phone, notes, is_primary, archived_at",
    )
    .eq("deal_id", dealId)
    .order("created_at", { ascending: true });

  if (error || !data) {
    return [];
  }

  return data.map((row) => ({
    id: row.id,
    dealId: row.deal_id,
    contactType: row.contact_type,
    name: row.name,
    company: row.company,
    email: row.email,
    phone: row.phone,
    notes: row.notes,
    isPrimary: row.is_primary,
    archivedAt: row.archived_at,
  }));
}

export async function listQueueContacts(
  supabase: SupabaseClient,
): Promise<DealContactRow[]> {
  const { data, error } = await supabase
    .from("deal_contacts")
    .select(
      "id, deal_id, contact_type, name, company, email, phone, notes, is_primary, archived_at",
    )
    .is("archived_at", null);

  if (error || !data) {
    return [];
  }

  return data.map((row) => ({
    id: row.id,
    dealId: row.deal_id,
    contactType: row.contact_type,
    name: row.name,
    company: row.company,
    email: row.email,
    phone: row.phone,
    notes: row.notes,
    isPrimary: row.is_primary,
    archivedAt: row.archived_at,
  }));
}

export async function listTasks(
  supabase: SupabaseClient,
  dealId: string,
): Promise<TaskRow[]> {
  const expanded = await supabase
    .from("tasks")
    .select(TASK_COLUMNS)
    .eq("deal_id", dealId)
    .order("created_at", { ascending: true });

  const staff = expanded.error
    ? await supabase
        .from("tasks")
        .select(TASK_COLUMNS_WITHOUT_RESPONSE)
        .eq("deal_id", dealId)
        .order("created_at", { ascending: true })
    : expanded;

  const result = staff.error
    ? await supabase
        .from("tasks")
        .select(TASK_COLUMNS_LEGACY)
        .eq("deal_id", dealId)
        .order("created_at", { ascending: true })
    : staff;

  if (result.error || !result.data) {
    return [];
  }

  return result.data.map((row) => mapTaskRow(row as Record<string, unknown>, dealId));
}

export async function listQueueTasks(
  supabase: SupabaseClient,
): Promise<TaskRow[]> {
  const expanded = await supabase
    .from("tasks")
    .select(TASK_COLUMNS)
    .in("status", ["open", "in_progress", "waiting"]);
  const staff = expanded.error
    ? await supabase
        .from("tasks")
        .select(TASK_COLUMNS_WITHOUT_RESPONSE)
        .in("status", ["open", "in_progress", "waiting"])
    : expanded;

  if (staff.error || !staff.data) {
    return [];
  }

  return staff.data.map((row) => mapTaskRow(row as Record<string, unknown>));
}

export async function listWorkspaceTasks(
  supabase: SupabaseClient,
): Promise<TaskRow[]> {
  const expanded = await supabase
    .from("tasks")
    .select(TASK_COLUMNS)
    .in("status", ["open", "in_progress", "waiting", "completed"]);
  const staff = expanded.error
    ? await supabase
        .from("tasks")
        .select(TASK_COLUMNS_WITHOUT_RESPONSE)
        .in("status", ["open", "in_progress", "waiting", "completed"])
    : expanded;

  if (staff.error || !staff.data) {
    return [];
  }

  return staff.data.map((row) => mapTaskRow(row as Record<string, unknown>));
}

export async function listReviewDocuments(
  supabase: SupabaseClient,
  limit = 8,
): Promise<
  {
    id: string;
    dealId: string;
    fileName: string;
    documentType: string | null;
    uploadedAt: string;
  }[]
> {
  const { data, error } = await supabase
    .from("documents")
    .select("id, deal_id, file_name, document_type, uploaded_at")
    .eq("status", "needs_review")
    .order("uploaded_at", { ascending: false })
    .limit(limit);

  if (error || !data) {
    return [];
  }

  return data.map((row) => ({
    id: row.id,
    dealId: row.deal_id,
    fileName: row.file_name,
    documentType: row.document_type,
    uploadedAt: row.uploaded_at,
  }));
}

function mapActivityRow(
  row: {
    id: string;
    deal_id?: string;
    event_type: string;
    actor_type: string;
    actor_id?: string | null;
    created_at: string;
    safe_metadata: unknown;
  },
): ActivityRow {
  return {
    id: row.id,
    dealId: row.deal_id,
    eventType: row.event_type,
    actorType: row.actor_type,
    actorId: row.actor_id ?? null,
    createdAt: row.created_at,
    safeMetadata:
      row.safe_metadata && typeof row.safe_metadata === "object"
        ? Object.fromEntries(
            Object.entries(row.safe_metadata).filter(
              (entry): entry is [string, string] => typeof entry[1] === "string",
            ),
          )
        : {},
  };
}

export async function listActivity(
  supabase: SupabaseClient,
  dealId: string,
): Promise<ActivityRow[]> {
  const { data, error } = await supabase
    .from("activity_log")
    .select("id, deal_id, event_type, actor_type, actor_id, created_at, safe_metadata")
    .eq("deal_id", dealId)
    .order("created_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return data.map(mapActivityRow);
}

export async function listRecentActivity(
  supabase: SupabaseClient,
  limit = 8,
): Promise<ActivityRow[]> {
  const { data, error } = await supabase
    .from("activity_log")
    .select("id, deal_id, event_type, actor_type, actor_id, created_at, safe_metadata")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) {
    return [];
  }

  return data.map(mapActivityRow);
}

export async function listStaffNames(
  supabase: SupabaseClient,
  ids: string[],
): Promise<StaffName[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) {
    return [];
  }
  const { data, error } = await supabase
    .from("users")
    .select("id, full_name, email")
    .in("id", unique);
  if (error || !data) {
    return [];
  }
  return data.map((row) => ({
    id: row.id,
    fullName: row.full_name,
    email: row.email,
  }));
}

export function staffDisplayName(staff: StaffName | undefined): string {
  if (!staff) {
    return "Assigned processor";
  }
  return staff.fullName?.trim() || staff.email;
}
