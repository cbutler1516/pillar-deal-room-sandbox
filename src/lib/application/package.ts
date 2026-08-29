import { applicationIntakeFromDraft } from "@/lib/application/intake";
import { parseMoney } from "@/lib/application/validate";
import type { ApplicationDraft } from "@/lib/application/types";
import { CONTACT_MISSING } from "@/lib/contacts/types";
import {
  clientNeedInsertFromPlaybook,
  instantiatePlaybook,
} from "@/lib/playbooks/logic";
import {
  baselinePlaybooksForLoanType,
  getPlaybook,
} from "@/lib/playbooks/registry";
import { randomUUID } from "node:crypto";

export const APPLICATION_REFERENCE_PREFIX = "PDR-APP-";

export type ApplicationPackage = {
  dealId: string;
  dealReference: string;
  deal: Record<string, unknown>;
  contact: Record<string, unknown>;
  needs: Record<string, unknown>[];
  tasks: Record<string, unknown>[];
  activity: Record<string, unknown>;
};

function extraPlaybookKeys(draft: ApplicationDraft): string[] {
  const keys: string[] = [];
  const txn = draft.transactionType.toLowerCase();
  if (txn.includes("purchase") && !draft.loanType.toLowerCase().includes("refi")) {
    keys.push("request_purchase_agreement");
  }
  if (txn.includes("refi")) {
    keys.push("request_mortgage_statement");
  }
  if (draft.loanType.toLowerCase().includes("flip")) {
    keys.push("request_contractor_estimate");
  }
  return keys;
}

const INTAKE_METADATA_KEYS: Array<[string, (draft: ApplicationDraft) => string]> = [
  ["source", () => "sandbox_application"],
  ["loan_type", (draft) => draft.loanType],
  ["transaction", (draft) => draft.transactionType],
  ["property_zip", (draft) => draft.propertyZip],
  ["property_type", (draft) => draft.propertyType],
  ["units", (draft) => draft.units],
  ["square_footage", (draft) => draft.squareFootage],
  ["occupancy", (draft) => draft.occupancy],
  ["purchase_price", (draft) => draft.purchasePrice],
  ["current_value", (draft) => draft.currentValue],
  ["loan_amount", (draft) => draft.loanAmount],
  ["existing_payoff", (draft) => draft.existingPayoff],
  ["cash_out", (draft) => draft.cashOutAmount],
  ["estimated_arv", (draft) => draft.estimatedArv],
  ["rehab_budget", (draft) => draft.rehabBudget],
  ["monthly_rent", (draft) => draft.monthlyRent],
  ["noi", (draft) => draft.noi],
  ["land_owned", (draft) => draft.landOwned],
  ["land_value", (draft) => draft.landValue],
  ["construction_budget", (draft) => draft.constructionBudget],
  ["completed_value", (draft) => draft.completedValue],
  ["plans_permits", (draft) => draft.plansPermitsStatus],
  ["credit_range", (draft) => draft.creditRange],
  ["experience", (draft) => draft.experience],
  ["liquidity", (draft) => draft.liquidity],
  ["net_worth", (draft) => draft.netWorth],
  ["under_contract", (draft) => draft.underContract || "unspecified"],
  ["closing_date", (draft) => draft.closingDate],
  ["timeline", (draft) => draft.fundingTimeline || "unspecified"],
  ["borrower_comments", (draft) => draft.borrowerComments],
  ["loan_officer_notes", (draft) => draft.loanOfficerNotes],
];

export function intakeMetadataFromDraft(
  draft: ApplicationDraft,
): Record<string, string> {
  const metadata: Record<string, string> = {};
  for (const [key, read] of INTAKE_METADATA_KEYS) {
    const value = read(draft).trim();
    if (value) {
      metadata[key] = value.slice(0, 120);
    }
  }
  return metadata;
}

export function playbookKeysForApplication(draft: ApplicationDraft): string[] {
  const keys = [
    ...baselinePlaybooksForLoanType(draft.loanType).map((item) => item.playbookKey),
    ...extraPlaybookKeys(draft),
  ];
  return [...new Set(keys)];
}

