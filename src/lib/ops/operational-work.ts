import { conditionQueueAction, conditionQueueReason, isLenderCondition } from "@/lib/conditions/model";
import { staffCalendarDate } from "@/lib/format";
import { CONTACT_MISSING } from "@/lib/contacts/types";
import {
  applyPlaybookContactRequirement,
  isActiveTaskStatus,
  isContactMissing,
  isEscalationDue,
  isFollowUpDue,
  isOverdue,
  waitingAgeHours,
} from "@/lib/playbooks/logic";
import { evaluateSubmissionReadiness } from "@/lib/ops/workflow";

export type NextActionTarget = "tasks" | "needs" | "documents" | "contacts" | "conditions" | "submission";

export const OPERATIONAL_WORK_TYPES = [
  "escalated_task",
  "escalation_due",
  "replacement_needed",
  "replacement_received",
  "document_mismatch",
  "follow_up_overdue",
  "response_received",
  "document_awaiting_review",
  "required_contact_missing",
  "no_initial_contact",
  "new_application",
  "unassigned_file",
  "required_need_missing",
  "active_collection",
  "follow_up_due_today",
  "waiting_on_response",
  "waiting_beyond_cadence",
  "document_duplicate",
  "required_later",
  "optional",
  "near_ready",
  "ready_to_submit",
] as const;

export type OperationalWorkType = (typeof OPERATIONAL_WORK_TYPES)[number];

export const OPERATIONAL_PRIORITY_BANDS = [
  "critical",
  "high",
  "normal",
  "low",
] as const;

export type OperationalPriorityBand =
  (typeof OPERATIONAL_PRIORITY_BANDS)[number];

export const QUEUE_TODAY_SECTIONS = [
  { key: "urgent", label: "Urgent" },
  { key: "due_today", label: "Due today" },
  { key: "needs_review", label: "Needs review" },
  { key: "waiting", label: "Waiting" },
  { key: "new", label: "New" },
] as const;

export type QueueTodaySection = (typeof QUEUE_TODAY_SECTIONS)[number]["key"];

export type OperationalDueState =
  | "overdue"
  | "due_today"
  | "needs_review"
  | "waiting"
  | "new"
  | "later";

export type OperationalWaitingState =
  | "contacted_waiting"
  | "not_yet_requested"
  | "overdue_response"
  | "response_received"
  | "missing_contact"
  | null;

export type OperationalSourceKind =
  | "need"
  | "document"
  | "task"
  | "contact"
  | "deal";

export type OperationalWorkItem = {
  id: string;
  dealId: string;
  dealReference: string;
  borrowerName: string;
  entityName: string | null;
  loanType: string | null;
  workType: OperationalWorkType;
  title: string;
  reason: string;
  recommendedAction: string;
  priorityBand: OperationalPriorityBand;
  priorityRank: number;
  dueState: OperationalDueState;
  queueSection: QueueTodaySection;
  sourceKind: OperationalSourceKind;
  sourceId: string;
  assignedProcessorId: string | null;
  waitingState: OperationalWaitingState;
  dueAt: string | null;
  href: string;
  target: NextActionTarget;
};

export type OperationalDeal = {
  id: string;
  dealReference: string;
  borrowerName: string;
  entityName?: string | null;
  loanType?: string | null;
  status: string;
  assignedProcessorId: string | null;
};

export type OperationalNeed = {
  id: string;
  dealId: string;
  documentType: string | null;
  required: boolean;
  status: string;
  timing?: string | null;
  expectedDocumentCount?: number | null;
};

export type OperationalDocument = {
  id: string;
  dealId: string;
  fileName?: string | null;
  documentType?: string | null;
  mimeType?: string | null;
  status: string;
  linkedNeedIds?: string[];
};

export type OperationalTask = {
  id: string;
  dealId: string;
  title: string;
  status: string;
  priority?: string | null;
  timing?: string | null;
  taskKind?: string | null;
  sourceType?: string | null;
  playbookKey?: string | null;
  blockedReason?: string | null;
  dealContactId?: string | null;
  clientNeedId?: string | null;
  contactName?: string | null;
  nextFollowUpAt?: string | null;
  lastContactedAt?: string | null;
  lastResponseAt?: string | null;
  waitingSince?: string | null;
  followUpIntervalHours?: number | null;
  escalationAfterHours?: number | null;
  escalationLevel?: string | null;
  createdAt?: string | null;
  dueAt?: string | null;
  requiresContact?: boolean;
  expectedContactType?: string | null;
};

