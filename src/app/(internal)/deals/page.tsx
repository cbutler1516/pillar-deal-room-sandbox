import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { ProgressBar } from "@/components/progress-bar";
import { StatusChip } from "@/components/status-chip";
import { PageHeader } from "@/components/ui/page-header";
import { buttonClass } from "@/components/ui/button";
import { SearchField, SelectField } from "@/components/ui/controls";
import {
  pageWidthClass,
  tableHeadClass,
  tableRowClass,
} from "@/components/ui/styles";
import { StaffPresence } from "@/components/ui/staff-avatar";
import { requireInternalUser } from "@/lib/auth/session";
import { listActiveStaff } from "@/lib/communications/data";
import { staffDisplayName } from "@/lib/data/deals";
import { loadDealSnapshot } from "@/lib/data/snapshot";
import { operationalWorkFromSnapshot } from "@/lib/data/dashboard";
import { topWorkItemForDeal } from "@/lib/ops/operational-work";
import { humanizeWorkAction } from "@/lib/ui/staff-copy";
import { filterDeals, parseDealFilters } from "@/lib/ops/filters";
import { documentCompletion } from "@/lib/ops/metrics";
import { DEAL_STATUSES } from "@/lib/ops/workflow";
import { formatCurrency, formatProperty, formatStatusLabel, formatTimestamp } from "@/lib/format";

export default async function DealsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = parseDealFilters(params);
  const { supabase } = await requireInternalUser();
  const [snapshot, staff] = await Promise.all([
    loadDealSnapshot(supabase),
    listActiveStaff(supabase),
  ]);
  const staffNames = Object.fromEntries(
    staff.map((person) => [person.id, staffDisplayName(person)]),
  );
  const deals = filterDeals(snapshot.deals, filters);
  const loanTypes = [...new Set(snapshot.deals.map((deal) => deal.loanType).filter(Boolean))];
  const now = new Date();
  const workItems = operationalWorkFromSnapshot(snapshot, now);

  return (
    <div className={`${pageWidthClass} space-y-6`}>
      <PageHeader
        title="Deals"
        description="Find a file by borrower, status, or loan type."
      />

      <div className="border-y border-line py-3">
        <form className="grid gap-3 md:grid-cols-4">
          <SearchField
            name="q"
            defaultValue={filters.search}
            placeholder="Search borrower, entity, reference, property"
          />
          <SelectField name="status" defaultValue={filters.status}>
            <option value="">All statuses</option>
            {DEAL_STATUSES.map((status) => (
              <option key={status} value={status}>
                {formatStatusLabel(status)}
              </option>
            ))}
          </SelectField>
          <SelectField name="loanType" defaultValue={filters.loanType}>
            <option value="">All loan types</option>
            {loanTypes.map((type) => (
              <option key={type} value={type ?? ""}>
                {type}
              </option>
            ))}
          </SelectField>
          <div className="flex gap-2">
            <SelectField name="assignment" defaultValue={filters.assignment} className="w-full">
              <option value="all">All assignments</option>
              <option value="unassigned">Unassigned</option>
              <option value="assigned">Assigned</option>
            </SelectField>
            <button type="submit" className={buttonClass("primary", "md")}>
              Filter
            </button>
          </div>
        </form>
      </div>

      {deals.length === 0 ? (
        <EmptyState
          title="No files match these filters"
          description="Clear filters or seed the sandbox demo set if the inventory is empty."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-[13px]">
              <thead className={`${tableHeadClass} border-y border-line bg-stone/50`}>
                <tr>
                  <th className="px-4 py-2.5 font-medium">Deal</th>
                  <th className="px-4 py-2.5 font-medium">Loan Type</th>
                  <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                  <th className="px-4 py-2.5 font-medium">Property</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Next action</th>
                  <th className="px-4 py-2.5 font-medium">Documents</th>
                  <th className="px-4 py-2.5 font-medium">Processor</th>
                  <th className="px-4 py-2.5 text-right font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {deals.map((deal) => {
                  const docs = documentCompletion(deal.id, snapshot.needs);
                  const top = topWorkItemForDeal(workItems, deal.id);
                  return (
                    <tr key={deal.id} className={tableRowClass}>
                      <td className="px-4 py-3">
                        <Link
                          href={`/deals/${deal.id}`}
                          className="font-medium text-ink transition hover:text-mineral focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pillar-teal/40"
                        >
                          {deal.borrowerName}
                        </Link>
                        <p className="mt-0.5 text-[11px] tabular-nums text-ink-muted">
                          {deal.dealReference}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-ink-muted">{deal.loanType ?? "—"}</td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums text-ink">
                        {formatCurrency(deal.loanAmount)}
                      </td>
                      <td className="px-4 py-3 text-ink-muted">
                        {formatProperty(deal.propertyCity, deal.propertyState)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusChip status={deal.status} />
                      </td>
                      <td className="px-4 py-3">
                        {top ? (
                          <Link
                            href={top.href}
                            className="text-[13px] font-medium text-mineral transition hover:text-pillar-teal"
                          >
                            {humanizeWorkAction(top)}
                          </Link>
                        ) : (
                          <span className="text-ink-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <ProgressBar complete={docs.complete} total={docs.required} />
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <StaffPresence
                          name={
                            deal.assignedProcessorId
                              ? staffNames[deal.assignedProcessorId]
                              : null
                          }
                          unassigned={!deal.assignedProcessorId}
                        />
                      </td>
                      <td className="px-4 py-3 text-right text-[11px] tabular-nums text-ink-muted">
                        {formatTimestamp(deal.updatedAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
