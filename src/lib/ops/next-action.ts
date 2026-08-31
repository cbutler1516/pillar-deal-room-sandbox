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

  const requestTask = (
    task: (typeof nextActions)[number],
  ) =>
    !task.contactMissing &&
    (task.sourceType === "borrower" ||
      task.sourceType === "insurance" ||
      task.sourceType === "title" ||
      task.sourceType === "escrow" ||
      task.taskKind === "contact_third_party");

  const subjectFor = (task: (typeof nextActions)[number]) =>
    needs.find((need) => need.id === task.clientNeedId)?.documentType ??
    task.title.replace(/^Request\s+/i, "");

  const escalate = nextActions.find(
    (task) => task.escalationDue && requestTask(task),
  );
  if (escalate) {
    const subject = subjectFor(escalate);
    const who = escalate.contactName ?? escalate.sourceType?.replaceAll("_", " ");
    return {
      action: who
        ? `Escalate ${subject.toLowerCase()} with ${who}`
        : `Escalate follow-up for ${subject.toLowerCase()}`,
      source: escalate.sourceType?.replaceAll("_", " ") ?? null,
      contactName: escalate.contactName,
      dueAt: escalate.nextFollowUpAt,
      href: href("tasks"),
      target: "tasks",
    };
  }

  const followUp = nextActions.find(
    (task) => task.followUpDue && requestTask(task),
  );
  if (followUp) {
    const subject = subjectFor(followUp);
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

  const reviewResponse = nextActions.find(
    (task) => Boolean(task.lastResponseAt) && requestTask(task),
  );
  if (reviewResponse) {
    const subject = subjectFor(reviewResponse);
    const who =
      reviewResponse.contactName ??
      reviewResponse.sourceType?.replaceAll("_", " ");
    return {
      action: who
        ? `Review response from ${who} for ${subject.toLowerCase()}`
        : `Review response for ${subject.toLowerCase()}`,
      source: reviewResponse.sourceType?.replaceAll("_", " ") ?? null,
      contactName: reviewResponse.contactName,
      dueAt: reviewResponse.nextFollowUpAt,
      href: href("tasks"),
      target: "tasks",
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

  const initial = nextActions.find(
    (task) => !task.lastContactedAt && requestTask(task),
  );
  if (initial) {
    const subject = subjectFor(initial);
    const who = initial.contactName ?? initial.sourceType?.replaceAll("_", " ");
    return {
      action: who
        ? `Send initial request to ${who} for ${subject.toLowerCase()}`
        : `Send initial request for ${subject.toLowerCase()}`,
      source: initial.sourceType?.replaceAll("_", " ") ?? null,
      contactName: initial.contactName,
      dueAt: initial.nextFollowUpAt ?? initial.dueAt,
      href: href("tasks"),
      target: "tasks",
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