export type OperationalContact = {
  id: string;
  dealId: string;
  contactType: string;
  archivedAt?: string | null;
};

export type OperationalMismatch = {
  dealId?: string;
  documentId: string;
  needId: string;
  fileName: string;
  needDocumentType: string;
};

export type OperationalWorkInput = {
  deals: OperationalDeal[];
  needs: OperationalNeed[];
  documents: OperationalDocument[];
  tasks: OperationalTask[];
  contacts?: OperationalContact[];
  mismatches?: OperationalMismatch[];
  now?: Date;
};

export type OperationalDashboardCounts = {
  needsAttention: number;
  waiting: number;
  docsToReview: number;
  ready: number;
  attentionDealIds: string[];
  waitingItemIds: string[];
  reviewItemIds: string[];
  readyDealIds: string[];
};

const CLOSED_DEAL = new Set(["closed", "withdrawn"]);
const SUBMITTED_DEAL = "submitted";
const REVIEW_DOC_STATUS = new Set(["received", "classifying", "needs_review"]);
const COMPLETE_NEED = new Set(["approved", "waived"]);
const CONTACT_SOURCE = new Set([
  "borrower",
  "insurance",
  "title",
  "escrow",
  "contractor",
  "property_manager",
  "cpa",
]);

export const DOCUMENT_REVIEW_TYPES = new Set<OperationalWorkType>([
  "replacement_received",
  "document_mismatch",
  "document_awaiting_review",
  "document_duplicate",
  "response_received",
]);

const ATTENTION_SECTIONS = new Set<QueueTodaySection>([
  "urgent",
  "due_today",
  "needs_review",
  "new",
]);

function bandForRank(rank: number): OperationalPriorityBand {
  if (rank <= 4) return "critical";
  if (rank <= 9) return "high";
  if (rank <= 12) return "normal";
  return "low";
}

function isDueToday(value: string | null | undefined, now: Date): boolean {
  if (!value) return false;
  return staffCalendarDate(new Date(value)) === staffCalendarDate(now);
}

function isPast(value: string | null | undefined, now: Date): boolean {
  if (!value) return false;
  return new Date(value).getTime() <= now.getTime();
}

function hrefFor(dealId: string, tab: NextActionTarget): string {
  return `/deals/${dealId}?tab=${tab}`;
}

function needLabel(need: Pick<OperationalNeed, "documentType">): string {
  return need.documentType?.trim() || "required item";
}

function sourceLabel(value: string | null | undefined): string {
  return (value ?? "").replaceAll("_", " ");
}

function isLaterOrOptional(timing: string | null | undefined): boolean {
  return timing === "required_later" || timing === "optional";
}

function needTiming(
  need: OperationalNeed,
  tasks: OperationalTask[],
): string | null {
  if (need.timing) return need.timing;
  return (
    tasks.find((task) => task.clientNeedId === need.id)?.timing ??
    (need.required ? "required_now" : "optional")
  );
}

function isLowValueUnlinkedPhoto(doc: OperationalDocument): boolean {
  const mime = doc.mimeType?.toLowerCase() ?? "";
  const name = doc.fileName?.toLowerCase() ?? "";
  const unlinked = !doc.linkedNeedIds?.length;
  const looksPhoto =
    mime.startsWith("image/") ||
    /\.(png|jpe?g|gif|webp|heic)$/i.test(name) ||
    /photo|img_|image/i.test(name);
  return unlinked && looksPhoto;
}

function impliedContactType(need: OperationalNeed): string | null {
  const hay = `${need.documentType ?? ""}`.toLowerCase();
  if (hay.includes("insurance")) return "insurance";
  if (hay.includes("title") || hay.includes("cpl") || hay.includes("closing protection")) {
    return "title";
  }
  if (hay.includes("contractor") || hay.includes("rehab") || hay.includes("scope of work")) {
    return "contractor";
  }
  if (hay.includes("escrow")) return "escrow";
  return null;
}

function typesLookSame(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const left = a.toLowerCase();
  const right = b.toLowerCase();
  return left.includes(right) || right.includes(left);
}

