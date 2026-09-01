import type { ReactNode } from "react";
import { StatusChip } from "@/components/status-chip";
import { TabList } from "@/components/ui/controls";
import { StaffAvatar } from "@/components/ui/staff-avatar";
import { CardHeader, SurfaceCard } from "@/components/ui/surface-card";
import { buttonClass } from "@/components/ui/button";
import { labelClass, surfaceClass } from "@/components/ui/styles";
import {
  applicationIntakeFromUnknown,
  intakeDisplayGroups,
} from "@/lib/application/intake";
import { CommunicationTimeline } from "@/components/communication-timeline";
import type { CommunicationAttempt } from "@/lib/communications/types";
import type { ClientNeedRow, DealDetail, DocumentRow, TaskRow } from "@/lib/data/deals";
import { formatCurrency, formatFollowUpAt, formatProperty } from "@/lib/format";
import {
  deriveDealNextAction,
  type NextActionMismatch,
} from "@/lib/ops/next-action";
import {
  collectOperationalWork,
  countDocumentReviewWork,
  waitingCopyForDeal,
} from "@/lib/ops/operational-work";
import { evaluateSubmissionReadiness } from "@/lib/ops/workflow";
import type { DecoratedAction } from "@/lib/playbooks/decorate";
import {
  DEAL_PROGRESS_STAGES,
  countRequiredItemsReceived,
  dealProgressState,
  dealSnapshotMetrics,
  nextActionPresentation,
} from "@/lib/ui/deal-presentation";

export const DEAL_TABS = [
  "overview",
  "tasks",
  "needs",
  "documents",
  "contacts",
  "activity",
] as const;

export type DealTab = (typeof DEAL_TABS)[number];

const TAB_ALIASES: Record<string, DealTab> = {
  people: "contacts",
  timeline: "activity",
};

export function parseDealTab(value: string | undefined): DealTab {
  const mapped = value ? (TAB_ALIASES[value] ?? value) : "overview";
  return DEAL_TABS.includes(mapped as DealTab) ? (mapped as DealTab) : "overview";
}

export function DealWorkspaceHeader({
  deal,
  actions,
  ownerName,
}: {
  deal: DealDetail;
  actions: ReactNode;
  processorLabel?: string;
  ownerName?: string | null;
}) {
  const cityState = formatProperty(deal.propertyCity, deal.propertyState);
  const locationLine = [deal.loanType, cityState !== "—" ? cityState : null]
    .filter(Boolean)
    .join(" · ");
  const unassigned = !ownerName;
  const loanAmount = formatCurrency(deal.loanAmount);

  return (
    <div className="grid items-start gap-6 border-b border-line pb-6 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
      <div className="min-w-0">
        <p className={labelClass}>{deal.dealReference}</p>
        <h2 className="mt-1 text-[2rem] leading-tight font-semibold tracking-tight text-ink uppercase">
          {deal.borrowerName}
        </h2>
        {deal.entityName ? (
          <p className="mt-2 text-sm text-ink">{deal.entityName}</p>
        ) : null}
        {locationLine ? (
          <p className="mt-1 text-sm text-ink-muted">{locationLine}</p>
        ) : null}
        {deal.propertyAddress ? (
          <p className="mt-3 text-sm leading-6 text-ink">
            {deal.propertyAddress}
            {cityState !== "—" ? (
              <>
                <br />
                {cityState}
              </>
            ) : null}
          </p>
        ) : null}
      </div>

      {loanAmount !== "—" ? (
        <div className="min-w-[8rem]">
          <p className="text-[1.75rem] leading-none font-semibold tracking-tight tabular-nums text-ink">
            {loanAmount}
          </p>
          <p className="mt-1.5 text-[11px] text-ink-muted">Loan request</p>
        </div>
      ) : null}

      <div className="flex flex-col items-start gap-3 lg:items-end">
        <div className="flex items-center gap-2.5">
          <StaffAvatar name={ownerName} unassigned={unassigned} size={32} />
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink">
              {unassigned ? "Unassigned" : ownerName}
            </p>
            <p className="text-[11px] text-ink-muted">Processor</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <StatusChip status={deal.status} />
          {actions}
        </div>
      </div>
    </div>
  );
}