export function buildApplicationPackage(
  draft: ApplicationDraft,
  now = new Date(),
): ApplicationPackage {
  const dealId = randomUUID();
  const dealReference = `${APPLICATION_REFERENCE_PREFIX}${dealId.replaceAll("-", "").slice(0, 8).toUpperCase()}`;
  const borrowerName = `${draft.firstName.trim()} ${draft.lastName.trim()}`.trim();
  const createdAt = now.toISOString();
  const playbooks = playbookKeysForApplication(draft)
    .map((key) => getPlaybook(key))
    .filter((item): item is NonNullable<typeof item> => item != null);

  const needs: Record<string, unknown>[] = [];
  const needIdsByType = new Map<string, string>();
  for (const playbook of playbooks) {
    if (!playbook.createsClientNeed || !playbook.needDocumentType) {
      continue;
    }
    const existing = needIdsByType.get(playbook.needDocumentType);
    if (existing) {
      continue;
    }
    const needId = randomUUID();
    needIdsByType.set(playbook.needDocumentType, needId);
    const row = clientNeedInsertFromPlaybook(dealId, playbook);
    needs.push({
      id: needId,
      ...row,
      required: playbook.timing !== "optional",
      status: "requested",
      requested_at: createdAt,
      expected_document_count:
        playbook.expectedDocumentCount ?? row.expected_document_count,
      description: playbook.instructions.split(/(?<=\.)\s/)[0] ?? playbook.title,
    });
  }

  const tasks = playbooks.map((playbook) => {
    const clientNeedId = playbook.needDocumentType
      ? needIdsByType.get(playbook.needDocumentType) ?? null
      : null;
    const instance = instantiatePlaybook(playbook, { clientNeedId });
    const requiresBorrower = playbook.sourceType === "borrower";
    return {
      id: randomUUID(),
      deal_id: dealId,
      task_type: instance.taskType,
      title: instance.title,
      description: instance.description,
      priority: instance.priority,
      assigned_to: null,
      status: "open",
      due_at: null,
      source_type: instance.sourceType,
      task_kind: instance.taskKind,
      timing: instance.timing,
      client_need_id: instance.clientNeedId,
      deal_contact_id: null,
      contact_name: requiresBorrower ? borrowerName : null,
      contact_email: requiresBorrower ? draft.email.trim() : null,
      contact_phone: requiresBorrower ? draft.phone.trim() : null,
      follow_up_interval_hours: instance.followUpIntervalHours,
      next_follow_up_at: null,
      escalation_after_hours: instance.escalationAfterHours,
      escalation_level: instance.escalationLevel,
      completion_rule: instance.completionRule,
      playbook_key: instance.playbookKey,
      instructions: instance.instructions,
      last_contacted_at: null,
      waiting_since: null,
      blocked_reason: playbook.requiresContact && playbook.sourceType !== "borrower"
        ? CONTACT_MISSING
        : null,
      created_at: createdAt,
      updated_at: createdAt,
    };
  });

  const loanPurpose = [
    draft.transactionType,
    draft.propertyType,
    draft.fundingTimeline ? `funding ${draft.fundingTimeline}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    dealId,
    dealReference,
    deal: {
      id: dealId,
      deal_reference: dealReference,
      borrower_name: borrowerName,
      borrower_email: draft.email.trim(),
      borrower_phone: draft.phone.trim(),
      entity_name: draft.entityName.trim() || null,
      loan_type: draft.loanType,
      loan_purpose: loanPurpose || draft.transactionType,
      loan_amount: parseMoney(draft.loanAmount),
      property_address: draft.propertyAddress.trim(),
      property_city: draft.propertyCity.trim(),
      property_state: draft.propertyState.trim().toUpperCase(),
      property_type: draft.propertyType.trim() || null,
      credit_band: draft.creditRange.trim() || null,
      experience: draft.experience.trim() || null,
      assigned_processor_id: null,
      status: "new",
      application_intake: applicationIntakeFromDraft(draft),
      created_at: createdAt,
      updated_at: createdAt,
    },
    contact: {
      id: randomUUID(),
      deal_id: dealId,
      contact_type: "borrower",
      name: borrowerName,
      company: draft.entityName.trim() || null,
      email: draft.email.trim(),
      phone: draft.phone.trim(),
      notes: [draft.entityType, draft.ownershipPercent && `${draft.ownershipPercent}% ownership`]
        .filter(Boolean)
        .join(" · ") || null,
      is_primary: true,
      archived_at: null,
      created_at: createdAt,
      updated_at: createdAt,
    },
    needs,
    tasks,
    activity: {
      deal_id: dealId,
      event_type: "application_received",
      actor_type: "system",
      actor_id: null,
      safe_metadata: intakeMetadataFromDraft(draft),
      created_at: createdAt,
    },
  };
}
