import { isDemoReference } from "@/lib/demo/ids";
import { ageInDays } from "@/lib/ops/metrics";
import {
  applyPlaybookContactRequirement,
  isContactMissing,
  isEscalationDue,
  isFollowUpDue,
} from "@/lib/playbooks/logic";

export const PRIORITY_BANDS = ["critical", "high", "normal", "low"] as const;

export type PriorityBand = (typeof PRIORITY_BANDS)[number];

export type PriorityNeed = {
  dealId: string;
  required: boolean;
  status: string;
  documentType?: string | null;
  timing?: string | null;
};

export type PriorityDocument = {
  dealId: string;
  status: string;
};

export type PriorityTask = {
  dealId: string;
  status: string;
  priority?: string;
  timing?: string | null;
  taskKind?: string | null;
  sourceType?: string | null;
  playbookKey?: string | null;
  blockedReason?: string | null;
  dealContactId?: string | null;
  nextFollowUpAt?: string | null;
  lastContactedAt?: string | null;
  lastResponseAt?: string | null;
  followUpIntervalHours?: number | null;
  escalationAfterHours?: number | null;
  escalationLevel?: string | null;
  waitingSince?: string | null;
  createdAt?: string | null;
  dueAt?: string | null;
};

export type PriorityDeal = {
  id: string;
  status: string;
  assignedProcessorId: string | null;
  createdAt: string;
  dealReference?: string | null;
  fundingClose?: boolean;
};

export type PrioritySignals = {
  escalated: boolean;
  overdueReplacement: boolean;
  requiredBlockerNearFunding: boolean;
  replacementNeeded: boolean;
  missingContactRequiredNow: boolean;
  overdueFollowUp: boolean;
  documentAwaitingReview: boolean;
  newUnclaimed: boolean;
  requiredNowIncomplete: boolean;
  activeCollection: boolean;
  requiredLaterOnly: boolean;
  optionalOnly: boolean;
  noInitialContactRequiredNow: boolean;
  responseAwaitingReview: boolean;
  waitingBeyondSla: boolean;
};

export type DealPriority = {
  band: PriorityBand;
  score: number;
  label: string;
  reasons: string[];
  signals: PrioritySignals;
};

const BAND_LABEL: Record<PriorityBand, string> = {
  critical: "Critical",
  high: "High",
  normal: "Normal",
  low: "Low",
};

const OPEN_TASK = new Set(["open", "in_progress", "waiting"]);
const COMPLETE_NEED = new Set(["approved", "waived"]);
const REPLACEMENT_NEED = new Set(["rejected"]);

function dealNeeds(dealId: string, needs: PriorityNeed[]): PriorityNeed[] {
  return needs.filter((need) => need.dealId === dealId);
}

function dealTasks(dealId: string, tasks: PriorityTask[]): PriorityTask[] {
  return tasks.filter((task) => task.dealId === dealId && OPEN_TASK.has(task.status));
}

function dealDocs(dealId: string, documents: PriorityDocument[]): PriorityDocument[] {
  return documents.filter((doc) => doc.dealId === dealId);
}

function isRequiredNowNeed(need: PriorityNeed): boolean {
  if (need.timing === "required_later" || need.timing === "optional") {
    return false;
  }
  return need.required;
}