export function inferDocumentMismatches(
  needs: OperationalNeed[],
  documents: OperationalDocument[],
): OperationalMismatch[] {
  const byId = new Map(needs.map((need) => [need.id, need]));
  const mismatches: OperationalMismatch[] = [];
  for (const doc of documents) {
    if (isLowValueUnlinkedPhoto(doc)) continue;
    for (const needId of doc.linkedNeedIds ?? []) {
      const need = byId.get(needId);
      if (!need?.documentType || !doc.documentType) continue;
      if (!typesLookSame(need.documentType, doc.documentType)) {
        mismatches.push({
          dealId: doc.dealId,
          documentId: doc.id,
          needId: need.id,
          fileName: doc.fileName ?? doc.id,
          needDocumentType: need.documentType,
        });
      }
    }
  }
  return mismatches;
}

function dealHasContact(
  contacts: OperationalContact[],
  dealId: string,
  contactType: string,
): boolean {
  return contacts.some(
    (contact) =>
      contact.dealId === dealId &&
      contact.contactType === contactType &&
      !contact.archivedAt,
  );
}

function preparedTask(task: OperationalTask) {
  return applyPlaybookContactRequirement({
    id: task.id,
    dealId: task.dealId,
    title: task.title,
    status: task.status,
    priority: task.priority ?? "normal",
    timing: task.timing ?? null,
    taskKind: task.taskKind ?? null,
    sourceType: task.sourceType ?? null,
    instructions: null,
    completionRule: null,
    dueAt: task.dueAt ?? null,
    nextFollowUpAt: task.nextFollowUpAt ?? null,
    lastContactedAt: task.lastContactedAt ?? null,
    lastResponseAt: task.lastResponseAt ?? null,
    waitingSince: task.waitingSince ?? null,
    followUpIntervalHours: task.followUpIntervalHours ?? null,
    escalationAfterHours: task.escalationAfterHours ?? null,
    escalationLevel: task.escalationLevel ?? null,
    assignedTo: null,
    createdAt: task.createdAt ?? null,
    playbookKey: task.playbookKey ?? null,
    clientNeedId: task.clientNeedId ?? null,
    dealContactId: task.dealContactId ?? null,
    blockedReason: task.blockedReason ?? null,
    requiresContact: task.requiresContact,
    expectedContactType: task.expectedContactType,
    contactName: task.contactName,
  });
}

function item(input: {
  deal: OperationalDeal;
  workType: OperationalWorkType;
  rank: number;
  title: string;
  reason: string;
  recommendedAction: string;
  sourceKind: OperationalSourceKind;
  sourceId: string;
  dueState: OperationalDueState;
  queueSection: QueueTodaySection;
  waitingState?: OperationalWaitingState;
  dueAt?: string | null;
  target: NextActionTarget;
}): OperationalWorkItem {
  return {
    id: `${input.workType}:${input.sourceId}`,
    dealId: input.deal.id,
    dealReference: input.deal.dealReference,
    borrowerName: input.deal.borrowerName,
    entityName: input.deal.entityName ?? null,
    loanType: input.deal.loanType ?? null,
    workType: input.workType,
    title: input.title,
    reason: input.reason,
    recommendedAction: input.recommendedAction,
    priorityBand: bandForRank(input.rank),
    priorityRank: input.rank,
    dueState: input.dueState,
    queueSection: input.queueSection,
    sourceKind: input.sourceKind,
    sourceId: input.sourceId,
    assignedProcessorId: input.deal.assignedProcessorId,
    waitingState: input.waitingState ?? null,
    dueAt: input.dueAt ?? null,
    href: hrefFor(input.deal.id, input.target),
    target: input.target,
  };
}

