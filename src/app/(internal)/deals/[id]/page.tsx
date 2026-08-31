import { EmptyState } from "@/components/empty-state";
import { ClientNeedsWorkspace } from "@/components/client-need-workspace";
import { DocumentIntakePanel } from "@/components/document-intake-panel";
import { DocumentsWorkspace } from "@/components/documents-workspace";
import { ContactsWorkspace } from "@/components/contacts-workspace";
import { CommunicationTimeline } from "@/components/communication-timeline";
import { TaskWorkspace } from "@/components/task-workspace";
import { listCommunications, listActiveStaff } from "@/lib/communications/data";
import {
  DealOverview,
  DealTabNav,
  DealWorkspaceHeader,
  parseDealTab,
} from "@/components/deal-workspace";
import { canMutateDealContacts } from "@/lib/contacts/authorization";
import {
  ClaimButton,
  DealStatusControl,
  UnclaimButton,
} from "@/components/workflow-controls";
import { StatusChip } from "@/components/status-chip";
import { SurfaceCard } from "@/components/ui/surface-card";
import { pageWidthClass } from "@/components/ui/styles";
import { requireInternalUser } from "@/lib/auth/session";
import { canUseDocumentIntake } from "@/lib/documents/authorization";
import { canCreateProcessorTask } from "@/lib/playbooks/authorization";
import {
  baselinePlaybookKeysForLoanType,
  listPlaybooks,
} from "@/lib/playbooks/registry";
import {
  getDealById,
  listActivity,
  listClientNeeds,
  listDealContacts,
  listDocuments,
  listStaffNames,
  listTasks,
  staffDisplayName,
} from "@/lib/data/deals";
import { getDocumentStorageProviderName } from "@/lib/documents/config";
import { formatActivityDisplay } from "@/lib/ops/activity-display";
import { canMutateWorkflow, canClaimDeal, canUnclaimDeal, isDealOwnedByUser } from "@/lib/ops/workflow";
import { decorateRankedActions } from "@/lib/playbooks/decorate";