export function collectPrioritySignals(
  deal: PriorityDeal,
  needs: PriorityNeed[],
  documents: PriorityDocument[],
  tasks: PriorityTask[],
  now = new Date(),
): PrioritySignals {
  const fileNeeds = dealNeeds(deal.id, needs);
  const fileTasks = dealTasks(deal.id, tasks).map((task) =>
    applyPlaybookContactRequirement({
      id: `${deal.id}-${task.playbookKey ?? task.taskKind ?? "task"}`,
      dealId: deal.id,
      title: "",
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
      dealContactId: task.dealContactId ?? null,
      blockedReason: task.blockedReason ?? null,
    }),
  );
  const requiredNowNeeds = fileNeeds.filter(isRequiredNowNeed);
  const replacementNeeded = requiredNowNeeds.some((need) =>
    REPLACEMENT_NEED.has(need.status),
  );
  const overdueFollowUp = fileTasks.some((task) => isFollowUpDue(task, now));
  const escalated = fileTasks.some((task) => isEscalationDue(task, now));
  const missingContactRequiredNow = fileTasks.some(
    (task) => task.timing === "required_now" && isContactMissing(task),
  );
  const requiredNowIncomplete = requiredNowNeeds.some(
    (need) => !COMPLETE_NEED.has(need.status),
  );
  const documentAwaitingReview =
    dealDocs(deal.id, documents).some((doc) => doc.status === "needs_review") ||
    fileNeeds.some((need) => need.status === "needs_review" || need.status === "received");
  const overdueReplacement = replacementNeeded && (overdueFollowUp || escalated);
  const requiredBlockerNearFunding = Boolean(
    deal.fundingClose &&
      (requiredNowIncomplete || replacementNeeded || missingContactRequiredNow),
  );
  const activeCollection =
    deal.status === "collecting_documents" || deal.status === "missing_items";
  const newUnclaimed = deal.status === "new" && deal.assignedProcessorId == null;
  const hasRequiredNowWork =
    requiredNowIncomplete ||
    fileTasks.some((task) => task.timing === "required_now");
  const requiredLaterOnly =
    !hasRequiredNowWork &&
    fileTasks.some((task) => task.timing === "required_later");
  const optionalOnly =
    !hasRequiredNowWork &&
    !requiredLaterOnly &&
    fileTasks.every((task) => task.timing === "optional" || task.timing == null) &&
    fileNeeds.every((need) => !need.required);
  const noInitialContactRequiredNow = fileTasks.some(
    (task) =>
      task.timing === "required_now" &&
      !task.lastContactedAt &&
      !isContactMissing(task) &&
      (task.sourceType === "borrower" ||
        task.sourceType === "insurance" ||
        task.sourceType === "title" ||
        task.sourceType === "escrow"),
  );
  const responseAwaitingReview = fileTasks.some((task) =>
    Boolean(task.lastResponseAt),
  );
  const waitingBeyondSla = fileTasks.some(
    (task) =>
      task.status === "waiting" && (isFollowUpDue(task, now) || isEscalationDue(task, now)),
  );

  return {
    escalated,
    overdueReplacement,
    requiredBlockerNearFunding,
    replacementNeeded,
    missingContactRequiredNow,
    overdueFollowUp,
    documentAwaitingReview,
    newUnclaimed,
    requiredNowIncomplete,
    activeCollection,
    requiredLaterOnly,
    optionalOnly,
    noInitialContactRequiredNow,
    responseAwaitingReview,
    waitingBeyondSla,
  };
}

export function priorityReasons(
  signals: PrioritySignals,
  needs: PriorityNeed[] = [],
): string[] {
  const reasons: string[] = [];
  if (signals.escalated) {
    reasons.push("Escalated");
  }
  if (signals.overdueReplacement) {
    const need = needs.find(
      (item) => item.required && REPLACEMENT_NEED.has(item.status),
    );
    reasons.push(
      need?.documentType
        ? `Overdue replacement: ${need.documentType}`
        : "Overdue replacement",
    );
  } else if (signals.replacementNeeded) {
    const need = needs.find(
      (item) => item.required && REPLACEMENT_NEED.has(item.status),
    );
    reasons.push(
      need?.documentType
        ? `Replacement needed: ${need.documentType}`
        : "Replacement needed",
    );
  }
  if (signals.requiredBlockerNearFunding) {
    reasons.push("Required blocker close to funding");
  }
  if (signals.missingContactRequiredNow) {
    reasons.push("Missing contact on required-now task");
  }
  if (signals.overdueFollowUp) {
    reasons.push("Follow-up overdue");
  }
  if (signals.noInitialContactRequiredNow) {
    reasons.push("No initial contact");
  }
  if (signals.responseAwaitingReview) {
    reasons.push("Response awaiting review");
  }
  if (signals.waitingBeyondSla && !signals.overdueFollowUp) {
    reasons.push("Waiting beyond SLA");
  }
  if (signals.documentAwaitingReview) {
    reasons.push("Document awaiting review");
  }
  if (signals.newUnclaimed) {
    reasons.push("New unclaimed application");
  }
  if (signals.requiredNowIncomplete && !signals.replacementNeeded) {
    reasons.push("Required-now Need incomplete");
  }
  if (signals.activeCollection && reasons.length === 0) {
    reasons.push("Active collection");
  }
  if (signals.requiredLaterOnly) {
    reasons.push("Required later");
  }
  if (signals.optionalOnly) {
    reasons.push("Optional work only");
  }
  return reasons;
}

