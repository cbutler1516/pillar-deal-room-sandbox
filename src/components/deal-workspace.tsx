import type { ReactNode } from "react";
import Link from "next/link";
import { FactLedger } from "@/components/ui/fact-ledger";
import { StatusChip } from "@/components/status-chip";
import { TabList } from "@/components/ui/controls";
import { PropertyThumb } from "@/components/ui/property-thumb";
import { SectionHeader } from "@/components/ui/surface-card";
import { labelClass } from "@/components/ui/styles";
import {
  applicationIntakeFromUnknown,
  intakeDisplayGroups,
} from "@/lib/application/intake";
import type { CommunicationAttempt } from "@/lib/communications/types";
import type { ClientNeedRow, DealDetail, DocumentRow, TaskRow } from "@/lib/data/deals";
import { formatCurrency, formatFollowUpAt, formatProperty, formatTimestamp } from "@/lib/format";
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
import { conditionSummary } from "@/lib/conditions/model";
import {
  DEAL_PROGRESS_STAGES,
  countRequiredItemsReceived,
  dealProgressIndex,
  dealSnapshotMetrics,
  nextActionPresentation,
} from "@/lib/ui/deal-presentation";

export const DEAL_TABS = [
  "overview",
  "tasks",
  "needs",
  "documents",
  "conditions",
  "submission",
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
  const unassigned = !ownerName;
  const loanAmount = formatCurrency(deal.loanAmount);

  return (
    <div className="border-b border-line pb-6">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <div className="min-w-0 flex-1">
            <p className="mb-3">
              <Link href="/deals" className="text-[11px] font-medium text-mineral">
                ← Deals
              </Link>
            </p>
            <p className={labelClass}>{deal.dealReference}</p>
            <h2 className="font-display mt-1.5 text-[2.15rem] leading-none font-semibold tracking-tight text-ink">
              {deal.borrowerName}
            </h2>
            {deal.entityName ? (
              <p className="mt-2.5 text-sm text-ink">{deal.entityName}</p>
            ) : null}
            {deal.propertyAddress || cityState !== "—" ? (
              <p className="mt-2 text-sm leading-6 text-ink-muted">
                {deal.propertyAddress || cityState}
                {deal.propertyAddress && cityState !== "—" ? ` · ${cityState}` : ""}
              </p>
            ) : null}
          </div>
          <PropertyThumb address={deal.propertyAddress} />
        </div>

        {loanAmount !== "—" ? (
          <div className="min-w-[9rem] border-l-2 border-accent pl-5">
            <p className="text-[2rem] leading-none font-semibold tracking-tight tabular-nums text-ink">
              {loanAmount}
            </p>
            <p className="mt-2 text-[10px] tracking-[0.14em] text-ink-muted uppercase">
              Requested loan
            </p>
          </div>
        ) : null}
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-x-6 border-t border-line pt-4 sm:grid-cols-4">
        <HeaderItem label="Loan type" value={deal.loanType} />
        <div>
          <dt className="text-[11px] text-ink-muted">Status</dt>
          <dd className="mt-0.5">
            <StatusChip status={deal.status} />
          </dd>
        </div>
        <HeaderItem label="Owner" value={unassigned ? "Unassigned" : ownerName} />
        <HeaderItem label="File ID" value={deal.dealReference} />
      </dl>
      {actions ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
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
  const current =
    DEAL_PROGRESS_STAGES[dealProgressIndex(status)]?.label ?? "Application";

  return (
    <p className="text-[12px] text-ink-muted">
      {current}
      {received.required > 0
        ? ` · ${received.received} of ${received.required} needed items received`
        : ""}
      {reviewCount > 0 ? ` · ${reviewCount} still need review` : ""}
    </p>
  );
}

export function DealOverview({
  deal,
  needs,
  documents,
  tasks = [],
  nextActions,
  intake = null,
  attempts = [],
  mismatches = [],
  assist = null,
  submittedLabel = null,
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
  submittedLabel?: string | null;
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
      title: task.title,
      sourceType: task.sourceType,
      playbookKey: task.playbookKey,
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
  const conditions = conditionSummary({
    tasks: (tasks ?? nextActions).map((task) => ({
      sourceType: task.sourceType,
      taskType: "taskType" in task ? task.taskType : null,
      playbookKey: task.playbookKey,
      status: task.status,
      clientNeedId: task.clientNeedId,
    })),
    needs: needs.map((need) => ({ id: need.id, status: need.status })),
  });
  const openConditions = conditions.open + conditions.received + conditions.waiting + conditions.review;

  return (
    <div className="space-y-10">
      <DealProgressStrip status={deal.status} received={received} reviewCount={reviewCount} />

      {deal.status === "submitted" && submittedLabel ? (
        <section className="border-l-2 border-pillar-ink pl-5">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-ink-muted uppercase">
            Submitted
          </p>
          <p className="mt-2 text-sm leading-6 text-ink">{submittedLabel}</p>
          <p className="mt-1 text-xs text-ink-muted">
            This is not an approval, close, or clear-to-close. Conditions can continue.
          </p>
        </section>
      ) : null}

      {nextAction && presentation ? (
        <section className="flex gap-5">
          <span aria-hidden className="w-[2px] shrink-0 bg-accent" />
          <div className="min-w-0 flex-1 py-0.5">
            <p className="text-[11px] font-semibold tracking-[0.14em] text-ink-muted uppercase">
              Next Action
            </p>
            <h3 className="font-display mt-2 text-[1.65rem] font-semibold leading-tight tracking-tight text-ink">
              {nextAction.action}
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">
              {presentation.context}
            </p>
            <div className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <a
                href={nextAction.href}
                className="text-[13px] font-medium text-mineral transition hover:text-pillar-teal"
              >
                {presentation.cta} →
              </a>
              {nextAction.dueAt ? (
                <span className="text-[11px] tabular-nums text-ink-muted">
                  Follow-up {formatFollowUpAt(nextAction.dueAt)}
                </span>
              ) : null}
            </div>
          </div>
        </section>
      ) : (
        <section className="flex gap-5">
          <span aria-hidden className="w-[2px] shrink-0 bg-line" />
          <div>
            <p className="text-[11px] font-semibold tracking-[0.14em] text-ink-muted uppercase">
              Next Action
            </p>
            <p className="mt-2 text-sm leading-6 text-ink-muted">
              Nothing needs your attention.
            </p>
          </div>
        </section>
      )}

      {snapshot.length > 0 ? (
        <section>
          <SectionHeader title="Transaction snapshot" />
          <FactLedger rows={snapshot} />
        </section>
      ) : null}

      <section>
        <SectionHeader title="Ready to send" />
        <FactLedger
          rows={[
            {
              label: "Needed items",
              value:
                readiness.requiredCount > 0
                  ? `${readiness.satisfiedCount} of ${readiness.requiredCount} ready`
                  : "None needed",
            },
            { label: "Needed now", value: requiredNow },
            { label: "Missing contacts", value: missingContacts },
            { label: "Follow-ups overdue", value: followUps },
          ]}
          columns={2}
        />
        {readiness.attention.length > 0 ? (
          <ul className="mt-3 divide-y divide-line border-b border-line">
            {readiness.attention.map((item) => (
              <li key={`${item.kind}-${item.label}`} className="py-2 text-sm text-danger">
                {item.label}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {openConditions > 0 || conditions.cleared > 0 ? (
        <section>
          <SectionHeader
            title="Conditions"
            actions={
              <a
                href={`/deals/${deal.id}?tab=conditions`}
                className="text-[11px] font-medium text-mineral"
              >
                View →
              </a>
            }
          />
          <FactLedger
            columns={2}
            rows={[
              { label: "Open", value: openConditions },
              { label: "Received", value: conditions.received },
              { label: "Waiting", value: conditions.waiting },
              { label: "Need review", value: conditions.review },
            ]}
          />
        </section>
      ) : null}

      <div className="grid gap-10 lg:grid-cols-2">
        <section>
          <SectionHeader title="Blockers" />
          {blockers.length === 0 && rejectedNeeds.length === 0 ? (
            <p className="text-sm text-ink-muted">Nothing is blocking this file.</p>
          ) : (
            <ul className="divide-y divide-line border-y border-line">
              {rejectedNeeds.map((need) => (
                <li key={need.id} className="py-2 text-sm text-danger">
                  Replacement {need.documentType} needed
                </li>
              ))}
              {blockers.slice(0, 6).map((task) => (
                <li key={task.id} className="py-2 text-sm text-ink">
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
        </section>

        <section>
          <SectionHeader title="Waiting for" />
          {waitingOn.labels.length === 0 ? (
            <p className="text-sm leading-6 text-ink-muted">{waitingOn.empty}</p>
          ) : (
            <ul className="divide-y divide-line border-y border-line">
              {waitingOn.labels.map((label) => (
                <li key={label} className="py-2 text-sm text-ink">
                  {label}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {attempts.length > 0 ? (
        <section>
          <SectionHeader title="Recent activity" />
          <ul className="divide-y divide-line border-y border-line">
            {attempts.slice(0, 5).map((attempt) => (
              <li
                key={attempt.id}
                className="flex items-baseline justify-between gap-4 py-2.5"
              >
                <span className="min-w-0 truncate text-sm text-ink">
                  {attempt.subject || attempt.channel}
                </span>
                <span className="shrink-0 text-[11px] tabular-nums text-ink-muted">
                  {formatTimestamp(attempt.attemptedAt)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {assist}

      <details className="group border-y border-line py-4">
        <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
          File details
        </summary>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <HeaderItem label="Purpose" value={deal.loanPurpose} />
          <HeaderItem label="Credit" value={deal.creditBand} />
          <HeaderItem label="Experience" value={deal.experience} />
          <HeaderItem label="Escalations" value={String(escalations)} />
        </dl>
      </details>

      {resolvedIntake ? (
        <details className="group border-b border-line py-4">
          <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
            Application intake
          </summary>
          <div className="mt-4">
            <ApplicationIntakeCard intake={resolvedIntake} loanType={deal.loanType} />
          </div>
        </details>
      ) : null}
    </div>
  );
}

export const DEAL_TAB_NAV: { key: DealTab; label: string; tab: string }[] = [
  { key: "overview", label: "Overview", tab: "overview" },
  { key: "needs", label: "Requests", tab: "needs" },
  { key: "documents", label: "Documents", tab: "documents" },
  { key: "conditions", label: "Conditions", tab: "conditions" },
  { key: "submission", label: "Submission", tab: "submission" },
  { key: "contacts", label: "People", tab: "people" },
  { key: "activity", label: "Activity", tab: "timeline" },
];

export function DealTabNav({
  dealId,
  tab,
}: {
  dealId: string;
  tab: DealTab;
}) {
  return (
    <TabList
      tabs={DEAL_TAB_NAV.map((item) => ({
        href: `/deals/${dealId}?tab=${item.tab}`,
        label: item.label,
        active: tab === item.key,
      }))}
    />
  );
}