export default async function DealDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const tab = parseDealTab(typeof query.tab === "string" ? query.tab : undefined);
  const { supabase, user, profile } = await requireInternalUser();
  const deal = await getDealById(supabase, id);

  if (!deal) {
    return (
      <div className="mx-auto max-w-4xl">
        <EmptyState
          title="Deal not found"
          description="This deal does not exist, or your role cannot access it."
        />
      </div>
    );
  }

  const [needs, documents, tasks, contacts, activity, attempts, activeStaff] =
    await Promise.all([
      listClientNeeds(supabase, deal.id),
      listDocuments(supabase, deal.id),
      listTasks(supabase, deal.id),
      listDealContacts(supabase, deal.id),
      listActivity(supabase, deal.id),
      listCommunications(supabase, deal.id),
      listActiveStaff(supabase),
    ]);

  const canMutate = canMutateWorkflow(profile.role);
  const canEditTasks = canCreateProcessorTask({
    role: profile.role,
    userId: user.id,
    dealAssignedProcessorId: deal.assignedProcessorId,
  });
  const canEditContacts = canMutateDealContacts({
    role: profile.role,
    userId: user.id,
    dealAssignedProcessorId: deal.assignedProcessorId,
  });
  const canIntake = canUseDocumentIntake(
    deal.assignedProcessorId,
    user.id,
    profile.role,
  );
  const nextActions = decorateRankedActions(
    tasks,
    [deal],
    contacts,
    needs,
  );
  const staff = await listStaffNames(supabase, [
    deal.assignedProcessorId ?? "",
    ...activity.map((event) => event.actorId ?? ""),
    ...tasks.map((task) => task.assignedTo ?? ""),
    ...activeStaff.map((person) => person.id),
  ]);
  const staffNames = Object.fromEntries(
    [...staff, ...activeStaff].map((person) => [person.id, staffDisplayName(person)]),
  );
  const assignedStaff = staff.find((person) => person.id === deal.assignedProcessorId);
  const ownedByCurrentUser = isDealOwnedByUser(deal.assignedProcessorId, user.id);
  const processorLabel = ownedByCurrentUser
    ? "Assigned to you"
    : assignedStaff
      ? staffDisplayName(assignedStaff)
      : deal.assignedProcessorId
        ? "Assigned processor"
        : "Unassigned";
  const sandboxMock = getDocumentStorageProviderName() === "sandbox_mock";

  return (
    <div className={`${pageWidthClass} space-y-5`}>
      <div className="sticky top-14 z-10 space-y-4 bg-workspace/95 pb-1 backdrop-blur">
        <DealWorkspaceHeader
          deal={deal}
          processorLabel={processorLabel}
          actions={
            <>
              <StatusChip status={deal.status} />
              {canMutate &&
              canClaimDeal(deal.assignedProcessorId, user.id, profile.role) ? (
                <ClaimButton dealId={deal.id} />
              ) : null}
              {ownedByCurrentUser ? (
                <span className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink">
                  Assigned to you
                </span>
              ) : null}
              {canMutate &&
              canUnclaimDeal(deal.assignedProcessorId, user.id, profile.role) ? (
                <UnclaimButton dealId={deal.id} />
              ) : null}
              {canMutate ? (
                <DealStatusControl dealId={deal.id} status={deal.status} />
              ) : null}
            </>
          }
        />

        <DealTabNav dealId={deal.id} tab={tab} />
      </div>

      {tab === "overview" ? (
        <DealOverview
          deal={deal}
          needs={needs}
          documents={documents}
          tasks={tasks}
          nextActions={nextActions}
          attempts={attempts}
          intake={
            deal.applicationIntake ??
            activity.find((event) => event.eventType === "application_received")
              ?.safeMetadata ??
            null
          }
        />
      ) : null}

      {tab === "tasks" ? (
        <SurfaceCard>
          <TaskWorkspace
            dealId={deal.id}
            loanType={deal.loanType}
            dealContext={{
              borrowerName: deal.borrowerName,
              entityName: deal.entityName,
              propertyAddress: deal.propertyAddress,
              propertyCity: deal.propertyCity,
              propertyState: deal.propertyState,
              loanType: deal.loanType,
              dealReference: deal.dealReference,
            }}
            tasks={tasks}
            contacts={contacts}
            needs={needs.map((need) => ({
              id: need.id,
              documentType: need.documentType,
              expectedDocumentCount: need.expectedDocumentCount,
            }))}
            playbooks={listPlaybooks().map((playbook) => ({
              playbookKey: playbook.playbookKey,
              title: playbook.title,
              sourceType: playbook.sourceType,
              taskKind: playbook.taskKind,
              timing: playbook.timing,
            }))}
            canMutate={canEditTasks}
            canGenerateBaseline={
              canEditTasks &&
              baselinePlaybookKeysForLoanType(deal.loanType ?? "").length > 0
            }
            attempts={attempts}
            staffNames={staffNames}
            replacementNeedIds={needs
              .filter((need) => need.required && need.status === "rejected")
              .map((need) => need.id)}
          />
        </SurfaceCard>
      ) : null}

      {tab === "needs" ? (
        <SurfaceCard>
          <ClientNeedsWorkspace
            dealId={deal.id}
            needs={needs}
            documents={documents}
            canMutate={canMutate}
            canIntake={canIntake}
            needOps={needs.map((need) => {
              const task = tasks.find((item) => item.clientNeedId === need.id);
              const action = nextActions.find((item) => item.id === task?.id);
              return {
                needId: need.id,
                timing: task?.timing ?? null,
                sourceType: task?.sourceType ?? null,
                nextAction: task?.title ?? null,
                contactMissing: Boolean(action?.contactMissing),
              };
            })}
          />
        </SurfaceCard>
      ) : null}

      {tab === "documents" ? (
        <div className="space-y-4">
          {canIntake ? (
            <DocumentIntakePanel
              dealId={deal.id}
              sandboxMock={sandboxMock}
              needs={needs.map((need) => ({
                id: need.id,
                documentType: need.documentType,
                status: need.status,
              }))}
            />
          ) : null}
          <SurfaceCard>
            <DocumentsWorkspace
              dealId={deal.id}
              documents={documents}
              needs={needs}
              canMutate={canMutate}
              canIntake={canIntake}
            />
          </SurfaceCard>
        </div>
      ) : null}

      {tab === "contacts" ? (
        <SurfaceCard>
          <ContactsWorkspace
            dealId={deal.id}
            contacts={contacts}
            canMutate={canEditContacts}
            missingContactTypes={[
              ...new Set(
                nextActions
                  .filter(
                    (action) =>
                      action.contactMissing && Boolean(action.expectedContactType),
                  )
                  .map((action) => action.expectedContactType as string),
              ),
            ]}
          />
        </SurfaceCard>
      ) : null}

      {tab === "activity" ? (
        <div className="space-y-4">
          <SurfaceCard>
            <CommunicationTimeline attempts={attempts} />
          </SurfaceCard>
          <SurfaceCard>
            {activity.length === 0 ? (
              <p className="text-sm text-ink-muted">
                No operational events on this file yet.
              </p>
            ) : (
              <ol>
                {activity.map((event) => {
                  const display = formatActivityDisplay(event, staffNames);
                  return (
                    <li
                      key={event.id}
                      className="border-t border-line py-2.5 first:border-0"
                    >
                      <p className="text-sm font-medium text-ink">{display.who}</p>
                      <p className="text-sm text-ink">
                        {display.didWhat}
                        {display.toWhat ? ` ${display.toWhat}` : ""}
                      </p>
                      <p className="mt-0.5 text-[11px] text-ink-muted">{display.when}</p>
                    </li>
                  );
                })}
              </ol>
            )}
          </SurfaceCard>
        </div>
      ) : null}
    </div>
  );
}
