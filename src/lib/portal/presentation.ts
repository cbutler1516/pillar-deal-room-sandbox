export type PortalNeedGroupKey =
  | "action_needed"
  | "under_review"
  | "complete"
  | "required_later";

export type PortalNeedLike = {
  id: string;
  documentType: string;
  description: string | null;
  required: boolean;
  status: string;
  timing: "required_now" | "required_later" | "optional";
  documentCount: number;
  expectedDocumentCount?: number | null;
};

export const PORTAL_NEED_GROUPS: {
  key: PortalNeedGroupKey;
  label: string;
}[] = [
  { key: "action_needed", label: "Action needed" },
  { key: "under_review", label: "Under review" },
  { key: "complete", label: "Complete" },
  { key: "required_later", label: "Needed later" },
];

export function portalNeedGroup(need: PortalNeedLike): PortalNeedGroupKey {
  if (need.status === "approved" || need.status === "waived") {
    return "complete";
  }
  if (need.timing === "required_later" && need.status !== "rejected") {
    return "required_later";
  }
  if (
    need.status === "received" ||
    need.status === "needs_review"
  ) {
    return "under_review";
  }
  return "action_needed";
}

export function portalNeedStatusLabel(status: string): string {
  if (status === "rejected") return "Replacement needed";
  if (status === "needs_review") return "Being reviewed";
  if (status === "received") return "Received";
  if (status === "approved") return "Accepted";
  if (status === "waived") return "Waived";
  if (status === "missing" || status === "requested") return "Needed";
  return "Needed";
}

export function portalNeedExplanation(need: PortalNeedLike): string {
  if (need.status === "rejected") {
    return "The previous document could not be accepted.";
  }
  if (need.status === "needs_review" || need.status === "received") {
    return "Our team is reviewing these documents.";
  }
  if (need.status === "approved") {
    return "This item is complete.";
  }
  if (need.status === "waived") {
    return "You do not need to send this.";
  }
  if (need.timing === "required_later") {
    return "You do not need to send this yet.";
  }
  return need.description?.trim() || "Please provide this document.";
}

export function portalNeedAction(need: PortalNeedLike): string | null {
  if (need.status === "rejected") {
    return "Upload replacement";
  }
  if (
    need.status === "missing" ||
    need.status === "requested"
  ) {
    if (need.timing === "required_later") {
      return null;
    }
    return "Upload document";
  }
  return null;
}

export function portalReceivedCopy(need: PortalNeedLike): string | null {
  if (need.expectedDocumentCount && need.expectedDocumentCount > 0) {
    return `${need.documentCount} of ${need.expectedDocumentCount} received`;
  }
  if (need.documentCount > 0) {
    return `${need.documentCount} received`;
  }
  return null;
}

export type PortalProgressStep =
  | "requested"
  | "received"
  | "review"
  | "ready";

export function portalProgressStep(
  needs: Array<Pick<PortalNeedLike, "required" | "status" | "timing">>,
): PortalProgressStep {
  const required = needs.filter((need) => need.required);
  if (required.length === 0) {
    return "ready";
  }
  const complete = required.every(
    (need) => need.status === "approved" || need.status === "waived",
  );
  if (complete) {
    return "ready";
  }
  const stillMissing = required.some(
    (need) =>
      need.status === "missing" ||
      need.status === "requested" ||
      need.status === "rejected",
  );
  if (stillMissing) {
    const anyIn = required.some(
      (need) => need.status === "received" || need.status === "needs_review",
    );
    return anyIn ? "received" : "requested";
  }
  return "review";
}

export const PORTAL_PROGRESS_STEPS: {
  key: PortalProgressStep;
  label: string;
}[] = [
  { key: "requested", label: "Documents requested" },
  { key: "received", label: "Documents received" },
  { key: "review", label: "Being reviewed" },
  { key: "ready", label: "Ready for next step" },
];
