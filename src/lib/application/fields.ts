import {
  APPLICATION_FIELD_KEYS,
  APPLICATION_LOAN_TYPES,
  type ApplicationDraft,
  type ApplicationFieldKey,
  type ApplicationFieldVisibility,
  type ApplicationLoanType,
} from "@/lib/application/types";

const ALWAYS_ON: ApplicationFieldKey[] = [
  "loanType",
  "transactionType",
  "firstName",
  "lastName",
  "email",
  "phone",
  "entityName",
  "entityType",
  "propertyAddress",
  "propertyCity",
  "propertyState",
  "propertyZip",
  "propertyType",
  "loanAmount",
  "creditRange",
  "experience",
  "underContract",
  "fundingTimeline",
  "borrowerComments",
  "loanOfficerNotes",
];

function setVisible(
  visibility: ApplicationFieldVisibility,
  keys: ApplicationFieldKey[],
) {
  for (const key of keys) {
    visibility[key] = true;
  }
}

export function isApplicationLoanType(value: string): value is ApplicationLoanType {
  return (APPLICATION_LOAN_TYPES as readonly string[]).includes(value);
}

export function applicationFieldVisibility(
  loanType: string,
  transactionType: string,
): ApplicationFieldVisibility {
  const visibility = Object.fromEntries(
    APPLICATION_FIELD_KEYS.map((key) => [key, false]),
  ) as ApplicationFieldVisibility;

  setVisible(visibility, ALWAYS_ON);

  const loan = loanType.toLowerCase();
  const txn = transactionType.toLowerCase();
  const purchase = txn.includes("purchase") || loan.includes("purchase") || loan.includes("flip");
  const refinance = txn.includes("refi") || loan.includes("refi");

  if (loan.includes("flip") || loan.includes("bridge")) {
    setVisible(visibility, [
      "purchasePrice",
      "estimatedArv",
      "rehabBudget",
      "experience",
      "liquidity",
      "closingDate",
    ]);
  }
  if (loan.includes("dscr") && refinance) {
    setVisible(visibility, [
      "currentValue",
      "existingPayoff",
      "cashOutAmount",
      "monthlyRent",
      "propertyType",
      "units",
    ]);
  } else if (loan.includes("dscr")) {
    setVisible(visibility, ["purchasePrice", "monthlyRent", "propertyType", "units"]);
  }
  if (loan.includes("construction") || loan.includes("ground")) {
    setVisible(visibility, [
      "landOwned",
      "landValue",
      "constructionBudget",
      "completedValue",
      "plansPermitsStatus",
      "liquidity",
    ]);
  }
  if (loan.includes("commercial") || loan.includes("multifamily")) {
    setVisible(visibility, [
      "units",
      "squareFootage",
      "occupancy",
      "noi",
      "netWorth",
      "experience",
      purchase ? "purchasePrice" : "currentValue",
    ]);
  }
  if (purchase) {
    visibility.purchasePrice = true;
  }
  if (refinance) {
    visibility.currentValue = true;
    visibility.existingPayoff = true;
  }
  if (txn.includes("cash-out")) {
    visibility.cashOutAmount = true;
  }

  visibility.ownershipPercent = Boolean(visibility.entityName);
  return visibility;
}

export function visibleDraft(
  draft: ApplicationDraft,
  visibility: ApplicationFieldVisibility,
): Partial<ApplicationDraft> {
  const next: Partial<ApplicationDraft> = {};
  for (const key of Object.keys(draft) as ApplicationFieldKey[]) {
    if (visibility[key]) {
      next[key] = draft[key];
    }
  }
  return next;
}

export function defaultTransactionForLoanType(loanType: string): string {
  const value = loanType.toLowerCase();
  if (value.includes("refi")) {
    return "refinance";
  }
  if (value.includes("construction") || value.includes("ground")) {
    return "construction";
  }
  if (value.includes("bridge")) {
    return "bridge";
  }
  return "purchase";
}
