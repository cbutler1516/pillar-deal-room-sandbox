import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { StatusChip } from "@/components/status-chip";
import { PageHeader } from "@/components/ui/page-header";
import { SortHeader } from "@/components/ui/sort-header";
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
import {
  dealSortQuery,
  nextDealSortState,
  parseDealSort,
  sortDeals,
  type DealSortColumn,
} from "@/lib/ops/deal-sort";
import { hrefWithQuery } from "@/lib/ops/ops-board";
import { DEAL_STATUSES } from "@/lib/ops/workflow";
import { formatCurrency, formatProperty, formatStatusLabel, formatTimestamp } from "@/lib/format";

export default async function DealsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = parseDealFilters(params);
  const sortState = parseDealSort(params);
  const { supabase } = await requireInternalUser();
  const [snapshot, staff] = await Promise.all([
    loadDealSnapshot(supabase),
    listActiveStaff(supabase),
  ]);
  const staffNames = Object.fromEntries(
    staff.map((person) => [person.id, staffDisplayName(person)]),
  );
  const now = new Date();
  const workItems = operationalWorkFromSnapshot(snapshot, now);
  const filtered = filterDeals(snapshot.deals, filters);
  const deals = sortDeals(
    filtered.map((deal) => {
      const top = topWorkItemForDeal(workItems, deal.id);
      return {
        ...deal,
        ownerName: deal.assignedProcessorId
          ? staffNames[deal.assignedProcessorId] ?? null
          : null,
        nextActionLabel: top ? humanizeWorkAction(top) : null,
        top,
      };
    }),
    sortState,
  );
  const loanTypes = [...new Set(snapshot.deals.map((deal) => deal.loanType).filter(Boolean))];
  const queryState = {
    q: filters.search || undefined,
    status: filters.status || undefined,
    loanType: filters.loanType || undefined,
    assignment: filters.assignment === "all" ? undefined : filters.assignment,
    ...dealSortQuery(sortState),
  };

  function sortHref(column: DealSortColumn): string {
    return hrefWithQuery(
      "/deals",
      queryState,
      dealSortQuery(nextDealSortState(sortState, column)),
    );
  }

  function sortDirection(column: DealSortColumn) {
    return sortState?.column === column ? sortState.direction : null;
  }

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
          {sortState ? (
            <>
              <input type="hidden" name="sort" value={sortState.column} />
              <input type="hidden" name="direction" value={sortState.direction} />
            </>
          ) : null}
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
                <SortHeader
                  label="File"
                  accessibleName="Borrower / entity"
                  href={sortHref("borrower")}
                  direction={sortDirection("borrower")}
                  className={tableCellClass}
                />
                <SortHeader
                  label="Loan"
                  accessibleName="Loan amount"
                  href={sortHref("loan_amount")}
                  direction={sortDirection("loan_amount")}
                  align="right"
                  className={`${tableCellClass} text-right`}
                />
                <SortHeader
                  label="Type"
                  accessibleName="Loan type"
                  href={sortHref("loan_type")}
                  direction={sortDirection("loan_type")}
                  className={tableCellClass}
                />
                <SortHeader
                  label="Owner"
                  accessibleName="Owner"
                  href={sortHref("owner")}
                  direction={sortDirection("owner")}
                  className={tableCellClass}
                />
                <SortHeader
                  label="Status"
                  accessibleName="Status"
                  href={sortHref("status")}
                  direction={sortDirection("status")}
                  className={tableCellClass}
                />
                <SortHeader
                  label="Next"
                  accessibleName="Next action"
                  href={sortHref("next_action")}
                  direction={sortDirection("next_action")}
                  className={tableCellClass}
                />
                <th className={`${tableCellClass} text-right font-medium`} scope="col">
                  Updated
                </th>
              </tr>
            </thead>
            <tbody>
              {deals.map((deal) => {
                const property = formatProperty(deal.propertyCity, deal.propertyState);
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
                      {deal.ownerName ?? "Unassigned"}
                    </td>
                    <td className={tableCellClass}>
                      <StatusChip status={deal.status} />
                    </td>
                    <td className={tableCellClass}>
                      {deal.top ? (
                        <Link
                          href={deal.top.href}
                          className="text-[13px] font-medium text-mineral transition hover:text-pillar-teal"
                        >
                          {deal.nextActionLabel}
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
