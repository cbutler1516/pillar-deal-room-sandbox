import "server-only";

import { readPortalToken } from "@/lib/application/token";
import {
  borrowerPortalMessages,
  type PortalMessage,
} from "@/lib/communications/portal";
import type { CommunicationAttempt } from "@/lib/communications/types";
import { assertSandboxGuard } from "@/lib/sandbox";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export type PortalNeed = {
  id: string;
  documentType: string;
  description: string | null;
  required: boolean;
  status: string;
  timing: "required_now" | "required_later" | "optional";
  documentCount: number;
  expectedDocumentCount: number | null;
};

export type PortalDocument = {
  id: string;
  fileName: string;
  documentType: string | null;
  status: string;
  uploadedAt: string;
  linkedNeedIds: string[];
};

export type PortalDeal = {
  id: string;
  dealReference: string;
  borrowerName: string;
  entityName: string | null;
  loanType: string | null;
  loanAmount: number | null;
  propertyLabel: string;
  status: string;
  needs: PortalNeed[];
  documents: PortalDocument[];
  completeCount: number;
  requiredCount: number;
  messages: PortalMessage[];
};

export async function loadPortalDeal(token: string): Promise<PortalDeal | null> {
  assertSandboxGuard();
  const dealId = readPortalToken(token);
  if (!dealId) {
    return null;
  }
  const admin = createServiceRoleClient();
  const { data: deal } = await admin
    .from("deals")
    .select(
      "id, deal_reference, borrower_name, entity_name, loan_type, loan_amount, property_address, property_city, property_state, status",
    )
    .eq("id", dealId)
    .maybeSingle();
  if (!deal) {
    return null;
  }

  const [{ data: needs }, { data: documents }, { data: links }, { data: tasks }, comms] =
    await Promise.all([
      admin
        .from("client_needs")
        .select("id, document_type, description, required, status, expected_document_count")
        .eq("deal_id", dealId),
      admin
        .from("documents")
        .select("id, file_name, document_type, status, uploaded_at")
        .eq("deal_id", dealId),
      admin
        .from("document_client_needs")
        .select("document_id, client_need_id"),
      admin
        .from("tasks")
        .select("client_need_id, timing")
        .eq("deal_id", dealId),
      admin
        .from("communication_attempts")
        .select(
          "id, deal_id, task_id, client_need_id, deal_contact_id, direction, channel, status, subject, body_snapshot, attempted_at, created_by, outbound_sent, draft_type, audience, sandbox_simulated",
        )
        .eq("deal_id", dealId),
    ]);
  const attempts: CommunicationAttempt[] = (comms.data ?? []).map((row) => ({
    id: String(row.id),
    dealId: String(row.deal_id),
    taskId: row.task_id ?? null,
    clientNeedId: row.client_need_id ?? null,
    dealContactId: row.deal_contact_id ?? null,
    direction: row.direction as CommunicationAttempt["direction"],
    channel: row.channel as CommunicationAttempt["channel"],
    status: row.status as CommunicationAttempt["status"],
    subject: row.subject ?? null,
    bodySnapshot: row.body_snapshot ?? "",
    attemptedAt: String(row.attempted_at),
    createdBy: row.created_by ?? null,
    outboundSent: false,
    draftType: (row.draft_type as CommunicationAttempt["draftType"]) ?? null,
    audience: (row.audience as CommunicationAttempt["audience"]) ?? "internal",
    sandboxSimulated: row.sandbox_simulated === true,
  }));

  const linksFor = (needId: string) =>
    (links ?? []).filter((link) => link.client_need_id === needId);
  const timingFor = (needId: string) => {
    const task = (tasks ?? []).find((row) => row.client_need_id === needId);
    if (task?.timing === "required_later") {
      return "required_later" as const;
    }
    if (task?.timing === "optional") {
      return "optional" as const;
    }
    return "required_now" as const;
  };

  const portalNeeds: PortalNeed[] = (needs ?? []).map((need) => ({
    id: need.id,
    documentType: need.document_type,
    description: need.description,
    required: need.required,
    status: need.status,
    timing: timingFor(need.id),
    documentCount: linksFor(need.id).length,
    expectedDocumentCount:
      need.expected_document_count == null
        ? null
        : Number(need.expected_document_count),
  }));

  const portalDocuments: PortalDocument[] = (documents ?? []).map((doc) => ({
    id: doc.id,
    fileName: doc.file_name,
    documentType: doc.document_type,
    status: doc.status,
    uploadedAt: doc.uploaded_at,
    linkedNeedIds: (links ?? [])
      .filter((link) => link.document_id === doc.id)
      .map((link) => link.client_need_id),
  }));

  const required = portalNeeds.filter((need) => need.required);
  const complete = required.filter((need) =>
    ["approved", "waived"].includes(need.status),
  );

  return {
    id: deal.id,
    dealReference: deal.deal_reference,
    borrowerName: deal.borrower_name,
    entityName: deal.entity_name ?? null,
    loanType: deal.loan_type,
    loanAmount: deal.loan_amount == null ? null : Number(deal.loan_amount),
    propertyLabel: [deal.property_address, deal.property_city, deal.property_state]
      .filter(Boolean)
      .join(", "),
    status: deal.status,
    needs: portalNeeds,
    documents: portalDocuments,
    completeCount: complete.length,
    requiredCount: required.length,
    messages: borrowerPortalMessages({
      attempts,
      needs: portalNeeds,
      borrowerName: deal.borrower_name,
      dealReference: deal.deal_reference,
    }),
  };
}
