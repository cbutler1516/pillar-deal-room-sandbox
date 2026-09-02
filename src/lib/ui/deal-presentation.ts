import { applicationIntakeFromUnknown } from "@/lib/application/intake";
import type { DealStatus } from "@/lib/data/types";

export const DEAL_PROGRESS_STAGES = [
  { key: "application", label: "Application" },
  { key: "documents", label: "Documents" },
  { key: "review", label: "Processor review" },
  { key: "ready", label: "Ready to submit" },
] as const;

export type DealProgressState = "complete" | "current" | "future";

export function dealProgressIndex(status: string): number {
  if (status === "ready_for_submission" || status === "submitted" || status === "closed") {
    return 3;
  }
  if (status === "processor_review") {
    return 2;
  }
  if (status === "collecting_documents" || status === "missing_items") {
    return 1;
  }
  return 0;
}

export function dealProgressState(
  status: string,
  stageIndex: number,
): DealProgressState {
  if (status === "submitted" || status === "closed") {
    return "complete";
  }
  const current = dealProgressIndex(status);
  if (stageIndex < current) {
    return "complete";
  }
  if (stageIndex === current) {
    return "current";
  }
  return "future";
}

export function countRequiredItemsReceived(
  needs: { required: boolean; status: string }[],
): { received: number; required: number } {
  const required = needs.filter((need) => need.required);
  const received = required.filter(
    (need) => need.status !== "missing" && need.status !== "requested",
  );
  return { received: received.length, required: required.length };
}

export function parsePositiveMoney(value: string | number | null | undefined): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  const raw = value?.trim();
  if (!raw) {
    return null;
  }
  const parsed = Number(raw.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

export function formatCompactMoney(amount: number): string {
  if (amount >= 1_000_000) {
    const millions = amount / 1_000_000;
    const rounded = Number.isInteger(millions) ? millions.toFixed(0) : millions.toFixed(1);
    return `$${rounded}M`;
  }
  if (amount >= 1_000) {
    return `$${Math.round(amount / 1_000)}K`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export type SnapshotMetric = { label: string; value: string };

export function dealSnapshotMetrics(input: {
  loanType: string | null;
  loanAmount: number | null;
  intake: unknown;
}): SnapshotMetric[] {
  const intake = applicationIntakeFromUnknown(input.intake);
  const loan = parsePositiveMoney(input.loanAmount) ?? parsePositiveMoney(intake?.requestedLoan);
  const loanType = (input.loanType ?? "").toLowerCase();
  const metrics: SnapshotMetric[] = [];

  function push(label: string, raw: string | number | null | undefined) {
    const amount = parsePositiveMoney(raw);
    if (amount == null) {
      return;
    }
    metrics.push({ label, value: formatCompactMoney(amount) });
  }

  if (loanType.includes("dscr")) {
    push("Value", intake?.currentValue);
    push("Loan", loan);
    push("Rent", intake?.monthlyRent);
    return metrics;
  }

  push("Purchase", intake?.purchasePrice);
  push("Rehab", intake?.rehabBudget);
  push("ARV", intake?.estimatedArv);
  push("Loan", loan);
  return metrics;
}

export function nextActionPresentation(input: {
  action: string;
  target: "tasks" | "needs" | "documents" | "contacts" | "conditions";
}): { context: string; cta: string } {
  const action = input.action.toLowerCase();
  if (action.includes("review replacement")) {
    return {
      context: "A replacement document has been received and needs processor review.",
      cta: "Review document",
    };
  }
  if (action.includes("request replacement") || action.includes("get replacement")) {
    return {
      context: "A required item was rejected and still needs a replacement.",
      cta: "Get replacement",
    };
  }
  if (action.includes("mismatch")) {
    return {
      context: "A linked file may not match the requested item.",
      cta: "Review document",
    };
  }
  if (action.includes("escalate") && !action.includes("follow up")) {
    return {
      context: "This request needs processor escalation.",
      cta: "Escalate",
    };
  }
  if (action.includes("review condition")) {
    return {
      context: "A lender condition has a response waiting for processor review.",
      cta: "Review condition",
    };
  }
  if (action.includes("follow up")) {
    return {
      context: "This request still needs a processor follow-up.",
      cta: "Follow up",
    };
  }
  if (action.includes("add") && action.includes("contact")) {
    return {
      context: "This work is blocked until the right contact is on the file.",
      cta: "Add contact",
    };
  }
  if (action.includes("claim")) {
    return {
      context: "This file is unassigned and waiting for a processor.",
      cta: "Claim file",
    };
  }
  if (action.includes("review reply") || action.includes("review response")) {
    return {
      context: "A reply is waiting for processor review.",
      cta: "Review reply",
    };
  }
  if (action.includes("prepare request")) {
    return {
      context: "No request has been prepared yet.",
      cta: "Prepare request",
    };
  }
  if (action.startsWith("contact ")) {
    return {
      context: "No request has been sent yet.",
      cta: "Contact",
    };
  }
  if (action.startsWith("get ") && !action.includes("replacement")) {
    return {
      context: "A required document is still missing.",
      cta: "View requirement",
    };
  }
  if (input.target === "documents" || action.includes("review")) {
    return {
      context: "A processor still has to review the file on this item.",
      cta: action.includes("reply") ? "Review reply" : "Review document",
    };
  }
  if (input.target === "conditions") {
    return {
      context: "A lender condition still needs processor attention.",
      cta: action.includes("review") ? "Review condition" : "Follow up",
    };
  }
  if (input.target === "needs") {
    return {
      context: "A required item still needs processor attention.",
      cta: "View requirement",
    };
  }
  return {
    context: "This is the highest-ranked work on the file.",
    cta: "Open",
  };
}

export function isTerminalDealStatus(status: DealStatus | string): boolean {
  return status === "submitted" || status === "closed";
}
