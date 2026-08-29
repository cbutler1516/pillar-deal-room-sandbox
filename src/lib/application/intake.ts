import { applicationFieldVisibility } from "@/lib/application/fields";
import type { ApplicationDraft } from "@/lib/application/types";

export const INTAKE_SCHEMA_VERSION = 1;

export type ApplicationIntake = {
  version: number;
  source: "sandbox_application";
  transaction: string | null;
  propertyType: string | null;
  fundingTimeline: string | null;
  underContract: string | null;
  targetClosingDate: string | null;
  borrowerNotes: string | null;
  loanOfficerNotes: string | null;
  purchasePrice: string | null;
  currentValue: string | null;
  requestedLoan: string | null;
  existingPayoff: string | null;
  cashOutAmount: string | null;
  estimatedArv: string | null;
  rehabBudget: string | null;
  experience: string | null;
  monthlyRent: string | null;
  landOwned: string | null;
  landValue: string | null;
  constructionBudget: string | null;
  completedValue: string | null;
  plansPermitsStatus: string | null;
  units: string | null;
  squareFootage: string | null;
  occupancy: string | null;
  noi: string | null;
  creditRange: string | null;
  liquidity: string | null;
  netWorth: string | null;
  propertyZip: string | null;
};

type IntakeField = {
  key: keyof ApplicationIntake;
  label: string;
  group: "common" | "flip" | "dscr" | "construction" | "commercial";
};

const INTAKE_FIELDS: IntakeField[] = [
  { key: "transaction", label: "Transaction", group: "common" },
  { key: "propertyType", label: "Property type", group: "common" },
  { key: "fundingTimeline", label: "Funding timeline", group: "common" },
  { key: "underContract", label: "Under contract", group: "common" },
  { key: "targetClosingDate", label: "Target closing", group: "common" },
  { key: "borrowerNotes", label: "Borrower notes", group: "common" },
  { key: "purchasePrice", label: "Purchase price", group: "flip" },
  { key: "requestedLoan", label: "Requested loan", group: "flip" },
  { key: "estimatedArv", label: "ARV", group: "flip" },
  { key: "rehabBudget", label: "Rehab budget", group: "flip" },
  { key: "experience", label: "Experience", group: "flip" },
  { key: "currentValue", label: "Purchase / current value", group: "dscr" },
  { key: "requestedLoan", label: "Requested loan", group: "dscr" },
  { key: "existingPayoff", label: "Current payoff", group: "dscr" },
  { key: "monthlyRent", label: "Monthly rent", group: "dscr" },
  { key: "cashOutAmount", label: "Cash-out amount", group: "dscr" },
  { key: "landOwned", label: "Land ownership", group: "construction" },
  { key: "landValue", label: "Land value", group: "construction" },
  { key: "constructionBudget", label: "Construction budget", group: "construction" },
  { key: "completedValue", label: "Completed value", group: "construction" },
  { key: "plansPermitsStatus", label: "Plans / permits", group: "construction" },
  { key: "units", label: "Units", group: "commercial" },
  { key: "squareFootage", label: "Square footage", group: "commercial" },
  { key: "occupancy", label: "Occupancy", group: "commercial" },
  { key: "noi", label: "NOI", group: "commercial" },
  { key: "currentValue", label: "Purchase / current value", group: "commercial" },
  { key: "requestedLoan", label: "Requested amount", group: "commercial" },
];

function blankToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function applicationIntakeFromDraft(
  draft: ApplicationDraft,
): ApplicationIntake {
  return {
    version: INTAKE_SCHEMA_VERSION,
    source: "sandbox_application",
    transaction: blankToNull(draft.transactionType),
    propertyType: blankToNull(draft.propertyType),
    fundingTimeline: blankToNull(draft.fundingTimeline),
    underContract: blankToNull(draft.underContract),
    targetClosingDate: blankToNull(draft.closingDate),
    borrowerNotes: blankToNull(draft.borrowerComments),
    loanOfficerNotes: blankToNull(draft.loanOfficerNotes),
    purchasePrice: blankToNull(draft.purchasePrice),
    currentValue: blankToNull(draft.currentValue),
    requestedLoan: blankToNull(draft.loanAmount),
    existingPayoff: blankToNull(draft.existingPayoff),
    cashOutAmount: blankToNull(draft.cashOutAmount),
    estimatedArv: blankToNull(draft.estimatedArv),
    rehabBudget: blankToNull(draft.rehabBudget),
    experience: blankToNull(draft.experience),
    monthlyRent: blankToNull(draft.monthlyRent),
    landOwned: blankToNull(draft.landOwned),
    landValue: blankToNull(draft.landValue),
    constructionBudget: blankToNull(draft.constructionBudget),
    completedValue: blankToNull(draft.completedValue),
    plansPermitsStatus: blankToNull(draft.plansPermitsStatus),
    units: blankToNull(draft.units),
    squareFootage: blankToNull(draft.squareFootage),
    occupancy: blankToNull(draft.occupancy),
    noi: blankToNull(draft.noi),
    creditRange: blankToNull(draft.creditRange),
    liquidity: blankToNull(draft.liquidity),
    netWorth: blankToNull(draft.netWorth),
    propertyZip: blankToNull(draft.propertyZip),
  };
}

export function isApplicationIntake(
  value: unknown,
): value is ApplicationIntake {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      (value as ApplicationIntake).source === "sandbox_application",
  );
}

