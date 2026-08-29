import type { DealStatus } from "@/lib/data/types";

export type DealFilterInput = {
  search?: string;
  status?: string;
  loanType?: string;
  assignment?: "all" | "assigned" | "unassigned";
};

export type FilterableDeal = {
  dealReference: string;
  borrowerName: string;
  entityName: string | null;
  propertyAddress: string | null;
  propertyCity: string | null;
  propertyState: string | null;
  loanType: string | null;
  status: DealStatus;
  assignedProcessorId: string | null;
};

export function parseDealFilters(
  searchParams: Record<string, string | string[] | undefined>,
): DealFilterInput {
  const read = (key: string) => {
    const value = searchParams[key];
    return typeof value === "string" ? value : "";
  };

  const assignment = read("assignment");
  return {
    search: read("q").trim(),
    status: read("status").trim(),
    loanType: read("loanType").trim(),
    assignment:
      assignment === "assigned" || assignment === "unassigned"
        ? assignment
        : "all",
  };
}

export function dealMatchesFilters(
  deal: FilterableDeal,
  filters: DealFilterInput,
): boolean {
  if (filters.status && deal.status !== filters.status) {
    return false;
  }
  if (filters.loanType && deal.loanType !== filters.loanType) {
    return false;
  }
  if (filters.assignment === "assigned" && !deal.assignedProcessorId) {
    return false;
  }
  if (filters.assignment === "unassigned" && deal.assignedProcessorId) {
    return false;
  }
  if (filters.search) {
    const haystack = [
      deal.borrowerName,
      deal.entityName,
      deal.dealReference,
      deal.propertyAddress,
      deal.propertyCity,
      deal.propertyState,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(filters.search.toLowerCase())) {
      return false;
    }
  }
  return true;
}

export function filterDeals<T extends FilterableDeal>(
  deals: T[],
  filters: DealFilterInput,
): T[] {
  return deals.filter((deal) => dealMatchesFilters(deal, filters));
}