function collectDealWork(
  deal: OperationalDeal,
  needs: OperationalNeed[],
  documents: OperationalDocument[],
  tasks: OperationalTask[],
  contacts: OperationalContact[],
  mismatches: OperationalMismatch[],
  now: Date,
): OperationalWorkItem[] {
  if (CLOSED_DEAL.has(deal.status)) {
    return [];
  }
  const submitted = deal.status === SUBMITTED_DEAL;

  const items: OperationalWorkItem[] = [];
  const coveredNeeds = new Set<string>();
  const coveredContacts = new Set<string>();
  const fileNeeds = needs.filter((need) => need.dealId === deal.id);
  const fileDocs = documents.filter((doc) => doc.dealId === deal.id);
  const fileTasks = tasks
    .filter((task) => task.dealId === deal.id && isActiveTaskStatus(task.status))
    .map(preparedTask);
  const fileMismatches = mismatches.filter(
    (row) => !row.dealId || row.dealId === deal.id,
  );

  const push = (next: OperationalWorkItem) => {
    items.push(next);
  };

  for (const task of fileTasks) {
    const subject =
      fileNeeds.find((need) => need.id === task.clientNeedId)?.documentType ??
      task.title.replace(/^Request\s+/i, "");
    const who = task.contactName ?? sourceLabel(task.sourceType);
    const contactMissing = isContactMissing(task);
    const escalationDue =
      !task.lastResponseAt &&
      (isEscalationDue(task, now) ||
        Boolean(task.escalationLevel && task.escalationLevel !== "none"));
    const followUpDue =
      Boolean(task.lastContactedAt) && isFollowUpDue(task, now);
    const overdue = isOverdue(task, now) || (followUpDue && isPast(task.nextFollowUpAt, now) && !isDueToday(task.nextFollowUpAt, now));

    if (escalationDue) {
      push(
        item({
          deal,
          workType: task.escalationLevel && task.escalationLevel !== "none"
            ? "escalated_task"
            : "escalation_due",
          rank: 1,
          title: subject,
          reason: "Escalation due",
          recommendedAction: "Escalate",
          sourceKind: "task",
          sourceId: task.id,
          dueState: "overdue",
          queueSection: "urgent",
          waitingState: "overdue_response",
          dueAt: task.nextFollowUpAt,
          target: "tasks",
        }),
      );
      if (task.clientNeedId) coveredNeeds.add(task.clientNeedId);
      continue;
    }

    if (contactMissing) {
      const contactType =
        task.expectedContactType ?? task.sourceType ?? "required";
      coveredContacts.add(`${deal.id}:${contactType}`);
      push(
        item({
          deal,
          workType: "required_contact_missing",
          rank: 8,
          title: `${sourceLabel(contactType)} contact`.replace(/^\w/, (c) =>
            c.toUpperCase(),
          ),
          reason: `No ${sourceLabel(contactType)} contact`,
          recommendedAction: "Add contact",
          sourceKind: "contact",
          sourceId: `${deal.id}:${contactType}:${task.id}`,
          dueState: "due_today",
          queueSection: "due_today",
          waitingState: "missing_contact",
          dueAt: task.nextFollowUpAt,
          target: "contacts",
        }),
      );
      continue;
    }

    if (task.lastResponseAt) {
      push(
        item({
          deal,
          workType: "response_received",
          rank: 6,
          title: subject,
          reason: who
            ? `Response received from ${who}`
            : "Response received awaiting review",
          recommendedAction: "Review",
          sourceKind: "task",
          sourceId: task.id,
          dueState: "needs_review",
          queueSection: "needs_review",
          waitingState: "response_received",
          dueAt: task.lastResponseAt,
          target: "tasks",
        }),
      );
      if (task.clientNeedId) coveredNeeds.add(task.clientNeedId);
      continue;
    }

    if (followUpDue || overdue) {
      const hours = waitingAgeHours(task, now);
      const days = hours != null ? Math.floor(hours / 24) : 0;
      push(
        item({
          deal,
          workType: "follow_up_overdue",
          rank: 5,
          title: subject,
          reason:
            days >= 1
              ? `Follow-up overdue by ${days} day${days === 1 ? "" : "s"}`
              : "Follow-up overdue",
          recommendedAction: "Follow up",
          sourceKind: "task",
          sourceId: task.id,
          dueState: "overdue",
          queueSection: "due_today",
          waitingState: "overdue_response",
          dueAt: task.nextFollowUpAt,
          target: "tasks",
        }),
      );
      continue;
    }

    if (isDueToday(task.nextFollowUpAt, now) && task.lastContactedAt) {
      push(
        item({
          deal,
          workType: "follow_up_due_today",
          rank: 5,
          title: subject,
          reason: who ? `Follow-up due with ${who}` : "Follow-up due today",
          recommendedAction: "Follow up",
          sourceKind: "task",
          sourceId: task.id,
          dueState: "due_today",
          queueSection: "due_today",
          waitingState: "contacted_waiting",
          dueAt: task.nextFollowUpAt,
          target: "tasks",
        }),
      );
      continue;
    }

    const requestTask =
      CONTACT_SOURCE.has(task.sourceType ?? "") ||
      task.taskKind === "contact_third_party";

    if (requestTask && !task.lastContactedAt && !isLaterOrOptional(task.timing)) {
      push(
        item({
          deal,
          workType: "no_initial_contact",
          rank: 9,
          title: subject,
          reason: who
            ? `No initial contact with ${who}`
            : "Required task has not had initial contact",
          recommendedAction: "Contact",
          sourceKind: "task",
          sourceId: task.id,
          dueState: "due_today",
          queueSection: "due_today",
          waitingState: "not_yet_requested",
          dueAt: task.dueAt,
          target: "tasks",
        }),
      );
      continue;
    }

    if (task.status === "waiting" && task.lastContactedAt) {
      const cadenceHours = task.followUpIntervalHours ?? 0;
      const beyondCadence =
        cadenceHours > 0 &&
        Boolean(task.waitingSince) &&
        now.getTime() -
          new Date(task.waitingSince as string).getTime() >
          cadenceHours * 3_600_000;
      push(
        item({
          deal,
          workType: beyondCadence
            ? "waiting_beyond_cadence"
            : "waiting_on_response",
          rank: beyondCadence ? 5 : 12,
          title: subject,
          reason: who
            ? `Waiting on ${who}`
            : "Waiting on a response",
          recommendedAction: beyondCadence ? "Follow up" : "Review",
          sourceKind: "task",
          sourceId: task.id,
          dueState: beyondCadence ? "overdue" : "waiting",
          queueSection: beyondCadence ? "due_today" : "waiting",
          waitingState: beyondCadence
            ? "overdue_response"
            : "contacted_waiting",
          dueAt: task.nextFollowUpAt,
          target: "tasks",
        }),
      );
      continue;
    }

    if (
      !isLaterOrOptional(task.timing) &&
      task.taskKind !== "review_document" &&
      task.taskKind !== "prepare_submission"
    ) {
      push(
        item({
          deal,
          workType: "active_collection",
          rank: 12,
          title: subject,
          reason: "Active collection task",
          recommendedAction: "Open",
          sourceKind: "task",
          sourceId: task.id,
          dueState: "due_today",
          queueSection: "due_today",
          waitingState: task.lastContactedAt
            ? "contacted_waiting"
            : "not_yet_requested",
          dueAt: task.nextFollowUpAt ?? task.dueAt,
          target: "tasks",
        }),
      );
    }
  }

  for (const need of fileNeeds) {
    const timing = needTiming(need, fileTasks);
    if (!need.required && timing !== "required_now") {
      continue;
    }
    if (COMPLETE_NEED.has(need.status)) {
      continue;
    }
    if (isLaterOrOptional(timing) && need.status === "missing") {
      continue;
    }

    const linkedReviewDocs = fileDocs.filter(
      (doc) =>
        doc.linkedNeedIds?.includes(need.id) &&
        REVIEW_DOC_STATUS.has(doc.status),
    );
    const typeReviewDocs = fileDocs.filter(
      (doc) =>
        !isLowValueUnlinkedPhoto(doc) &&
        REVIEW_DOC_STATUS.has(doc.status) &&
        doc.documentType &&
        need.documentType &&
        doc.documentType.toLowerCase() === need.documentType.toLowerCase(),
    );
    const reviewDocs =
      linkedReviewDocs.length > 0 ? linkedReviewDocs : typeReviewDocs;
    const mismatch = fileMismatches.find((row) => row.needId === need.id);

    if (need.status === "rejected" && reviewDocs.length > 0) {
      coveredNeeds.add(need.id);
      push(
        item({
          deal,
          workType: "replacement_received",
          rank: 3,
          title: needLabel(need),
          reason: "Replacement received",
          recommendedAction: "Review",
          sourceKind: "need",
          sourceId: need.id,
          dueState: "needs_review",
          queueSection: "urgent",
          dueAt: null,
          target: "documents",
        }),
      );
      continue;
    }

    if (need.status === "rejected") {
      coveredNeeds.add(need.id);
      push(
        item({
          deal,
          workType: "replacement_needed",
          rank: 2,
          title: needLabel(need),
          reason: "Replacement needed",
          recommendedAction: "Request replacement",
          sourceKind: "need",
          sourceId: need.id,
          dueState: "overdue",
          queueSection: "urgent",
          waitingState: "not_yet_requested",
          dueAt: null,
          target: "needs",
        }),
      );
      continue;
    }

    if (mismatch) {
      coveredNeeds.add(need.id);
      push(
        item({
          deal,
          workType: "document_mismatch",
          rank: 4,
          title: needLabel(need),
          reason: `Likely mismatch: ${mismatch.fileName}`,
          recommendedAction: "Review",
          sourceKind: "document",
          sourceId: mismatch.documentId,
          dueState: "needs_review",
          queueSection: "urgent",
          dueAt: null,
          target: "documents",
        }),
      );
      continue;
    }

    if (
      !coveredNeeds.has(need.id) &&
      (reviewDocs.length > 0 || need.status === "needs_review")
    ) {
      const pending = fileDocs.filter(
        (doc) =>
          REVIEW_DOC_STATUS.has(doc.status) &&
          !isLowValueUnlinkedPhoto(doc) &&
          (doc.linkedNeedIds?.includes(need.id) ||
            (doc.documentType &&
              need.documentType &&
              doc.documentType.toLowerCase() ===
                need.documentType.toLowerCase())),
      );
      const count = Math.max(pending.length, reviewDocs.length, 1);
      coveredNeeds.add(need.id);
      push(
        item({
          deal,
          workType: "document_awaiting_review",
          rank: 7,
          title: needLabel(need),
          reason:
            count > 1
              ? `${count} documents received`
              : "Document awaiting processor review",
          recommendedAction: "Review",
          sourceKind: "need",
          sourceId: need.id,
          dueState: "needs_review",
          queueSection: "needs_review",
          dueAt: null,
          target: "documents",
        }),
      );
      continue;
    }

    if (
      need.required &&
      need.status === "missing" &&
      !isLaterOrOptional(timing) &&
      !coveredNeeds.has(need.id)
    ) {
      const implied = impliedContactType(need);
      if (implied && !dealHasContact(contacts, deal.id, implied)) {
        const key = `${deal.id}:${implied}`;
        if (!coveredContacts.has(key)) {
          coveredContacts.add(key);
          push(
            item({
              deal,
              workType: "required_contact_missing",
              rank: 8,
              title: `${sourceLabel(implied).replace(/^\w/, (c) => c.toUpperCase())} contact`,
              reason: `No ${sourceLabel(implied)} contact`,
              recommendedAction: "Add contact",
              sourceKind: "contact",
              sourceId: key,
              dueState: "due_today",
              queueSection: "due_today",
              waitingState: "missing_contact",
              dueAt: null,
              target: "contacts",
            }),
          );
        }
      }
      coveredNeeds.add(need.id);
      push(
        item({
          deal,
          workType: "required_need_missing",
          rank: 11,
          title: needLabel(need),
          reason: "Required item is missing",
          recommendedAction: "Collect",
          sourceKind: "need",
          sourceId: need.id,
          dueState: "due_today",
          queueSection: "due_today",
          waitingState: "not_yet_requested",
          dueAt: null,
          target: "needs",
        }),
      );
    }
  }

  for (const mismatch of fileMismatches) {
    if (items.some((row) => row.sourceId === mismatch.documentId)) {
      continue;
    }
    const doc = fileDocs.find((item) => item.id === mismatch.documentId);
    if (doc && isLowValueUnlinkedPhoto(doc)) {
      continue;
    }
    push(
      item({
        deal,
        workType: "document_mismatch",
        rank: 4,
        title: mismatch.needDocumentType,
        reason: `Likely mismatch: ${mismatch.fileName}`,
        recommendedAction: "Review",
        sourceKind: "document",
        sourceId: mismatch.documentId,
        dueState: "needs_review",
        queueSection: "urgent",
        dueAt: null,
        target: "documents",
      }),
    );
  }

  const unlinkedReview = fileDocs.filter(
    (doc) =>
      REVIEW_DOC_STATUS.has(doc.status) &&
      !isLowValueUnlinkedPhoto(doc) &&
      !doc.linkedNeedIds?.length &&
      !items.some(
        (row) =>
          row.sourceId === doc.id ||
          (row.sourceKind === "need" &&
            doc.documentType &&
            row.title.toLowerCase() === doc.documentType.toLowerCase()),
      ),
  );
  const grouped = new Map<string, OperationalDocument[]>();
  for (const doc of unlinkedReview) {
    const key = (doc.documentType ?? "Document").toLowerCase();
    grouped.set(key, [...(grouped.get(key) ?? []), doc]);
  }
  for (const [type, docs] of grouped) {
    const label = docs[0]?.documentType ?? "Document";
    const duplicate = docs.length > 1;
    push(
      item({
        deal,
        workType: duplicate ? "document_duplicate" : "document_awaiting_review",
        rank: duplicate ? 7 : 7,
        title: label,
        reason: duplicate
          ? `${docs.length} documents received`
          : "Document awaiting processor review",
        recommendedAction: "Review",
        sourceKind: "document",
        sourceId: docs[0]!.id,
        dueState: "needs_review",
        queueSection: "needs_review",
        dueAt: null,
        target: "documents",
      }),
    );
    void type;
  }

  if (
    !submitted &&
    (deal.status === "new" || deal.assignedProcessorId == null)
  ) {
    push(
      item({
        deal,
        workType:
          deal.status === "new" ? "new_application" : "unassigned_file",
        rank: 10,
        title: deal.loanType ?? "New application",
        reason:
          deal.assignedProcessorId == null
            ? "Unassigned file"
            : "New application",
        recommendedAction: deal.assignedProcessorId == null ? "Claim" : "Open",
        sourceKind: "deal",
        sourceId: deal.id,
        dueState: "new",
        queueSection: "new",
        dueAt: null,
        target: "needs",
      }),
    );
  }

  const readiness = evaluateSubmissionReadiness({
    needs: fileNeeds.map((need) => ({
      required: need.required,
      status: need.status,
      documentType: need.documentType,
      timing: needTiming(need, fileTasks),
    })),
    tasks: fileTasks.map((task) => ({
      status: task.status,
      blockedReason: task.blockedReason ?? null,
      timing: task.timing,
      title: task.title,
      sourceType: task.sourceType,
      playbookKey: task.playbookKey,
    })),
  });
  if (
    !submitted &&
    (deal.status === "ready_for_submission" || readiness.ready)
  ) {
    push(
      item({
        deal,
        workType: "ready_to_submit",
        rank: 12,
        title: deal.loanType ?? "Submission",
        reason: "Ready to submit",
        recommendedAction: "Prepare submission",
        sourceKind: "deal",
        sourceId: `${deal.id}:ready`,
        dueState: "due_today",
        queueSection: "due_today",
        dueAt: null,
        target: "submission",
      }),
    );
  } else if (
    !submitted &&
    readiness.requiredCount > 0 &&
    readiness.satisfiedCount / readiness.requiredCount >= 0.75 &&
    readiness.blockers.length <= 2
  ) {
    push(
      item({
        deal,
        workType: "near_ready",
        rank: 12,
        title: deal.loanType ?? "Submission",
        reason: "Near-ready file",
        recommendedAction: "Prepare submission",
        sourceKind: "deal",
        sourceId: `${deal.id}:near-ready`,
        dueState: "due_today",
        queueSection: "due_today",
        dueAt: null,
        target: "submission",
      }),
    );
  }

  return items.map((row) => {
    if (row.sourceKind !== "task") {
      return row;
    }
    const sourceTask = fileTasks.find((task) => task.id === row.sourceId);
    if (!sourceTask || !isLenderCondition(sourceTask)) {
      return row;
    }
    return {
      ...row,
      reason: conditionQueueReason(row.workType),
      recommendedAction: conditionQueueAction(row.workType),
      href: hrefFor(deal.id, "conditions"),
      target: "conditions" as const,
    };
  });
}

