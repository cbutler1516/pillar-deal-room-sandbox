export const APPLICATION_LOAN_TYPES = [
  "Fix & Flip",
  "DSCR Purchase",
  "DSCR Refinance",
  "Bridge",
  "Ground-Up Construction",
  "Multifamily",
  "Commercial",
  "Other / Not Sure",
] as const;

export type ApplicationLoanType = (typeof APPLICATION_LOAN_TYPES)[number];

export const APPLICATION_TRANSACTIONS = [
  "purchase",
  "refinance",
  "cash-out refinance",
  "bridge",
  "construction",
] as const;

export type ApplicationTransaction = (typeof APPLICATION_TRANSACTIONS)[number];

export const ENTITY_TYPES = [
  "LLC",
  "Corporation",
  "Partnership",
  "Trust",
  "Individual",
  "Other",
] as const;

export const PROPERTY_TYPES = [
  "SFR",
  "Condo",
  "2-4 unit",
  "Multifamily 5+",
  "Mixed-use",
  "Retail",
  "Office",
  "Industrial",
  "Land",
  "Other",
] as const;

export const CREDIT_RANGES = [
  "780+",
  "740-779",
  "700-739",
  "660-699",
  "620-659",
  "Below 620",
  "Not sure",
] as const;

export const FUNDING_TIMELINES = [
  "ASAP",
  "2 weeks",
  "30 days",
  "45-60 days",
  "Flexible",
] as const;

export const APPLICATION_FIELD_KEYS = [
  "loanType",
  "transactionType",
  "firstName",
  "lastName",
  "email",
  "phone",
  "entityName",
  "entityType",
  "ownershipPercent",
  "propertyAddress",
  "propertyCity",
  "propertyState",
  "propertyZip",
  "propertyType",
  "units",
  "squareFootage",
  "occupancy",
  "purchasePrice",
  "currentValue",
  "loanAmount",
  "existingPayoff",
  "cashOutAmount",
  "estimatedArv",
  "rehabBudget",
  "monthlyRent",
  "noi",
  "landOwned",
  "landValue",
  "constructionBudget",
  "completedValue",
  "plansPermitsStatus",
  "creditRange",
  "experience",
  "liquidity",
  "netWorth",
  "underContract",
  "closingDate",
  "fundingTimeline",
  "borrowerComments",
  "loanOfficerNotes",
] as const;

export type ApplicationFieldKey = (typeof APPLICATION_FIELD_KEYS)[number];

export type ApplicationDraft = Record<ApplicationFieldKey, string>;

export function emptyApplicationDraft(): ApplicationDraft {
  return Object.fromEntries(
    APPLICATION_FIELD_KEYS.map((key) => [key, ""]),
  ) as ApplicationDraft;
}

export type ApplicationFieldVisibility = Record<ApplicationFieldKey, boolean>;
