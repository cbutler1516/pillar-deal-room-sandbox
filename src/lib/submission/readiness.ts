import { evaluateSubmissionReadiness, type SubmissionReadiness } from "@/lib/ops/workflow";

export function readinessFromRows(input: {
  needs: Array<{
    id: string;
    required: boolean;
    status: string;
    documentType?: string | null;
  }>;
  tasks: Array<{
    status: string;
    blockedReason: string | null;
    timing?: string | null;
    clientNeedId?: string | null;
    title?: string | null;
    sourceType?: string | null;
    taskType?: string | null;
    playbookKey?: string | null;
  }>;
}): SubmissionReadiness {
  const timingByNeed = new Map(
    input.tasks
      .filter((task) => task.clientNeedId)
      .map((task) => [task.clientNeedId as string, task.timing ?? null]),
  );
  return evaluateSubmissionReadiness({
    needs: input.needs.map((need) => ({
      required: need.required,
      status: need.status,
      documentType: need.documentType,
      timing: timingByNeed.get(need.id) ?? null,
    })),
    tasks: input.tasks.map((task) => ({
      status: task.status,
      blockedReason: task.blockedReason,
      timing: task.timing,
      title: task.title,
      sourceType: task.sourceType,
      taskType: task.taskType,
      playbookKey: task.playbookKey,
    })),
  });
}
