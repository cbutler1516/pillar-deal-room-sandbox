import {
  isLenderCondition,
} from "@/lib/conditions/model";
import { CONTACT_MISSING } from "@/lib/contacts/types";
import { needRequiredBeforeSubmission } from "@/lib/ops/workflow";

export type SubmissionBlockerTarget =
  | "needs"
  | "documents"
  | "conditions"
  | "contacts"
  | "tasks";

export type SubmissionBlocker = {
  id: string;
  title: string;
  reason: string;
  href: string;
  target: SubmissionBlockerTarget;
};

export type SubmissionReadyItem = {
  id: string;
  title: string;
  status: string;
};

function href(dealId: string, tab: SubmissionBlockerTarget): string {
  const mapped = tab === "contacts" ? "people" : tab === "tasks" ? "tasks" : tab;
  return `/deals/${dealId}?tab=${mapped}`;
}

export function buildSubmissionBlockers(input: {
  dealId: string;
  needs: Array<{
    id: string;
    documentType: string;
    required: boolean;
    status: string;
    timing?: string | null;
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
}): SubmissionBlocker[] {
  const rows: SubmissionBlocker[] = [];

  for (const need of input.needs) {
    if (!needRequiredBeforeSubmission(need)) {
      continue;
    }
    if (need.status === "approved" || need.status === "waived") {
      continue;
    }
    if (need.status === "rejected") {
      rows.push({
        id: `need:${need.id}`,
        title: need.documentType,
        reason: "Replacement still needed",
        href: href(input.dealId, "needs"),
        target: "needs",
      });
      continue;
    }
    if (need.status === "received" || need.status === "needs_review") {
      rows.push({
        id: `need:${need.id}`,
        title: need.documentType,
        reason: "Document awaiting review",
        href: href(input.dealId, "documents"),
        target: "documents",
      });
      continue;
    }
    rows.push({
      id: `need:${need.id}`,
      title: need.documentType,
      reason: "Required document missing",
      href: href(input.dealId, "needs"),
      target: "needs",
    });
  }

  for (const task of input.tasks) {
    const open =
      task.status === "open" ||
      task.status === "in_progress" ||
      task.status === "waiting";
    if (!open) {
      continue;
    }
    if (task.blockedReason === CONTACT_MISSING) {
      rows.push({
        id: `contact:${task.id}`,
        title: task.title.replace(/^Request\s+/i, "") || "Required contact",
        reason: "Contact information missing",
        href: href(input.dealId, "contacts"),
        target: "contacts",
      });
    }
    if (
      isLenderCondition(task) &&
      task.timing !== "optional" &&
      task.timing !== "required_later"
    ) {
      rows.push({
        id: `condition:${task.id}`,
        title: task.title,
        reason: "Open lender condition",
        href: href(input.dealId, "conditions"),
        target: "conditions",
      });
    }
  }

  return rows;
}

export function buildSubmissionReadyItems(input: {
  needs: Array<{ id: string; documentType: string; status: string; required: boolean }>;
  hasApplication: boolean;
}): SubmissionReadyItem[] {
  const rows: SubmissionReadyItem[] = [];
  if (input.hasApplication) {
    rows.push({
      id: "application",
      title: "Borrower application",
      status: "Complete",
    });
  }
  for (const need of input.needs) {
    if (need.status === "approved") {
      rows.push({
        id: need.id,
        title: need.documentType,
        status: "Approved",
      });
    } else if (need.status === "waived") {
      rows.push({
        id: need.id,
        title: need.documentType,
        status: "Waived",
      });
    }
  }
  return rows;
}
