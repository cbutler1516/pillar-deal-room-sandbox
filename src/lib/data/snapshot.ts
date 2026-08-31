import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { DealStatus } from "@/lib/data/types";

export type SnapshotDeal = {
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

export type SnapshotNeed = {
  id: string;
  dealId: string;
  required: boolean;
  status: string;
  documentType: string | null;
  expectedDocumentCount: number | null;
};

export type SnapshotDocument = {
  id: string;
  dealId: string;
  status: string;
  fileName: string | null;
  documentType: string | null;
  mimeType: string | null;
  linkedNeedIds: string[];
};

export type SnapshotContact = {
  id: string;
  dealId: string;
  contactType: string;
  archivedAt: string | null;
};

export type SnapshotTask = {
  id: string;
  dealId: string;
  title: string;
  priority: string;
  status: string;
  timing: string | null;
  taskKind: string | null;
  sourceType: string | null;
  playbookKey: string | null;
  blockedReason: string | null;
  dealContactId: string | null;
  nextFollowUpAt: string | null;
  lastContactedAt: string | null;
  lastResponseAt: string | null;
  followUpIntervalHours: number | null;
  escalationAfterHours: number | null;
  escalationLevel: string | null;
  waitingSince: string | null;
  createdAt: string | null;
  dueAt: string | null;
  clientNeedId: string | null;
  contactName: string | null;
};

export async function loadDealSnapshot(supabase: SupabaseClient): Promise<{
  deals: SnapshotDeal[];
  needs: SnapshotNeed[];
  documents: SnapshotDocument[];
  tasks: SnapshotTask[];
  contacts: SnapshotContact[];
}> {
  const [dealsRes, needsRes, docsRes, tasksRes, linksRes, contactsRes] =
    await Promise.all([
    supabase
      .from("deals")
      .select(
        "id, deal_reference, borrower_name, entity_name, loan_type, loan_amount, property_address, property_city, property_state, status, assigned_processor_id, created_at, updated_at",
      )
      .order("updated_at", { ascending: false }),
    supabase
      .from("client_needs")
      .select("id, deal_id, required, status, document_type, expected_document_count"),
    supabase
      .from("documents")
      .select("id, deal_id, status, file_name, document_type, mime_type"),
    supabase
      .from("tasks")
      .select(
        "id, deal_id, title, priority, status, timing, task_kind, source_type, playbook_key, blocked_reason, deal_contact_id, client_need_id, next_follow_up_at, last_contacted_at, last_response_at, follow_up_interval_hours, escalation_after_hours, escalation_level, waiting_since, created_at, due_at, contact_name",
      ),
    supabase.from("document_client_needs").select("document_id, client_need_id"),
    supabase
      .from("deal_contacts")
      .select("id, deal_id, contact_type, archived_at"),
  ]);

  const linksByDocument = new Map<string, string[]>();
  for (const link of linksRes.data ?? []) {
    const current = linksByDocument.get(link.document_id) ?? [];
    current.push(link.client_need_id);
    linksByDocument.set(link.document_id, current);
  }

  return {
    deals: (dealsRes.data ?? []).map((row) => ({
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
    })),
    needs: (needsRes.data ?? []).map((row) => ({
      id: row.id,
      dealId: row.deal_id,
      required: row.required,
      status: row.status,
      documentType: row.document_type ?? null,
      expectedDocumentCount: row.expected_document_count ?? null,
    })),
    documents: (docsRes.data ?? []).map((row) => ({
      id: row.id,
      dealId: row.deal_id,
      status: row.status,
      fileName: row.file_name ?? null,
      documentType: row.document_type ?? null,
      mimeType: row.mime_type ?? null,
      linkedNeedIds: linksByDocument.get(row.id) ?? [],
    })),
    contacts: (contactsRes.data ?? []).map((row) => ({
      id: row.id,
      dealId: row.deal_id,
      contactType: row.contact_type,
      archivedAt: row.archived_at ?? null,
    })),
    tasks: (tasksRes.data ?? []).map((row) => ({
      id: row.id,
      dealId: row.deal_id,
      title: row.title ?? "",
      priority: row.priority,
      status: row.status,
      timing: row.timing ?? null,
      taskKind: row.task_kind ?? null,
      sourceType: row.source_type ?? null,
      playbookKey: row.playbook_key ?? null,
      blockedReason: row.blocked_reason ?? null,
      dealContactId: row.deal_contact_id ?? null,
      nextFollowUpAt: row.next_follow_up_at ?? null,
      lastContactedAt: row.last_contacted_at ?? null,
      lastResponseAt: row.last_response_at ?? null,
      followUpIntervalHours: row.follow_up_interval_hours ?? null,
      escalationAfterHours: row.escalation_after_hours ?? null,
      escalationLevel: row.escalation_level ?? null,
      waitingSince: row.waiting_since ?? null,
      createdAt: row.created_at ?? null,
      dueAt: row.due_at ?? null,
      clientNeedId: row.client_need_id ?? null,
      contactName: row.contact_name ?? null,
    })),
  };
}
