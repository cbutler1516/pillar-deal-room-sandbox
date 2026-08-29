import type { DecoratedAction } from "@/lib/playbooks/decorate";

export type NextActionTarget = "tasks" | "needs" | "documents" | "contacts";

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
};

export function deriveDealNextAction(input: {
  dealId: string;
  needs: NextActionNeed[];
  documents: NextActionDocument[];
  nextActions: DecoratedAction[];
}): DealNextAction | null {
  const { dealId, needs, documents, nextActions } = input;
  const href = (tab: NextActionTarget) => `/deals/${dealId}?tab=${tab}`;

  const replacement = needs.find(
    (need) => need.required && need.status === "rejected",
  );
  if (replacement) {
    const task = nextActions.find((item) => item.clientNeedId === replacement.id);
    return {
      action: `Request replacement ${replacement.documentType} from ${
        task?.sourceType === "borrower" || !task?.sourceType
          ? "borrower"
          : task.sourceType.replaceAll("_", " ")
      }`,
      source: task?.sourceType?.replaceAll("_", " ") ?? "borrower",
      contactName: task?.contactName ?? null,
      dueAt: task?.nextFollowUpAt ?? task?.dueAt ?? null,
      href: href("needs"),
      target: "needs",
    };
  }

  const followUp = nextActions.find(
    (task) =>
      task.followUpDue &&
      !task.contactMissing &&
      (task.sourceType === "borrower" ||
        task.sourceType === "insurance" ||
        task.sourceType === "title" ||
        task.taskKind === "contact_third_party"),
  );
  if (followUp) {
    const subject =
      needs.find((need) => need.id === followUp.clientNeedId)?.documentType ??
      followUp.title.replace(/^Request\s+/i, "");
    const who = followUp.contactName ?? followUp.sourceType?.replaceAll("_", " ");
    return {
      action: who
        ? `Follow up with ${who} for ${subject.toLowerCase()}`
        : `Follow up for ${subject.toLowerCase()}`,
      source: followUp.sourceType?.replaceAll("_", " ") ?? null,
      contactName: followUp.contactName,
      dueAt: followUp.nextFollowUpAt,
      href: href("tasks"),
      target: "tasks",
    };
  }

  const reviewDoc = documents.find((doc) => doc.status === "needs_review");
  const receivedNeed = needs.find(
    (need) => need.status === "received" || need.status === "needs_review",
  );
  if (reviewDoc || receivedNeed) {
    const label =
      reviewDoc?.documentType ??
      receivedNeed?.documentType ??
      "received documents";
    return {
      action: `Review newly received ${label.toLowerCase()}`,
      source: "internal",
      contactName: null,
      dueAt: null,
      href: href("documents"),
      target: "documents",
    };
  }

  const missingContact = nextActions.find((task) => task.contactMissing);
  if (missingContact) {
    return {
      action: `Add ${
        missingContact.expectedContactType?.replaceAll("_", " ") ?? "required"
      } contact for ${missingContact.title.toLowerCase()}`,
      source: missingContact.expectedContactType ?? missingContact.sourceType,
      contactName: null,
      dueAt: missingContact.nextFollowUpAt,
      href: href("contacts"),
      target: "contacts",
    };
  }

  const first = nextActions[0];
  if (!first) {
    return null;
  }
  return {
    action: first.suggestedRequest || first.title,
    source: first.sourceType?.replaceAll("_", " ") ?? null,
    contactName: first.contactName,
    dueAt: first.nextFollowUpAt ?? first.dueAt,
    href: href("tasks"),
    target: "tasks",
  };
}
