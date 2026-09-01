import type { CommunicationAttempt } from "@/lib/communications/types";
import type {
  ActivityRow,
  ClientNeedRow,
  DealDetail,
  DocumentRow,
  TaskRow,
} from "@/lib/data/deals";
import type { AIDealSnapshot } from "@/lib/ai/types";
import type { DecoratedAction } from "@/lib/playbooks/decorate";
import { isLenderCondition } from "@/lib/conditions/model";
import { isEscalationDue, isFollowUpDue } from "@/lib/playbooks/logic";

function inferContactMissing(task: {
  contactName: string | null;
  dealContactId?: string | null;
  sourceType: string | null;
}): boolean {
  if (task.contactName || task.dealContactId) {
    return false;
  }
  if (isLenderCondition(task)) {
    return false;
  }
  return (
    task.sourceType != null &&
    task.sourceType !== "borrower" &&
    task.sourceType !== "internal"
  );
}

export function buildAIDealSnapshot(input: {
  deal: Pick<
    DealDetail,
    | "id"
    | "dealReference"
    | "borrowerName"
    | "loanType"
    | "status"
    | "assignedProcessorId"
  >;
  needs: Array<Pick<ClientNeedRow, "id" | "documentType" | "required" | "status">>;
  documents: Array<Pick<DocumentRow, "id" | "documentType" | "status">>;
  tasks: Array<
    Pick<
      TaskRow,
      | "id"
      | "title"
      | "status"
      | "sourceType"
      | "timing"
      | "clientNeedId"
      | "contactName"
      | "lastContactedAt"
      | "lastResponseAt"
      | "waitingSince"
      | "nextFollowUpAt"
    > & {
      dealContactId?: string | null;
      followUpIntervalHours?: number | null;
      escalationAfterHours?: number | null;
      escalationLevel?: string | null;
      createdAt?: string | null;
    }
  >;
  nextActions?: Array<
    Pick<DecoratedAction, "id" | "contactMissing" | "followUpDue" | "escalationDue">
  >;
  communications?: CommunicationAttempt[];
  activity?: ActivityRow[];
}): AIDealSnapshot {
  const ranked = new Map((input.nextActions ?? []).map((task) => [task.id, task]));
  return {
    dealId: input.deal.id,
    dealReference: input.deal.dealReference,
    borrowerName: input.deal.borrowerName,
    loanType: input.deal.loanType,
    status: input.deal.status,
    assignedProcessorId: input.deal.assignedProcessorId,
    needs: input.needs.map((need) => ({
      id: need.id,
      documentType: need.documentType,
      required: need.required,
      status: need.status,
    })),
    documents: input.documents.map((doc) => ({
      id: doc.id,
      documentType: doc.documentType,
      status: doc.status,
    })),
    tasks: input.tasks.map((task) => {
      const decorated = ranked.get(task.id);
      return {
        id: task.id,
        title: task.title,
        status: task.status,
        sourceType: task.sourceType,
        timing: task.timing,
        clientNeedId: task.clientNeedId,
        contactName: task.contactName,
        contactMissing: decorated?.contactMissing ?? inferContactMissing(task),
        followUpDue:
          decorated?.followUpDue ??
          isFollowUpDue({
            status: task.status,
            nextFollowUpAt: task.nextFollowUpAt,
            lastContactedAt: task.lastContactedAt,
            followUpIntervalHours: task.followUpIntervalHours ?? null,
          }),
        escalationDue:
          decorated?.escalationDue ??
          isEscalationDue({
            status: task.status,
            escalationAfterHours: task.escalationAfterHours ?? null,
            escalationLevel: task.escalationLevel ?? null,
            lastContactedAt: task.lastContactedAt,
            waitingSince: task.waitingSince,
            createdAt: task.createdAt ?? null,
          }),
        lastContactedAt: task.lastContactedAt,
        lastResponseAt: task.lastResponseAt,
        waitingSince: task.waitingSince,
        nextFollowUpAt: task.nextFollowUpAt,
      };
    }),
    communications: (input.communications ?? []).map((item) => ({
      id: item.id,
      status: item.status,
      channel: item.channel,
      direction: item.direction,
      sandboxSimulated: item.sandboxSimulated,
      outboundSent: false,
      attemptedAt: item.attemptedAt,
      draftType: item.draftType,
    })),
    activity: (input.activity ?? []).map((event) => ({
      eventType: event.eventType,
      createdAt: event.createdAt,
    })),
  };
}
