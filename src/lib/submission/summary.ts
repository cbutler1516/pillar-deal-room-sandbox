import { applicationIntakeFromUnknown } from "@/lib/application/intake";
import { formatCurrency } from "@/lib/format";
import {
  deriveSubmissionMetrics,
  submissionFinancialInputs,
  type SubmissionMetric,
} from "@/lib/submission/metrics";
import { parsePositiveMoney } from "@/lib/ui/deal-presentation";

export type SummaryField = {
  label: string;
  value: string;
};

export type DealSummarySection = {
  title: string;
  fields: SummaryField[];
};

function display(value: string | number | null | undefined): string {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return formatCurrency(value);
  }
  const text = typeof value === "string" ? value.trim() : "";
  return text || "Not provided";
}

function money(value: string | number | null | undefined): string {
  const parsed = parsePositiveMoney(value);
  return parsed == null ? "Not provided" : formatCurrency(parsed);
}

export function buildDealSummary(input: {
  borrowerName: string;
  entityName: string | null;
  loanType: string | null;
  loanPurpose: string | null;
  loanAmount: number | null;
  propertyAddress: string | null;
  propertyCity: string | null;
  propertyState: string | null;
  propertyType: string | null;
  experience: string | null;
  creditBand: string | null;
  intake?: unknown;
}): {
  sections: DealSummarySection[];
  metrics: SubmissionMetric[];
} {
  const intake = applicationIntakeFromUnknown(input.intake);
  const moneyInputs = submissionFinancialInputs({
    loanAmount: input.loanAmount,
    requestedLoan: intake?.requestedLoan,
    purchasePrice: intake?.purchasePrice,
    rehabBudget: intake?.rehabBudget,
    estimatedArv: intake?.estimatedArv,
    currentValue: intake?.currentValue,
  });

  const property = [
    input.propertyAddress,
    [input.propertyCity, input.propertyState].filter(Boolean).join(", "),
  ]
    .filter(Boolean)
    .join(", ");

  const sections: DealSummarySection[] = [
    {
      title: "Transaction",
      fields: [
        { label: "Loan type", value: display(input.loanType) },
        { label: "Purpose", value: display(input.loanPurpose) },
        { label: "Requested amount", value: money(moneyInputs.loan) },
        { label: "Purchase / refinance", value: display(intake?.transaction) },
        { label: "Closing timeline", value: display(intake?.fundingTimeline ?? intake?.targetClosingDate) },
      ],
    },
    {
      title: "Property",
      fields: [
        { label: "Address", value: display(property) },
        { label: "Property type", value: display(input.propertyType ?? intake?.propertyType) },
        { label: "Purchase price", value: money(moneyInputs.purchase) },
        { label: "ARV / value", value: money(moneyInputs.arv ?? moneyInputs.value) },
        { label: "Rehab budget", value: money(moneyInputs.rehab) },
      ],
    },
    {
      title: "Borrower",
      fields: [
        { label: "Borrower", value: display(input.borrowerName) },
        { label: "Entity", value: display(input.entityName) },
        { label: "Experience", value: display(input.experience ?? intake?.experience) },
        { label: "Credit range", value: display(input.creditBand ?? intake?.creditRange) },
      ],
    },
    {
      title: "Financial",
      fields: [
        { label: "Requested loan", value: money(moneyInputs.loan) },
        { label: "Purchase price", value: money(moneyInputs.purchase) },
        { label: "Rehab", value: money(moneyInputs.rehab) },
        { label: "Value / ARV", value: money(moneyInputs.arv ?? moneyInputs.value) },
      ],
    },
  ];

  return {
    sections,
    metrics: deriveSubmissionMetrics(moneyInputs),
  };
}

export function formatDealSummaryText(sections: DealSummarySection[]): string {
  return sections
    .map((section) => {
      const rows = section.fields
        .map((field) => `${field.label}: ${field.value}`)
        .join("\n");
      return `${section.title.toUpperCase()}\n${rows}`;
    })
    .join("\n\n");
}
