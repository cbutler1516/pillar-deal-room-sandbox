import type { DecoratedAction } from "@/lib/playbooks/decorate";
import {
  collectOperationalWork,
  topWorkItemForDeal,
  type NextActionTarget,
  type OperationalDeal,
  type OperationalDocument,
  type OperationalNeed,
  type OperationalTask,
  type OperationalWorkItem,
} from "@/lib/ops/operational-work";

export type { NextActionTarget };

export type DealNextAction = {
  action: string;
  source: string | null;
  contactName: string | null;
  dueAt: string | null;
  href: string;
  target: NextActionTarget;
};

type NextActionNeed = {
  id: string;
  documentType: string;
  required: boolean;
  status: string;
};

type NextActionDocument = {
  id: string;
  documentType: string | null;
  status: string;
  fileName?: string | null;
  mimeType?: string | null;
  linkedNeedIds?: string[];
};

export type NextActionMismatch = {
  documentId: string;
  needId: string;
  fileName: string;
  needDocumentType: string;
};

function taskToOperational(task: DecoratedAction): OperationalTask {
  return {
    id: task.id,
    dealId: task.dealId,
    title: task.title,
    status: task.status,
    priority: task.priority,
    timing: task.timing,
    taskKind: task.taskKind,
    sourceType: task.sourceType,
    playbookKey: task.playbookKey,
    blockedReason: task.blockedReason,
    dealContactId: task.dealContactId,
    clientNeedId: task.clientNeedId,
    contactName: task.contactName,
    nextFollowUpAt: task.nextFollowUpAt,
    lastContactedAt: task.lastContactedAt,
    lastResponseAt: task.lastResponseAt,
    waitingSince: task.waitingSince,
    followUpIntervalHours: task.followUpIntervalHours,
    escalationAfterHours: task.escalationAfterHours,
    escalationLevel: task.escalationLevel,
    createdAt: task.createdAt,
    dueAt: task.dueAt,
    requiresContact: task.requiresContact,
    expectedContactType: task.expectedContactType,
  };
}

