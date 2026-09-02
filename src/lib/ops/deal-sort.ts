import type { DealStatus } from "@/lib/data/types";
import { formatStatusLabel } from "@/lib/format";

export const DEAL_SORT_COLUMNS = [
  "borrower",
  "loan_amount",
  "loan_type",
  "owner",
  "status",
  "next_action",
] as const;

export type DealSortColumn = (typeof DEAL_SORT_COLUMNS)[number];
export type DealSortDirection = "asc" | "desc";

export type DealSortState = {
  column: DealSortColumn;
  direction: DealSortDirection;
} | null;

export type SortableDeal = {
  id: string;
  borrowerName: string;
  entityName: string | null;
  loanAmount: number | null;
  loanType: string | null;
  status: DealStatus;
  ownerName: string | null;
  nextActionLabel: string | null;
};

const COLUMN_SET = new Set<string>(DEAL_SORT_COLUMNS);

export function isDealSortColumn(value: string): value is DealSortColumn {
  return COLUMN_SET.has(value);
}

function readParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
): string {
  const value = searchParams[key];
  return typeof value === "string" ? value : "";
}

/** URL sort state. Invalid or missing values fall back to the default Deals order. */
export function parseDealSort(
  searchParams: Record<string, string | string[] | undefined>,
): DealSortState {
  const column = readParam(searchParams, "sort");
  const direction = readParam(searchParams, "direction");
  if (!isDealSortColumn(column)) {
    return null;
  }
  if (direction !== "asc" && direction !== "desc") {
    return null;
  }
  return { column, direction };
}

export function dealSortQuery(
  state: DealSortState,
): { sort?: string; direction?: string } {
  if (!state) {
    return { sort: undefined, direction: undefined };
  }
  return { sort: state.column, direction: state.direction };
}

/**
 * Click cycle: none → asc → desc → default.
 * Switching columns always starts at ascending.
 */
export function nextDealSortState(
  current: DealSortState,
  column: DealSortColumn,
): DealSortState {
  if (current?.column !== column) {
    return { column, direction: "asc" };
  }
  if (current.direction === "asc") {
    return { column, direction: "desc" };
  }
  return null;
}

function isBlank(value: string | null | undefined): boolean {
  return value == null || value.trim() === "";
}

function compareText(a: string, b: string): number {
  return a.trim().localeCompare(b.trim(), "en", {
    sensitivity: "base",
    numeric: true,
  });
}

function compareNullableText(
  a: string | null | undefined,
  b: string | null | undefined,
  direction: DealSortDirection,
): number {
  const aMissing = isBlank(a);
  const bMissing = isBlank(b);
  if (aMissing && bMissing) {
    return 0;
  }
  if (aMissing) {
    return 1;
  }
  if (bMissing) {
    return -1;
  }
  const result = compareText(a as string, b as string);
  return direction === "desc" ? -result : result;
}

function compareNullableNumber(
  a: number | null | undefined,
  b: number | null | undefined,
  direction: DealSortDirection,
): number {
  const aMissing = a == null || Number.isNaN(a);
  const bMissing = b == null || Number.isNaN(b);
  if (aMissing && bMissing) {
    return 0;
  }
  if (aMissing) {
    return 1;
  }
  if (bMissing) {
    return -1;
  }
  const result = a === b ? 0 : (a as number) < (b as number) ? -1 : 1;
  return direction === "desc" ? -result : result;
}

function compareDeal(
  a: SortableDeal,
  b: SortableDeal,
  state: Exclude<DealSortState, null>,
): number {
  const { column, direction } = state;
  let result = 0;
  switch (column) {
    case "borrower":
      result = compareNullableText(a.borrowerName, b.borrowerName, direction);
      if (result === 0) {
        result = compareNullableText(a.entityName, b.entityName, direction);
      }
      break;
    case "loan_amount":
      result = compareNullableNumber(a.loanAmount, b.loanAmount, direction);
      break;
    case "loan_type":
      result = compareNullableText(a.loanType, b.loanType, direction);
      break;
    case "owner":
      result = compareNullableText(a.ownerName, b.ownerName, direction);
      break;
    case "status":
      result = compareNullableText(
        formatStatusLabel(a.status),
        formatStatusLabel(b.status),
        direction,
      );
      break;
    case "next_action":
      result = compareNullableText(
        a.nextActionLabel,
        b.nextActionLabel,
        direction,
      );
      break;
  }
  if (result !== 0) {
    return result;
  }
  return a.id.localeCompare(b.id);
}

/**
 * Sort a filtered Deals list. Null state preserves the incoming (default) order.
 * Missing values always follow real values. Ties break by id.
 */
export function sortDeals<T extends SortableDeal>(
  deals: T[],
  state: DealSortState,
): T[] {
  if (!state) {
    return deals;
  }
  return [...deals].sort((a, b) => compareDeal(a, b, state));
}
