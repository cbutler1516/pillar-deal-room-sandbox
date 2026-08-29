export {
  getPlaybook,
  listPlaybooks,
  baselinePlaybookKeysForLoanType,
  baselinePlaybooksForLoanType,
} from "@/lib/playbooks/registry";
export {
  applyTaskCompletion,
  evaluateCompletionReadiness,
  instantiatePlaybook,
  isEscalationDue,
  isFollowUpDue,
  rankNextActions,
  resolveClientNeedForPlaybook,
} from "@/lib/playbooks/logic";
export type { PlaybookDefinition, SourceType, TaskKind, TaskTiming } from "@/lib/playbooks/types";
