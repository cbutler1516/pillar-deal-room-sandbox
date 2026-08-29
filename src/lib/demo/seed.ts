import { assertSandboxGuard, type SandboxEnv } from "@/lib/sandbox";
import { DEMO_DEALS } from "@/lib/demo/catalog";
import { DEMO_REFERENCE_PREFIX, demoDocumentLinkId } from "@/lib/demo/ids";

export type SeedClient = {
  listDemoDealIds(): Promise<string[]>;
  deleteByDealIds(table: string, dealIds: string[]): Promise<void>;
  deleteDocumentLinksForDealIds(dealIds: string[]): Promise<void>;
  deleteDeals(ids: string[]): Promise<void>;
  upsert(table: string, rows: Record<string, unknown>[]): Promise<void>;
};

export type SeedResult = {
  dealCount: number;
  references: string[];
  replacedDealIds: number;
};

export function assertCanSeed(env: SandboxEnv = process.env): void {
  assertSandboxGuard(env);
}

export function buildSeedRows() {
  return DEMO_DEALS.map((deal) => ({
    deal: {
      id: deal.id,
      deal_reference: deal.dealReference,
      borrower_name: deal.borrowerName,
      borrower_email: deal.borrowerEmail,
      borrower_phone: deal.borrowerPhone,
      entity_name: deal.entityName,
      loan_type: deal.loanType,
      loan_purpose: deal.loanPurpose,
      loan_amount: deal.loanAmount,
      property_address: deal.propertyAddress,
      property_city: deal.propertyCity,
      property_state: deal.propertyState,
      property_type: deal.propertyType,
      credit_band: deal.creditBand,
      experience: deal.experience,
      assigned_processor_id: null,
      status: deal.status,
      created_at: deal.createdAt,
      updated_at: deal.updatedAt,
    },
    needs: deal.needs.map((need) => ({
      id: need.id,
      deal_id: deal.id,
      category: need.category,
      document_type: need.documentType,
      description: need.description,
      required: need.required,
      status: need.status,
      requested_at: need.requestedAt,
      received_at: need.receivedAt,
      reviewed_at: need.reviewedAt,
      reviewed_by: null,
      notes: need.notes,
      expected_document_count: need.expectedDocumentCount,
      require_all_linked_approved: need.requireAllLinkedApproved,
    })),
    documents: deal.documents.map((document) => ({
      id: document.id,
      deal_id: deal.id,
      file_name: document.fileName,
      document_type: document.documentType,
      storage_provider: document.storageProvider,
      external_file_id: document.externalFileId,
      mime_type: document.mimeType,
      status: document.status,
      ai_classification: document.aiClassification,
      ai_confidence: document.aiConfidence,
      uploaded_at: document.uploadedAt,
      created_at: document.uploadedAt,
      updated_at: document.uploadedAt,
    })),
    documentLinks: deal.documents.flatMap((document) =>
      document.clientNeedIds.map((clientNeedId) => ({
        id: demoDocumentLinkId(document.id, clientNeedId),
        document_id: document.id,
        client_need_id: clientNeedId,
        linked_at: document.uploadedAt,
        linked_by: null,
        link_source: "system",
      })),
    ),
    contacts: deal.contacts.map((item) => ({
      id: item.id,
      deal_id: deal.id,
      contact_type: item.contactType,
      name: item.name,
      company: item.company,
      email: item.email,
      phone: item.phone,
      notes: item.notes,
      is_primary: item.isPrimary,
      archived_at: null,
      created_at: deal.createdAt,
      updated_at: deal.updatedAt,
    })),
    tasks: deal.tasks.map((task) => ({
      id: task.id,
      deal_id: deal.id,
      task_type: task.taskType,
      title: task.title,
      description: task.description,
      priority: task.priority,
      assigned_to: null,
      status: task.status,
      due_at: task.dueAt,
      completed_at: task.status === "completed" ? deal.updatedAt : null,
      source_type: task.sourceType,
      task_kind: task.taskKind,
      timing: task.timing,
      client_need_id: task.clientNeedId,
      contact_name: task.contactName,
      contact_email: task.contactEmail,
      contact_phone: task.contactPhone,
      follow_up_interval_hours: task.followUpIntervalHours,
      next_follow_up_at: task.nextFollowUpAt,
      escalation_after_hours: task.escalationAfterHours,
      escalation_level: task.escalationLevel,
      completion_rule: task.completionRule,
      playbook_key: task.playbookKey,
      instructions: task.instructions,
      last_contacted_at: task.lastContactedAt,
      waiting_since: task.waitingSince,
      blocked_reason: task.blockedReason,
      deal_contact_id: task.dealContactId,
      created_at: deal.createdAt,
      updated_at: deal.updatedAt,
    })),
    activity: deal.activity.map((event) => ({
      id: event.id,
      deal_id: deal.id,
      event_type: event.eventType,
      actor_type: event.actorType,
      actor_id: null,
      safe_metadata: event.safeMetadata,
      created_at: event.createdAt,
    })),
  }));
}

export async function seedDemoDeals(
  client: SeedClient,
  env: SandboxEnv = process.env,
): Promise<SeedResult> {
  assertCanSeed(env);

  const existingIds = await client.listDemoDealIds();
  if (existingIds.length > 0) {
    await client.deleteByDealIds("activity_log", existingIds);
    await client.deleteByDealIds("tasks", existingIds);
    await client.deleteDocumentLinksForDealIds(existingIds);
    await client.deleteByDealIds("documents", existingIds);
    await client.deleteByDealIds("client_needs", existingIds);
    await client.deleteByDealIds("deal_contacts", existingIds);
    await client.deleteDeals(existingIds);
  }

  const rows = buildSeedRows();
  await client.upsert(
    "deals",
    rows.map((row) => row.deal),
  );
  await client.upsert(
    "client_needs",
    rows.flatMap((row) => row.needs),
  );
  await client.upsert(
    "documents",
    rows.flatMap((row) => row.documents),
  );
  await client.upsert(
    "document_client_needs",
    rows.flatMap((row) => row.documentLinks),
  );
  await client.upsert(
    "deal_contacts",
    rows.flatMap((row) => row.contacts),
  );
  await client.upsert(
    "tasks",
    rows.flatMap((row) => row.tasks),
  );
  await client.upsert(
    "activity_log",
    rows.flatMap((row) => row.activity),
  );

  return {
    dealCount: rows.length,
    references: rows.map((row) => String(row.deal.deal_reference)),
    replacedDealIds: existingIds.length,
  };
}

export { DEMO_REFERENCE_PREFIX };