export function applicationIntakeFromUnknown(
  value: unknown,
): ApplicationIntake | null {
  if (isApplicationIntake(value)) {
    return value;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const row = value as Record<string, unknown>;
  if (!row.transaction && !row.property_type && !row.propertyType) {
    return null;
  }
  return {
    version: INTAKE_SCHEMA_VERSION,
    source: "sandbox_application",
    transaction: blankToNull(String(row.transaction ?? row.transactionType ?? "")),
    propertyType: blankToNull(
      String(row.propertyType ?? row.property_type ?? ""),
    ),
    fundingTimeline: blankToNull(
      String(row.fundingTimeline ?? row.timeline ?? ""),
    ),
    underContract: blankToNull(String(row.underContract ?? row.under_contract ?? "")),
    targetClosingDate: blankToNull(
      String(row.targetClosingDate ?? row.closing_date ?? ""),
    ),
    borrowerNotes: blankToNull(
      String(row.borrowerNotes ?? row.borrower_comments ?? ""),
    ),
    loanOfficerNotes: blankToNull(
      String(row.loanOfficerNotes ?? row.loan_officer_notes ?? ""),
    ),
    purchasePrice: blankToNull(
      String(row.purchasePrice ?? row.purchase_price ?? ""),
    ),
    currentValue: blankToNull(String(row.currentValue ?? row.current_value ?? "")),
    requestedLoan: blankToNull(
      String(row.requestedLoan ?? row.loan_amount ?? ""),
    ),
    existingPayoff: blankToNull(
      String(row.existingPayoff ?? row.existing_payoff ?? ""),
    ),
    cashOutAmount: blankToNull(String(row.cashOutAmount ?? row.cash_out ?? "")),
    estimatedArv: blankToNull(String(row.estimatedArv ?? row.estimated_arv ?? "")),
    rehabBudget: blankToNull(String(row.rehabBudget ?? row.rehab_budget ?? "")),
    experience: blankToNull(String(row.experience ?? "")),
    monthlyRent: blankToNull(String(row.monthlyRent ?? row.monthly_rent ?? "")),
    landOwned: blankToNull(String(row.landOwned ?? row.land_owned ?? "")),
    landValue: blankToNull(String(row.landValue ?? row.land_value ?? "")),
    constructionBudget: blankToNull(
      String(row.constructionBudget ?? row.construction_budget ?? ""),
    ),
    completedValue: blankToNull(
      String(row.completedValue ?? row.completed_value ?? ""),
    ),
    plansPermitsStatus: blankToNull(
      String(row.plansPermitsStatus ?? row.plans_permits ?? ""),
    ),
    units: blankToNull(String(row.units ?? "")),
    squareFootage: blankToNull(
      String(row.squareFootage ?? row.square_footage ?? ""),
    ),
    occupancy: blankToNull(String(row.occupancy ?? "")),
    noi: blankToNull(String(row.noi ?? "")),
    creditRange: blankToNull(String(row.creditRange ?? row.credit_range ?? "")),
    liquidity: blankToNull(String(row.liquidity ?? "")),
    netWorth: blankToNull(String(row.netWorth ?? row.net_worth ?? "")),
    propertyZip: blankToNull(String(row.propertyZip ?? row.property_zip ?? "")),
  };
}

export type IntakeDisplayGroup = {
  title: string;
  rows: { key: string; label: string; value: string }[];
};

function groupTitle(
  group: IntakeField["group"],
  loanType: string | null,
): string | null {
  const loan = (loanType ?? "").toLowerCase();
  if (group === "common") {
    return "Application details";
  }
  if (group === "flip" && (loan.includes("flip") || loan.includes("bridge"))) {
    return "Fix & Flip";
  }
  if (group === "dscr" && loan.includes("dscr")) {
    return "DSCR";
  }
  if (
    group === "construction" &&
    (loan.includes("construction") || loan.includes("ground"))
  ) {
    return "Construction";
  }
  if (
    group === "commercial" &&
    (loan.includes("commercial") || loan.includes("multifamily"))
  ) {
    return "Commercial / Multifamily";
  }
  return null;
}

export function intakeDisplayGroups(
  intake: ApplicationIntake,
  loanType: string | null,
): IntakeDisplayGroup[] {
  const visibility = applicationFieldVisibility(
    loanType ?? "",
    intake.transaction ?? "",
  );
  const seen = new Set<string>();
  const groups: IntakeDisplayGroup[] = [];

  for (const field of INTAKE_FIELDS) {
    const title = groupTitle(field.group, loanType);
    if (!title) {
      continue;
    }
    const raw = intake[field.key];
    const value = typeof raw === "string" ? raw : raw != null ? String(raw) : "";
    if (!value || seen.has(`${field.group}:${field.key}`)) {
      continue;
    }
    if (field.key === "requestedLoan" && !visibility.loanAmount) {
      continue;
    }
    seen.add(`${field.group}:${field.key}`);
    let group = groups.find((item) => item.title === title);
    if (!group) {
      group = { title, rows: [] };
      groups.push(group);
    }
    group.rows.push({
      key: `${field.group}-${field.key}`,
      label: field.label,
      value,
    });
  }

  return groups.filter((group) => group.rows.length > 0);
}

export function isFundingClose(intake: ApplicationIntake | null): boolean {
  const timeline = intake?.fundingTimeline?.toLowerCase() ?? "";
  return timeline.includes("asap") || timeline.includes("2 week");
}
