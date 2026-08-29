import { addContactLabel } from "@/lib/contacts/logic";
import type { DealContactRow, TaskRow } from "@/lib/data/deals";
import { getPlaybook } from "@/lib/playbooks/registry";
import {
  applyPlaybookContactRequirement,
  rankNextActions,
  summarizeInstructions,
  type RankedNextAction,
} from "@/lib/playbooks/logic";
import {
  renderRequestTemplate,
  requestSummaryFromTemplate,
  templateContextFromDeal,
} from "@/lib/playbooks/templates";

export type DealLookup = {
  id: string;
  borrowerName: string;
  entityName?: string | null;
  dealReference: string;
  propertyAddress?: string | null;
  propertyCity?: string | null;
  propertyState?: string | null;
  loanType?: string | null;
  assignedProcessorId?: string | null;
};

export type DecoratedAction = RankedNextAction & {
  borrowerName: string;
  entityName: string | null;
  dealReference: string;
  propertyAddress: string | null;
  contactName: string | null;
  contactCompany: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  suggestedRequest: string;
};

export function decorateRankedActions(
  tasks: TaskRow[],
  deals: DealLookup[],
  contacts: DealContactRow[],
  now = new Date(),
): DecoratedAction[] {
  return rankNextActions(tasks, now).map((task) =>
    decorateRankedAction(task, deals, contacts),
  );
}

export function decorateBoardTasks(
  tasks: TaskRow[],
  deals: DealLookup[],
  contacts: DealContactRow[],
  now = new Date(),
): DecoratedAction[] {
  const active = decorateRankedActions(tasks, deals, contacts, now);
  const done = tasks
    .filter((task) => task.status === "completed")
    .map((task) => {
      const decorated = applyPlaybookContactRequirement(task);
      return decorateRankedAction(
        {
          ...decorated,
          rank: 99,
          band: "optional",
          followUpDue: false,
          escalationDue: false,
          overdue: false,
          contactMissing: false,
          waitingAgeHours: null,
          instructionsSummary: summarizeInstructions(task.instructions),
        },
        deals,
        contacts,
      );
    });
  return [...active, ...done];
}

export function decorateRankedAction(
  task: RankedNextAction,
  deals: DealLookup[],
  contacts: DealContactRow[],
): DecoratedAction {
  const deal = deals.find((item) => item.id === task.dealId);
  const contact = contacts.find((item) => item.id === task.dealContactId);
  const playbook = task.playbookKey ? getPlaybook(task.playbookKey) : null;
  const suggested = requestSummaryFromTemplate(
    renderRequestTemplate(
      playbook?.requestSummary ?? playbook?.requestTemplate,
      templateContextFromDeal({
        borrowerName: deal?.borrowerName,
        entityName: deal?.entityName,
        propertyAddress: deal?.propertyAddress,
        propertyCity: deal?.propertyCity,
        propertyState: deal?.propertyState,
        loanType: deal?.loanType,
        dealReference: deal?.dealReference,
        contactName: contact?.name ?? task.contactName ?? null,
      }),
    ),
  );
  return {
    ...task,
    borrowerName: deal?.borrowerName ?? "Unknown deal",
    entityName: deal?.entityName ?? null,
    dealReference: deal?.dealReference ?? "",
    propertyAddress: deal?.propertyAddress ?? null,
    contactName: contact?.name ?? task.contactName ?? null,
    contactCompany: contact?.company ?? null,
    contactEmail: contact?.email ?? task.contactEmail ?? null,
    contactPhone: contact?.phone ?? task.contactPhone ?? null,
    suggestedRequest: task.contactMissing
      ? addContactLabel(task.expectedContactType)
      : suggested,
  };
}
