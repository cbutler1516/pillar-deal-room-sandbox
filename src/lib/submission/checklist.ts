import { isLenderCondition } from "@/lib/conditions/model";
import { CONTACT_MISSING } from "@/lib/contacts/types";
import {
  evaluateSubmissionReadiness,
  needRequiredBeforeSubmission,
} from "@/lib/ops/workflow";
import type { SubmissionManifestItem } from "@/lib/submission/manifest";

export type ChecklistState = "complete" | "needs_attention";

export type SubmissionChecklistItem = {
  key: string;
  label: string;
  state: ChecklistState;
};

export function buildSubmissionChecklist(input: {
  borrowerName: string | null;
  loanType: string | null;
  needs: Array<{
    required: boolean;
    status: string;
    timing?: string | null;
  }>;
  tasks: Array<{
    status: string;
    blockedReason: string | null;
    timing?: string | null;
    sourceType?: string | null;
    taskType?: string | null;
    playbookKey?: string | null;
  }>;
  manifest: SubmissionManifestItem[];
}): SubmissionChecklistItem[] {
  const readiness = evaluateSubmissionReadiness({
    needs: input.needs,
    tasks: input.tasks,
  });
  const required = input.needs.filter(needRequiredBeforeSubmission);
  const reviewOpen = required.some(
    (need) => need.status === "received" || need.status === "needs_review",
  );
  const contactsMissing = input.tasks.some(
    (task) =>
      (task.status === "open" ||
        task.status === "in_progress" ||
        task.status === "waiting") &&
      task.blockedReason === CONTACT_MISSING &&
      task.timing !== "optional" &&
      task.timing !== "required_later",
  );
  const openConditions = input.tasks.some(
    (task) =>
      isLenderCondition(task) &&
      (task.status === "open" ||
        task.status === "in_progress" ||
        task.status === "waiting") &&
      task.timing !== "optional" &&
      task.timing !== "required_later",
  );
  const applicationComplete = Boolean(
    input.borrowerName?.trim() && input.loanType?.trim(),
  );
  const docsComplete =
    readiness.requiredCount > 0 &&
    readiness.satisfiedCount === readiness.requiredCount;
  const manifestReady =
    input.manifest.length > 0 || (readiness.ready && docsComplete);

  function state(ok: boolean): ChecklistState {
    return ok ? "complete" : "needs_attention";
  }

  return [
    {
      key: "application",
      label: "Application complete",
      state: state(applicationComplete),
    },
    {
      key: "documents",
      label: "Required documents complete",
      state: state(docsComplete),
    },
    {
      key: "review",
      label: "Document review complete",
      state: state(docsComplete && !reviewOpen),
    },
    {
      key: "contacts",
      label: "Required contacts present",
      state: state(!contactsMissing),
    },
    {
      key: "conditions",
      label: "Open required-now conditions resolved",
      state: state(!openConditions),
    },
    {
      key: "manifest",
      label: "Submission manifest ready",
      state: state(manifestReady),
    },
  ];
}