export function collectOperationalWork(
  input: OperationalWorkInput,
): OperationalWorkItem[] {
  const now = input.now ?? new Date();
  const contacts = input.contacts ?? [];
  const mismatches = [
    ...inferDocumentMismatches(input.needs, input.documents),
    ...(input.mismatches ?? []),
  ];
  return input.deals
    .flatMap((deal) =>
      collectDealWork(
        deal,
        input.needs,
        input.documents,
        input.tasks,
        contacts,
        mismatches,
        now,
      ),
    )
    .sort((a, b) => {
      if (a.priorityRank !== b.priorityRank) {
        return a.priorityRank - b.priorityRank;
      }
      return a.borrowerName.localeCompare(b.borrowerName);
    });
}

export function groupOperationalWorkToday(
  items: OperationalWorkItem[],
): Record<QueueTodaySection, OperationalWorkItem[]> {
  const groups: Record<QueueTodaySection, OperationalWorkItem[]> = {
    urgent: [],
    due_today: [],
    needs_review: [],
    waiting: [],
    new: [],
  };
  for (const row of items) {
    groups[row.queueSection].push(row);
  }
  return groups;
}

export function hasActionableOperationalWork(
  items: OperationalWorkItem[],
): boolean {
  return items.length > 0;
}

export function isDocumentReviewWork(
  row: Pick<OperationalWorkItem, "workType">,
): boolean {
  return DOCUMENT_REVIEW_TYPES.has(row.workType);
}