function ApplicationIntakeCard({
  intake,
  loanType,
}: {
  intake: unknown;
  loanType: string | null;
}) {
  const structured = applicationIntakeFromUnknown(intake);
  if (!structured) {
    return null;
  }
  const groups = intakeDisplayGroups(structured, loanType);
  if (groups.length === 0) {
    return null;
  }
  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <div key={group.title}>
          {groups.length > 1 ? (
            <h3 className="mb-3 text-xs font-semibold tracking-wide text-ink-muted uppercase">
              {group.title}
            </h3>
          ) : null}
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {group.rows.map((row) => (
              <HeaderItem key={row.key} label={row.label} value={row.value} />
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}

function HeaderItem({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div>
      <dt className="text-[11px] text-ink-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{value || "—"}</dd>
    </div>
  );
}

function DealProgressStrip({
  status,
  received,
  reviewCount,
}: {
  status: string;
  received: { received: number; required: number };
  reviewCount: number;
}) {
  const ratio =
    received.required > 0
      ? Math.min(100, Math.round((received.received / received.required) * 100))
      : 0;

  return (
    <section>
      <ol className="relative grid grid-cols-4 gap-2">
        <span
          aria-hidden
          className="absolute top-[7px] right-4 left-4 h-px bg-line"
        />
        {DEAL_PROGRESS_STAGES.map((stage, index) => {
          const state = dealProgressState(status, index);
          const tone =
            state === "future"
              ? "border-line bg-surface text-ink-muted"
              : "border-pillar-teal bg-pillar-teal text-white";
          return (
            <li key={stage.key} className="relative flex flex-col items-center">
              <span
                className={`relative z-10 h-3.5 w-3.5 rounded-full border ${tone}`}
                aria-current={state === "current" ? "step" : undefined}
              />
              <span
                className={`mt-2 text-center text-[11px] leading-4 ${
                  state === "future" ? "text-ink-muted" : "text-ink"
                }`}
              >
                {stage.label}
              </span>
            </li>
          );
        })}
      </ol>
      {received.required > 0 ? (
        <div className="mt-4">
          <p className="text-xs text-ink-muted">
            {received.received} of {received.required} required items received
            {reviewCount > 0
              ? ` · ${reviewCount} still need review`
              : ""}
          </p>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-line">
            <div
              className="h-1 rounded-full bg-pillar-teal/70 transition-[width] duration-200 motion-reduce:transition-none"
              style={{ width: `${ratio}%` }}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function DealOverview({
  deal,
  needs,
  documents,
  nextActions,
  intake = null,
  attempts = [],
  mismatches = [],
  assist = null,
}: {
  deal: DealDetail;
  needs: ClientNeedRow[];
  documents: DocumentRow[];
  tasks?: TaskRow[];
  nextActions: DecoratedAction[];
  intake?: unknown;
  attempts?: CommunicationAttempt[];
  mismatches?: NextActionMismatch[];
  assist?: ReactNode;
}) {
  const requiredNow = nextActions.filter((task) => task.timing === "required_now").length;
  const followUps = nextActions.filter((task) => task.followUpDue).length;
  const escalations = nextActions.filter((task) => task.escalationDue).length;
  const missingContacts = nextActions.filter((task) => task.contactMissing).length;
  const blockers = nextActions.filter(
    (task) =>
      task.contactMissing ||
      task.escalationDue ||
      task.band === "required_now_blocked" ||
      task.overdue,
  );
  const rejectedNeeds = needs.filter((need) => need.status === "rejected");
  const timingByNeed = new Map(
    nextActions
      .filter((task) => task.clientNeedId)
      .map((task) => [task.clientNeedId as string, task.timing]),
  );
  const readiness = evaluateSubmissionReadiness({
    needs: needs.map((need) => ({
      required: need.required,
      status: need.status,
      documentType: need.documentType,
      timing: timingByNeed.get(need.id) ?? null,
    })),
    tasks: nextActions.map((task) => ({
      status: task.status,
      blockedReason: task.blockedReason ?? null,
      timing: task.timing,
    })),
  });
  const nextAction = deriveDealNextAction({
    dealId: deal.id,
    needs,
    documents: documents.map((doc) => ({
      id: doc.id,
      documentType: doc.documentType,
      status: doc.status,
      fileName: doc.fileName,
      mimeType: doc.mimeType,
      linkedNeedIds: doc.linkedNeedIds,
    })),
    nextActions,
    mismatches,
    deal: {
      id: deal.id,
      dealReference: deal.dealReference,
      borrowerName: deal.borrowerName,
      entityName: deal.entityName,
      loanType: deal.loanType,
      status: deal.status,
      assignedProcessorId: deal.assignedProcessorId,
    },
  });
  const resolvedIntake = intake ?? deal.applicationIntake;
  const dealWork = collectOperationalWork({
    deals: [
      {
        id: deal.id,
        dealReference: deal.dealReference,
        borrowerName: deal.borrowerName,
        entityName: deal.entityName,
        loanType: deal.loanType,
        status: deal.status,
        assignedProcessorId: deal.assignedProcessorId,
      },
    ],
    needs: needs.map((need) => ({
      id: need.id,
      dealId: deal.id,
      documentType: need.documentType,
      required: need.required,
      status: need.status,
    })),
    documents: documents.map((doc) => ({
      id: doc.id,
      dealId: deal.id,
      documentType: doc.documentType,
      status: doc.status,
      fileName: doc.fileName,
      mimeType: doc.mimeType,
      linkedNeedIds: doc.linkedNeedIds,
    })),
    tasks: nextActions,
    mismatches: mismatches.map((row) => ({ ...row, dealId: deal.id })),
  });
  const waitingOn = waitingCopyForDeal(dealWork);
  const reviewCount = countDocumentReviewWork(dealWork);
  const received = countRequiredItemsReceived(needs);
  const snapshot = dealSnapshotMetrics({
    loanType: deal.loanType,
    loanAmount: deal.loanAmount,
    intake: resolvedIntake,
  });
  const presentation = nextAction
    ? nextActionPresentation({
        action: nextAction.action,
        target: nextAction.target,
      })
    : null;

  return (
    <div className="space-y-8">
      <DealProgressStrip status={deal.status} received={received} reviewCount={reviewCount} />

      {nextAction && presentation ? (
        <section
          className={`${surfaceClass("elevated")} border-l-2 border-l-pillar-teal px-5 py-5`}
        >
          <p className="text-[11px] font-semibold tracking-[0.08em] text-ink-muted uppercase">
            Next action
          </p>
          <h3 className="mt-2 text-xl font-semibold tracking-tight text-ink">
            {nextAction.action}
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">
            {presentation.context}
            {nextAction.dueAt
              ? ` Follow-up ${formatFollowUpAt(nextAction.dueAt)}.`
              : ""}
          </p>
          <a href={nextAction.href} className={`${buttonClass("accent")} mt-5`}>
            {presentation.cta} →
          </a>
        </section>
      ) : (
        <section className={`${surfaceClass("card")} px-5 py-5`}>
          <p className="text-[11px] font-semibold tracking-[0.08em] text-ink-muted uppercase">
            Next action
          </p>
          <p className="mt-2 text-sm leading-6 text-ink-muted">
            Nothing needs your attention.
          </p>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <SurfaceCard>
          <CardHeader title="Current blockers" />
          {blockers.length === 0 && rejectedNeeds.length === 0 ? (
            <p className="text-sm text-ink-muted">Nothing is blocking this file.</p>
          ) : (
            <ul className="space-y-2">
              {rejectedNeeds.map((need) => (
                <li key={need.id} className="text-sm text-danger">
                  Replacement {need.documentType} needed
                </li>
              ))}
              {blockers.slice(0, 6).map((task) => (
                <li key={task.id} className="text-sm text-ink">
                  {task.title}
                  <span className="mt-0.5 block text-xs text-ink-muted">
                    {task.contactMissing
                      ? "Contact missing"
                      : task.escalationDue
                        ? "Follow-up overdue"
                        : task.overdue
                          ? "Overdue"
                          : "Blocked"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SurfaceCard>

        <SurfaceCard>
          <CardHeader title="Waiting on" />
          {waitingOn.labels.length === 0 ? (
            <p className="text-sm leading-6 text-ink-muted">{waitingOn.empty}</p>
          ) : (
            <ul className="space-y-2">
              {waitingOn.labels.map((label) => (
                <li key={label} className="text-sm text-ink">
                  {label}
                </li>
              ))}
            </ul>
          )}
        </SurfaceCard>
      </div>

      {snapshot.length > 0 ? (
        <section>
          <h3 className="text-[11px] font-semibold tracking-[0.08em] text-ink-muted uppercase">
            Deal snapshot
          </h3>
          <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-4">
            {snapshot.map((row) => (
              <div key={row.label}>
                <dt className="text-[11px] text-ink-muted">{row.label}</dt>
                <dd className="mt-1 text-[1.75rem] leading-none font-semibold tracking-tight tabular-nums text-ink">
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {assist}

      <details className="group rounded-[14px] border border-line bg-surface px-5 py-4">
        <summary className="cursor-pointer text-sm font-semibold text-ink">
          File details
        </summary>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <HeaderItem label="Purpose" value={deal.loanPurpose} />
          <HeaderItem label="Credit" value={deal.creditBand} />
          <HeaderItem label="Experience" value={deal.experience} />
          <HeaderItem
            label="Required now"
            value={String(requiredNow)}
          />
          <HeaderItem label="Missing contacts" value={String(missingContacts)} />
          <HeaderItem label="Follow-ups overdue" value={String(followUps)} />
          <HeaderItem label="Escalations" value={String(escalations)} />
          <HeaderItem
            label="Submission"
            value={
              readiness.requiredCount > 0
                ? `${readiness.satisfiedCount} of ${readiness.requiredCount} ready`
                : "No required items"
            }
          />
        </dl>
        {readiness.attention.length > 0 ? (
          <ul className="mt-4 space-y-1">
            {readiness.attention.map((item) => (
              <li key={`${item.kind}-${item.label}`} className="text-sm text-danger">
                {item.label}
              </li>
            ))}
          </ul>
        ) : null}
      </details>

      {resolvedIntake ? (
        <details className="group rounded-[14px] border border-line bg-surface">
          <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-ink">
            Application intake
          </summary>
          <div className="border-t border-line px-5 py-4">
            <ApplicationIntakeCard intake={resolvedIntake} loanType={deal.loanType} />
          </div>
        </details>
      ) : null}

      {attempts.length > 0 ? (
        <details className="group rounded-[14px] border border-line bg-surface px-5 py-4">
          <summary className="cursor-pointer text-sm font-semibold text-ink">
            Recent communications
          </summary>
          <div className="mt-4">
            <CommunicationTimeline attempts={attempts} />
          </div>
        </details>
      ) : null}
    </div>
  );
}

export function DealTabNav({
  dealId,
  tab,
}: {
  dealId: string;
  tab: DealTab;
}) {
  const items: { href: string; key: DealTab; label: string }[] = [
    { key: "overview", label: "Overview", href: `/deals/${dealId}?tab=overview` },
    { key: "needs", label: "Needs", href: `/deals/${dealId}?tab=needs` },
    { key: "documents", label: "Documents", href: `/deals/${dealId}?tab=documents` },
    { key: "contacts", label: "People", href: `/deals/${dealId}?tab=people` },
    { key: "activity", label: "Timeline", href: `/deals/${dealId}?tab=timeline` },
  ];
  return (
    <TabList
      tabs={items.map((item) => ({
        href: item.href,
        label: item.label,
        active: tab === item.key,
      }))}
    />
  );
}
