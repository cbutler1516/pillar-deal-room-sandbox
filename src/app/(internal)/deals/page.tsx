import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { StatusChip } from "@/components/status-chip";
import { PageHeader } from "@/components/ui/page-header";
import { buttonClass } from "@/components/ui/button";
import { SearchField, SelectField, Toolbar } from "@/components/ui/controls";
import {
  pageWidthClass,
  tableCellClass,
  tableHeadClass,
  tableRowClass,
} from "@/components/ui/styles";
import { requireInternalUser } from "@/lib/auth/session";
import { listActiveStaff } from "@/lib/communications/data";
import { staffDisplayName } from "@/lib/data/deals";
import { loadDealSnapshot } from "@/lib/data/snapshot";
import { operationalWorkFromSnapshot } from "@/lib/data/dashboard";
import { topWorkItemForDeal } from "@/lib/ops/operational-work";
import { humanizeWorkAction } from "@/lib/ui/staff-copy";
import { filterDeals, parseDealFilters } from "@/lib/ops/filters";
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
        description={`${deals.length} file${deals.length === 1 ? "" : "s"}`}
      />

      <Toolbar>
        <form className="flex flex-1 flex-wrap items-center gap-2">
          <SearchField
            name="q"
            compact
            defaultValue={filters.search}
            placeholder="Borrower, entity, property, file ID"
            className="min-w-64 flex-1"
          />
          <SelectField name="status" compact defaultValue={filters.status}>
            <option value="">All statuses</option>
            {DEAL_STATUSES.map((status) => (
              <option key={status} value={status}>
                {formatStatusLabel(status)}
              </option>
            ))}
          </SelectField>
          <SelectField name="loanType" compact defaultValue={filters.loanType}>
            <option value="">All loan types</option>
            {loanTypes.map((type) => (
              <option key={type} value={type ?? ""}>
                {type}
              </option>
            ))}
          </SelectField>
          <SelectField name="assignment" compact defaultValue={filters.assignment}>
            <option value="all">All owners</option>
            <option value="unassigned">Unassigned</option>
            <option value="assigned">Assigned</option>
          </SelectField>
          <button type="submit" className={buttonClass("secondary", "sm")}>
            Apply
          </button>
        </form>
      </Toolbar>

      {deals.length === 0 ? (
        <EmptyState
          title="No files match these filters"
          description="Clear filters or seed the sandbox demo set if the inventory is empty."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-[13px]">
            <thead className={`${tableHeadClass} sticky top-0 border-y border-line bg-paper`}>
              <tr>
                <th className={`${tableCellClass} font-medium`}>File</th>
                <th className={`${tableCellClass} text-right font-medium`}>Loan</th>
                <th className={`${tableCellClass} font-medium`}>Type</th>
                <th className={`${tableCellClass} font-medium`}>Owner</th>
                <th className={`${tableCellClass} font-medium`}>Status</th>
                <th className={`${tableCellClass} font-medium`}>Next</th>
                <th className={`${tableCellClass} text-right font-medium`}>Updated</th>
              </tr>
            </thead>
            <tbody>
              {deals.map((deal) => {
                const top = topWorkItemForDeal(workItems, deal.id);
                const property = formatProperty(deal.propertyCity, deal.propertyState);
                const owner = deal.assignedProcessorId
                  ? staffNames[deal.assignedProcessorId]
                  : null;
                return (
                  <tr
                    key={deal.id}
                    className={`${tableRowClass} border-l-2 border-l-transparent hover:border-l-mineral`}
                  >
                    <td className={tableCellClass}>
                      <Link
                        href={`/deals/${deal.id}`}
                        className="font-medium text-ink transition hover:text-mineral focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pillar-teal/40"
                      >
                        {deal.borrowerName}
                      </Link>
                      {deal.entityName && deal.entityName !== deal.borrowerName ? (
                        <p className="mt-0.5 truncate text-[12px] text-ink">{deal.entityName}</p>
                      ) : null}
                      <p className="mt-0.5 truncate text-[11px] text-ink-muted">
                        {property}
                        {deal.dealReference ? ` · ${deal.dealReference}` : ""}
                      </p>
                    </td>
                    <td className={`${tableCellClass} text-right font-medium tabular-nums text-ink`}>
                      {formatCurrency(deal.loanAmount)}
                    </td>
                    <td className={`${tableCellClass} text-ink-muted`}>
                      {deal.loanType ?? "—"}
                    </td>
                    <td className={`${tableCellClass} text-[12px] text-ink-muted`}>
                      {owner ?? "Unassigned"}
                    </td>
                    <td className={tableCellClass}>
                      <StatusChip status={deal.status} />
                    </td>
                    <td className={tableCellClass}>
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
                    <td className={`${tableCellClass} text-right text-[11px] tabular-nums text-ink-muted`}>
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