export function countDocumentReviewWork(items: OperationalWorkItem[]): number {
  return items.filter(isDocumentReviewWork).length;
}

export function computeOperationalDashboardCounts(
  items: OperationalWorkItem[],
): OperationalDashboardCounts {
  const attentionItems = items.filter((row) =>
    ATTENTION_SECTIONS.has(row.queueSection),
  );
  const waitingItems = items.filter((row) => row.queueSection === "waiting");
  const reviewItems = items.filter(isDocumentReviewWork);
  const attentionDealIds = [...new Set(attentionItems.map((row) => row.dealId))];
  const readyDealIds = [
    ...new Set(
      items
        .filter((row) => row.workType === "ready_to_submit")
        .map((row) => row.dealId),
    ),
  ];

  return {
    needsAttention: attentionDealIds.length,
    waiting: waitingItems.length,
    docsToReview: reviewItems.length,
    ready: readyDealIds.length,
    attentionDealIds,
    waitingItemIds: waitingItems.map((row) => row.id),
    reviewItemIds: reviewItems.map((row) => row.id),
    readyDealIds,
  };
}

export function topWorkItemForDeal(
  items: OperationalWorkItem[],
  dealId: string,
): OperationalWorkItem | null {
  return items.find((row) => row.dealId === dealId) ?? null;
}