export function nextActionFromWorkItem(
  row: OperationalWorkItem,
  tasks: DecoratedAction[] = [],
): DealNextAction {
  const task = tasks.find((item) => item.id === row.sourceId);
  const who = task?.contactName ?? task?.sourceType?.replaceAll("_", " ") ?? null;
  const subject = row.title;
  const href = row.href;
  const target = row.target;

  switch (row.workType) {
    case "escalated_task":
    case "escalation_due":
      return {
        action: who
          ? `Escalate ${subject.toLowerCase()} with ${who}`
          : `Escalate follow-up for ${subject.toLowerCase()}`,
        source: task?.sourceType?.replaceAll("_", " ") ?? row.loanType,
        contactName: task?.contactName ?? null,
        dueAt: row.dueAt,
        href,
        target,
      };
    case "replacement_needed":
      return {
        action: `Request replacement ${subject} from ${
          task?.sourceType === "borrower" || !task?.sourceType
            ? "borrower"
            : task.sourceType.replaceAll("_", " ")
        }`,
        source: task?.sourceType?.replaceAll("_", " ") ?? "borrower",
        contactName: task?.contactName ?? null,
        dueAt: task?.nextFollowUpAt ?? row.dueAt,
        href,
        target,
      };
    case "replacement_received":
      return {
        action: `Review replacement ${subject}`,
        source: "internal",
        contactName: null,
        dueAt: null,
        href,
        target,
      };
    case "document_mismatch":
      return {
        action: `Review mismatched ${row.reason.replace(/^Likely mismatch:\s*/i, "")} on ${subject}`,
        source: "internal",
        contactName: null,
        dueAt: null,
        href,
        target,
      };
    case "follow_up_overdue":
    case "follow_up_due_today":
    case "waiting_beyond_cadence":
      return {
        action: who
          ? `Follow up with ${who} for ${subject.toLowerCase()}`
          : `Follow up for ${subject.toLowerCase()}`,
        source: task?.sourceType?.replaceAll("_", " ") ?? null,
        contactName: task?.contactName ?? null,
        dueAt: row.dueAt,
        href,
        target,
      };
    case "response_received":
      return {
        action: who
          ? `Review response from ${who} for ${subject.toLowerCase()}`
          : `Review response for ${subject.toLowerCase()}`,
        source: task?.sourceType?.replaceAll("_", " ") ?? null,
        contactName: task?.contactName ?? null,
        dueAt: row.dueAt,
        href,
        target,
      };
    case "document_awaiting_review":
    case "document_duplicate":
      return {
        action: `Review newly received ${subject.toLowerCase()}`,
        source: "internal",
        contactName: null,
        dueAt: null,
        href,
        target,
      };
    case "required_contact_missing": {
      const contactType =
        task?.expectedContactType ??
        subject.replace(/ contact$/i, "").toLowerCase().replaceAll(" ", "_");
      return {
        action: `Add ${contactType.replaceAll("_", " ")} contact for ${
          task?.title.toLowerCase() ?? "this file"
        }`,
        source: contactType,
        contactName: null,
        dueAt: row.dueAt,
        href,
        target,
      };
    }
    case "no_initial_contact":
      return {
        action: who
          ? `Send initial request to ${who} for ${subject.toLowerCase()}`
          : `Send initial request for ${subject.toLowerCase()}`,
        source: task?.sourceType?.replaceAll("_", " ") ?? null,
        contactName: task?.contactName ?? null,
        dueAt: row.dueAt,
        href,
        target,
      };
    case "required_need_missing":
      return {
        action: `Collect missing required ${subject}`,
        source: "internal",
        contactName: null,
        dueAt: null,
        href,
        target,
      };
    case "new_application":
    case "unassigned_file":
      return {
        action: row.assignedProcessorId
          ? "Start collecting documents on this new file"
          : "Claim this unassigned application",
        source: "internal",
        contactName: null,
        dueAt: null,
        href,
        target,
      };
    default:
      return {
        action: row.reason,
        source: task?.sourceType?.replaceAll("_", " ") ?? row.loanType,
        contactName: task?.contactName ?? null,
        dueAt: row.dueAt,
        href,
        target,
      };
  }
}

export function deriveDealNextAction(input: {
  dealId: string;
  needs: NextActionNeed[];
  documents: NextActionDocument[];
  nextActions: DecoratedAction[];
  mismatches?: NextActionMismatch[];
  deal?: Partial<OperationalDeal>;
  now?: Date;
}): DealNextAction | null {
  const { dealId, needs, documents, nextActions } = input;
  const first = nextActions[0];
  const deal: OperationalDeal = {
    id: dealId,
    dealReference: input.deal?.dealReference ?? first?.dealReference ?? "",
    borrowerName: input.deal?.borrowerName ?? first?.borrowerName ?? "Unknown",
    entityName: input.deal?.entityName ?? first?.entityName ?? null,
    loanType: input.deal?.loanType ?? first?.loanType ?? null,
    status: input.deal?.status ?? "collecting_documents",
    assignedProcessorId:
      input.deal?.assignedProcessorId ?? first?.assignedTo ?? "assigned",
  };

  const work = collectOperationalWork({
    deals: [deal],
    needs: needs.map(
      (need): OperationalNeed => ({
        id: need.id,
        dealId,
        documentType: need.documentType,
        required: need.required,
        status: need.status,
      }),
    ),
    documents: documents.map(
      (doc): OperationalDocument => ({
        id: doc.id,
        dealId,
        documentType: doc.documentType,
        status: doc.status,
        fileName: doc.fileName,
        mimeType: doc.mimeType,
        linkedNeedIds: doc.linkedNeedIds,
      }),
    ),
    tasks: nextActions.map(taskToOperational),
    mismatches: (input.mismatches ?? []).map((row) => ({
      ...row,
      dealId,
    })),
    now: input.now,
  });

  const top = topWorkItemForDeal(work, dealId);
  if (!top) {
    return null;
  }
  return nextActionFromWorkItem(top, nextActions);
}
