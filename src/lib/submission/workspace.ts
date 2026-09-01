import { conditionSummary } from "@/lib/conditions/model";
import { formatInStaffZone, formatProperty } from "@/lib/format";
import {
  buildSubmissionBlockers,
  buildSubmissionReadyItems,
} from "@/lib/submission/blockers";
import { buildSubmissionChecklist } from "@/lib/submission/checklist";
import { buildSubmissionEmail } from "@/lib/submission/email";
import { buildSubmissionManifest } from "@/lib/submission/manifest";
import { readinessFromRows } from "@/lib/submission/readiness";
import {
  buildDealSummary,
  formatDealSummaryText,
} from "@/lib/submission/summary";

export function canMarkFileSubmitted(input: {
  ready: boolean;
  status: string;
}): boolean {
  return input.ready && input.status !== "submitted";
}

export function formatSubmittedLabel(input: {
  at: string | null;
  actorName: string | null;
}): string {
  const date = input.at ? new Date(input.at) : null;
  const valid = date && !Number.isNaN(date.getTime());
  const day = valid
    ? formatInStaffZone(date, { month: "short", day: "numeric" })
    : null;
  const time = valid
    ? formatInStaffZone(date, { hour: "numeric", minute: "2-digit" })
    : null;
  const who = input.actorName?.trim() || null;
  if (day && time && who) {
    return `Submitted ${day} at ${time} by ${who}`;
  }
  if (day && time) {
    return `Submitted ${day} at ${time}`;
  }
  if (who) {
    return `Submitted by ${who}`;
  }
  return "Submitted outside Deal Room";
}

export function buildSubmissionViewModel(input: {
  dealId: string;
  borrowerName: string;
  entityName: string | null;
  loanType: string | null;
  loanPurpose: string | null;
  loanAmount: number | null;
  propertyAddress: string | null;
  propertyCity: string | null;
  propertyState: string | null;
  propertyType: string | null;
  experience: string | null;
  creditBand: string | null;
  status: string;
  processorName: string | null;
  submittedLabel: string | null;
  intake?: unknown;
  needs: Array<{
    id: string;
    documentType: string;
    required: boolean;
    status: string;
  }>;
  documents: Array<{
    id: string;
    fileName: string;
    documentType: string | null;
    status: string;
    uploadedAt: string;
    linkedNeedIds: string[];
  }>;
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    timing?: string | null;
    blockedReason?: string | null;
    sourceType?: string | null;
    taskType?: string | null;
    playbookKey?: string | null;
    clientNeedId?: string | null;
  }>;
}) {
  const timingByNeed = new Map(
    input.tasks
      .filter((task) => task.clientNeedId)
      .map((task) => [task.clientNeedId as string, task.timing ?? null]),
  );
  const readiness = readinessFromRows({
    needs: input.needs.map((need) => ({
      id: need.id,
      required: need.required,
      status: need.status,
      documentType: need.documentType,
    })),
    tasks: input.tasks.map((task) => ({
      status: task.status,
      blockedReason: task.blockedReason ?? null,
      timing: task.timing,
      clientNeedId: task.clientNeedId,
      title: task.title,
      sourceType: task.sourceType,
      taskType: task.taskType,
      playbookKey: task.playbookKey,
    })),
  });
  const blockers = buildSubmissionBlockers({
    dealId: input.dealId,
    needs: input.needs.map((need) => ({
      ...need,
      timing: timingByNeed.get(need.id) ?? null,
    })),
    tasks: input.tasks,
  });
  const readyItems = buildSubmissionReadyItems({
    hasApplication: Boolean(input.borrowerName.trim() && input.loanType),
    needs: input.needs,
  });
  const manifest = buildSubmissionManifest({
    documents: input.documents,
    needs: input.needs,
  });
  const summary = buildDealSummary({
    borrowerName: input.borrowerName,
    entityName: input.entityName,
    loanType: input.loanType,
    loanPurpose: input.loanPurpose,
    loanAmount: input.loanAmount,
    propertyAddress: input.propertyAddress,
    propertyCity: input.propertyCity,
    propertyState: input.propertyState,
    propertyType: input.propertyType,
    experience: input.experience,
    creditBand: input.creditBand,
    intake: input.intake,
  });
  const email = buildSubmissionEmail({
    borrowerName: input.borrowerName,
    loanType: input.loanType,
    propertyAddress: input.propertyAddress,
    propertyCity: input.propertyCity,
    propertyState: input.propertyState,
    sections: summary.sections,
    manifest,
  });
  const checklist = buildSubmissionChecklist({
    borrowerName: input.borrowerName,
    loanType: input.loanType,
    needs: input.needs.map((need) => ({
      required: need.required,
      status: need.status,
      timing: timingByNeed.get(need.id) ?? null,
    })),
    tasks: input.tasks.map((task) => ({
      status: task.status,
      blockedReason: task.blockedReason ?? null,
      timing: task.timing,
      sourceType: task.sourceType,
      taskType: task.taskType,
      playbookKey: task.playbookKey,
    })),
    manifest,
  });
  const conditions = conditionSummary({
    tasks: input.tasks,
    needs: input.needs,
  });

  return {
    ready: readiness.ready,
    submitted: input.status === "submitted",
    submittedLabel: input.status === "submitted" ? input.submittedLabel : null,
    borrowerName: input.borrowerName,
    entityName: input.entityName,
    propertyLabel: [
      input.propertyAddress,
      formatProperty(input.propertyCity, input.propertyState),
    ]
      .filter((value) => value && value !== "—")
      .join(", "),
    loanType: input.loanType,
    loanAmount: input.loanAmount,
    processorName: input.processorName,
    fileStatus: input.status,
    blockerCount: blockers.length,
    blockers,
    readyItems,
    manifest,
    sections: summary.sections,
    metrics: summary.metrics,
    checklist,
    emailSubject: email.subject,
    emailBody: email.body,
    conditionSummary: {
      open: conditions.open + conditions.waiting,
      received: conditions.received,
      review: conditions.review,
      cleared: conditions.cleared,
    },
    summaryText: formatDealSummaryText(summary.sections),
    canMarkSubmitted: canMarkFileSubmitted({
      ready: readiness.ready,
      status: input.status,
    }),
  };
}