export function workItemMatchesFilter(
  row: OperationalWorkItem,
  filter: string,
): boolean {
  if (!filter || filter === "all") return true;
  switch (filter) {
    case "new":
      return row.queueSection === "new" || row.workType === "new_application" || row.workType === "unassigned_file";
    case "review":
    case "needs_review":
      return isDocumentReviewWork(row);
    case "missing_contact":
      return row.workType === "required_contact_missing";
    case "replacement":
      return (
        row.workType === "replacement_needed" ||
        row.workType === "replacement_received"
      );
    case "follow_up":
      return (
        row.workType === "follow_up_overdue" ||
        row.workType === "follow_up_due_today" ||
        row.workType === "waiting_beyond_cadence" ||
        row.workType === "no_initial_contact"
      );
    case "waiting":
      return row.queueSection === "waiting";
    case "escalated":
      return (
        row.workType === "escalated_task" || row.workType === "escalation_due"
      );
    case "ready":
      return (
        row.workType === "ready_to_submit" || row.workType === "near_ready"
      );
    case "attention":
      return ATTENTION_SECTIONS.has(row.queueSection);
    default:
      return true;
  }
}

export function waitingCopyForDeal(
  items: OperationalWorkItem[],
): { labels: string[]; empty: string } {
  const waiting = items.filter(
    (row) =>
      row.waitingState === "contacted_waiting" ||
      row.queueSection === "waiting",
  );
  const notRequested = items.some(
    (row) =>
      row.waitingState === "not_yet_requested" ||
      row.waitingState === "missing_contact",
  );
  const labels = [
    ...new Set(
      waiting.map((row) =>
        row.reason.startsWith("Waiting on ")
          ? row.reason.replace("Waiting on ", "")
          : row.title,
      ),
    ),
  ];
  if (labels.length > 0) {
    return { labels, empty: "" };
  }
  if (notRequested) {
    return { labels: [], empty: "No request has been sent yet." };
  }
  return { labels: [], empty: "Nobody is waiting on a reply." };
}

export { CONTACT_MISSING };
