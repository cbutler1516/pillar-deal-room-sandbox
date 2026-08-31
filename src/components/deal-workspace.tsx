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

export function parseDealTab(value: string | undefined): DealTab {
  return DEAL_TABS.includes(value as DealTab) ? (value as DealTab) : "overview";
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
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
      <div className="min-w-0">
        <p className={labelClass}>{deal.dealReference}</p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight text-ink">
          {deal.borrowerName}
        </h2>
        <p className="text-sm text-ink-muted">{deal.entityName ?? "—"}</p>
        <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
          <HeaderItem
            label="Property"
            value={
              deal.propertyAddress
                ? `${deal.propertyAddress}, ${formatProperty(deal.propertyCity, deal.propertyState)}`
                : formatProperty(deal.propertyCity, deal.propertyState)
            }
          />
          <HeaderItem label="Amount" value={formatCurrency(deal.loanAmount)} />
          <HeaderItem
            label="Processor"
            value={
              processorLabel ??
              (deal.assignedProcessorId ? "Assigned" : "Unassigned")
            }
          />
        </dl>
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
    <SurfaceCard>
      <CardHeader title="Application intake" />
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
    </SurfaceCard>
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
    documents,
    nextActions,
    mismatches,
  });
  const resolvedIntake = intake ?? deal.applicationIntake;

  return (
    <div className="space-y-6">
      <SurfaceCard elevated>
        <CardHeader title="Deal summary" />
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <HeaderItem label="Borrower" value={deal.borrowerName} />
          <HeaderItem label="Entity" value={deal.entityName} />
          <HeaderItem
            label="Property"
            value={
              deal.propertyAddress
                ? `${deal.propertyAddress}, ${formatProperty(deal.propertyCity, deal.propertyState)}`
                : formatProperty(deal.propertyCity, deal.propertyState)
            }
          />
          <HeaderItem label="Amount" value={formatCurrency(deal.loanAmount)} />
          <HeaderItem label="Loan type" value={deal.loanType} />
          <HeaderItem label="Purpose" value={deal.loanPurpose} />
          <HeaderItem label="Credit" value={deal.creditBand} />
          <HeaderItem label="Experience" value={deal.experience} />
        </dl>
      </SurfaceCard>
      {nextAction ? (
        <SurfaceCard elevated>
          <CardHeader title="Next action" />
          <p className="text-sm font-medium text-ink">{nextAction.action}</p>
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
            className="mt-3 inline-block text-xs font-medium text-pillar-navy underline"
          >
            Open {nextAction.target}
          </a>
        </SurfaceCard>
      ) : null}
      {resolvedIntake ? (
        <ApplicationIntakeCard intake={resolvedIntake} loanType={deal.loanType} />
      ) : null}
      <SurfaceCard>
        <CardHeader title="Processing health" />
        <dl className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <HeaderItem label="Required now incomplete" value={String(requiredNow)} />
          <HeaderItem label="Documents to review" value={String(reviewCount)} />
          <HeaderItem
            label="Client Needs"
            value={`${docs.complete}/${docs.required} complete`}
          />
          <HeaderItem label="Missing contacts" value={String(missingContacts)} />
          <HeaderItem label="Follow-ups overdue" value={String(followUps)} />
          <HeaderItem label="Escalations" value={String(escalations)} />
        </dl>
      </SurfaceCard>
      <SurfaceCard>
        <CardHeader title="Submission readiness" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <h3 className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
              Ready
            </h3>
            <p className="mt-1 text-sm text-ink">
              {readiness.satisfiedCount} requirement
              {readiness.satisfiedCount === 1 ? "" : "s"} satisfied
              {readiness.requiredCount > 0
                ? ` of ${readiness.requiredCount} required before submission`
                : ""}
            </p>
          </div>
          <div>
            <h3 className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
              Needs attention
            </h3>
            {readiness.attention.length === 0 ? (
              <p className="mt-1 text-sm text-ink">Nothing blocking submission.</p>
            ) : (
              <ul className="mt-1 space-y-1">
                {readiness.attention.map((item) => (
                  <li key={`${item.kind}-${item.label}`} className="text-sm text-danger">
                    {item.label}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </SurfaceCard>
      <SurfaceCard>
        <CardHeader title="Current blockers" />
        {blockers.length === 0 && rejectedNeeds.length === 0 ? (
          <p className="text-sm text-ink-muted">Nothing is blocking this file.</p>
        ) : (
          <ul>
            {rejectedNeeds.map((need) => (
              <li key={need.id} className="border-t border-line py-2 text-sm text-danger first:border-0">
                Replacement needed: {need.documentType}
              </li>
            ))}
            {blockers.slice(0, 6).map((task) => (
              <li key={task.id} className="border-t border-line py-2 first:border-0">
                <p className="text-sm text-ink">{task.title}</p>
                <p className="text-xs text-ink-muted">
                  {task.contactMissing
                    ? "Contact missing"
                    : task.escalationDue
                      ? "Escalated"
                      : task.overdue
                        ? "Overdue"
                        : "Blocked"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </SurfaceCard>
      <SurfaceCard>
        <CommunicationTimeline attempts={attempts} />
      </SurfaceCard>
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
  const items: { key: DealTab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "tasks", label: "Tasks" },
    { key: "needs", label: "Client Needs" },
    { key: "documents", label: "Documents" },
    { key: "contacts", label: "Contacts" },
    { key: "activity", label: "Activity" },
  ];
  return (
    <TabList
      tabs={items.map((item) => ({
        href: `/deals/${dealId}?tab=${item.key}`,
        label: item.label,
        active: tab === item.key,
      }))}
    />
  );
}
