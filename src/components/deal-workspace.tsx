import type { ReactNode } from "react";
import { StatusChip } from "@/components/status-chip";
import { TabList } from "@/components/ui/controls";
import { CardHeader, SurfaceCard } from "@/components/ui/surface-card";
import { labelClass } from "@/components/ui/styles";
import type { ClientNeedRow, DealDetail, DocumentRow, TaskRow } from "@/lib/data/deals";
import { formatCurrency, formatProperty } from "@/lib/format";
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
}: {
  deal: DealDetail;
  actions: ReactNode;
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
            value={deal.assignedProcessorId ? "Assigned" : "Unassigned"}
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

const INTAKE_LABELS: Array<[string, string]> = [
  ["property_zip", "ZIP"],
  ["units", "Units"],
  ["square_footage", "Square footage"],
  ["occupancy", "Occupancy"],
  ["purchase_price", "Purchase price"],
  ["current_value", "Current value"],
  ["existing_payoff", "Existing payoff"],
  ["cash_out", "Cash-out"],
  ["estimated_arv", "Estimated ARV"],
  ["rehab_budget", "Rehab budget"],
  ["monthly_rent", "Monthly rent"],
  ["noi", "NOI"],
  ["land_owned", "Land owned"],
  ["land_value", "Land value"],
  ["construction_budget", "Construction budget"],
  ["completed_value", "Completed value"],
  ["plans_permits", "Plans / permits"],
  ["liquidity", "Liquidity"],
  ["net_worth", "Net worth"],
  ["under_contract", "Under contract"],
  ["closing_date", "Closing date"],
  ["timeline", "Funding timeline"],
  ["borrower_comments", "Borrower comments"],
  ["loan_officer_notes", "Loan officer notes"],
];

function ApplicationIntakeCard({ intake }: { intake: Record<string, string> }) {
  const rows = INTAKE_LABELS.filter(([key]) => intake[key]);
  if (rows.length === 0) {
    return null;
  }
  return (
    <SurfaceCard>
      <CardHeader title="Application intake" />
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {rows.map(([key, label]) => (
          <HeaderItem key={key} label={label} value={intake[key]} />
        ))}
      </dl>
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
}: {
  deal: DealDetail;
  needs: ClientNeedRow[];
  documents: DocumentRow[];
  tasks?: TaskRow[];
  nextActions: DecoratedAction[];
  intake?: Record<string, string> | null;
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
  const readiness = evaluateSubmissionReadiness({
    needs: needs.map((need) => ({
      required: need.required,
      status: need.status,
    })),
    tasks: nextActions.map((task) => ({
      status: task.status,
      blockedReason: task.blockedReason ?? null,
    })),
  });

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
      {intake ? <ApplicationIntakeCard intake={intake} /> : null}
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
          <HeaderItem label="Follow-ups due" value={String(followUps)} />
          <HeaderItem label="Escalations" value={String(escalations)} />
        </dl>
      </SurfaceCard>
      <SurfaceCard>
        <CardHeader title="Submission readiness" />
        <p className="text-sm text-ink">
          {readiness.ready
            ? "Minimum readiness conditions pass. This file may move to Ready for Submission."
            : "Ready for Submission is blocked until minimum readiness conditions pass."}
        </p>
        {readiness.blockers.length > 0 ? (
          <ul className="mt-3 space-y-1">
            {readiness.blockers.map((blocker) => (
              <li key={blocker} className="text-sm text-danger">
                {blocker}
              </li>
            ))}
          </ul>
        ) : null}
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
