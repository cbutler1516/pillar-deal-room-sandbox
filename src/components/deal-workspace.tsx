import type { ReactNode } from "react";
import { StatusChip } from "@/components/status-chip";
import { TabList } from "@/components/ui/controls";
import { CardHeader, SurfaceCard } from "@/components/ui/surface-card";
import { labelClass } from "@/components/ui/styles";
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
  waitingCopyForDeal,
} from "@/lib/ops/operational-work";
import { documentCompletion } from "@/lib/ops/metrics";
import { evaluateSubmissionReadiness } from "@/lib/ops/workflow";
import type { DecoratedAction } from "@/lib/playbooks/decorate";

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
  processorLabel,
}: {
  deal: DealDetail;
  actions: ReactNode;
  processorLabel?: string;
}) {
  const property = deal.propertyAddress
    ? `${deal.propertyAddress}, ${formatProperty(deal.propertyCity, deal.propertyState)}`
    : formatProperty(deal.propertyCity, deal.propertyState);

  return (
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
      <div className="min-w-0">
        <p className={labelClass}>{deal.dealReference}</p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight text-ink">
          {deal.borrowerName}
        </h2>
        <p className="text-sm text-ink-muted">{deal.entityName ?? "—"}</p>
        <p className="mt-2 text-sm text-ink">
          {[deal.loanType, property, formatCurrency(deal.loanAmount)]
            .filter((part) => part && part !== "—")
            .join(" · ")}
        </p>
        {processorLabel ? (
          <p className="mt-1 text-xs text-ink-muted">{processorLabel}</p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <StatusChip status={deal.status} />
        {actions}
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

export function DealOverview({
  deal,
  needs,
  documents,
  nextActions,
  intake = null,
  attempts = [],
  mismatches = [],
}: {
  deal: DealDetail;
  needs: ClientNeedRow[];
  documents: DocumentRow[];
  tasks?: TaskRow[];
  nextActions: DecoratedAction[];
  intake?: unknown;
  attempts?: CommunicationAttempt[];
  mismatches?: NextActionMismatch[];
}) {
  const docs = documentCompletion(
    deal.id,
    needs.map((need) => ({
      dealId: deal.id,
      required: need.required,
      status: need.status,
    })),
  );
  const reviewCount = documents.filter((doc) => doc.status === "needs_review").length;
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

  return (
    <div className="space-y-6">
      {nextAction ? (
        <SurfaceCard elevated>
          <CardHeader title="Next action" />
          <p className="text-lg font-semibold tracking-tight text-ink">
            {nextAction.action}
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            {[nextAction.source, nextAction.contactName]
              .filter(Boolean)
              .join(" · ") || "Internal"}
            {nextAction.dueAt
              ? ` · Follow-up ${formatFollowUpAt(nextAction.dueAt)}`
              : ""}
          </p>
          <a
            href={nextAction.href}
            className="mt-4 inline-flex min-h-10 items-center rounded-md bg-pillar-teal px-3.5 py-2 text-sm font-medium text-white"
          >
            Open next action
          </a>
        </SurfaceCard>
      ) : (
        <SurfaceCard elevated>
          <CardHeader title="Next action" />
          <p className="text-sm leading-6 text-ink-muted">
            Nothing needs your attention.
          </p>
        </SurfaceCard>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
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

        <SurfaceCard>
          <CardHeader title="Progress" />
          <p className="text-sm text-ink">
            {docs.complete} of {docs.required} required items complete
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            {reviewCount > 0
              ? `${reviewCount} document${reviewCount === 1 ? "" : "s"} still need review`
              : "No documents are waiting on review"}
          </p>
        </SurfaceCard>
      </div>

      <details className="group rounded-[10px] border border-line bg-surface px-5 py-4">
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
        <details className="group rounded-[10px] border border-line bg-surface">
          <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-ink">
            Application intake
          </summary>
          <div className="border-t border-line px-5 py-4">
            <ApplicationIntakeCard intake={resolvedIntake} loanType={deal.loanType} />
          </div>
        </details>
      ) : null}

      {attempts.length > 0 ? (
        <details className="group rounded-[10px] border border-line bg-surface px-5 py-4">
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