function bandFromSignals(
  signals: PrioritySignals,
  seededDemoStaleEscalation: boolean,
): PriorityBand {
  if (
    signals.overdueReplacement ||
    signals.requiredBlockerNearFunding ||
    (signals.escalated && !seededDemoStaleEscalation)
  ) {
    return "critical";
  }
  if (
    signals.replacementNeeded ||
    signals.missingContactRequiredNow ||
    signals.overdueFollowUp ||
    signals.documentAwaitingReview ||
    (signals.escalated && seededDemoStaleEscalation)
  ) {
    return "high";
  }
  if (
    signals.newUnclaimed ||
    signals.requiredNowIncomplete ||
    signals.activeCollection
  ) {
    return "normal";
  }
  return "low";
}

function bandBase(band: PriorityBand): number {
  if (band === "critical") return 80;
  if (band === "high") return 50;
  if (band === "normal") return 20;
  return 0;
}

export function rankDealPriority(
  deal: PriorityDeal,
  needs: PriorityNeed[],
  documents: PriorityDocument[],
  tasks: PriorityTask[],
  now = new Date(),
): DealPriority {
  const signals = collectPrioritySignals(deal, needs, documents, tasks, now);
  const fileNeeds = dealNeeds(deal.id, needs);
  const seeded = isDemoReference(deal.dealReference ?? "");
  const ageDays = ageInDays(deal.createdAt, now.getTime());
  const seededDemoStaleEscalation =
    seeded &&
    signals.escalated &&
    !signals.replacementNeeded &&
    !signals.missingContactRequiredNow &&
    !signals.overdueFollowUp &&
    !signals.documentAwaitingReview &&
    ageDays >= 3;

  const band = bandFromSignals(signals, seededDemoStaleEscalation);
  let score = bandBase(band);
  if (signals.overdueReplacement) score += 12;
  if (signals.requiredBlockerNearFunding) score += 10;
  if (signals.replacementNeeded) score += 8;
  if (signals.missingContactRequiredNow) score += 7;
  if (signals.overdueFollowUp) score += 6;
  if (signals.documentAwaitingReview) score += 5;
  if (signals.escalated && !seededDemoStaleEscalation) score += 8;
  if (signals.newUnclaimed) score += 6;
  if (signals.requiredNowIncomplete) score += 3;
  if (signals.activeCollection) score += 2;

  const freshness = Math.max(0, 14 - ageDays);
  score += freshness * 0.4;
  if (signals.newUnclaimed) {
    score += freshness * 0.6;
  }
  if (seededDemoStaleEscalation) {
    score -= 18;
  }

  const reasons = priorityReasons(signals, fileNeeds);
  return {
    band,
    score: Math.round(score * 10) / 10,
    label: BAND_LABEL[band],
    reasons: reasons.length > 0 ? reasons : ["No urgent processor work"],
    signals,
  };
}

export function compareDealPriority(a: DealPriority, b: DealPriority): number {
  const bandDelta = PRIORITY_BANDS.indexOf(a.band) - PRIORITY_BANDS.indexOf(b.band);
  if (bandDelta !== 0) {
    return bandDelta;
  }
  return b.score - a.score;
}
