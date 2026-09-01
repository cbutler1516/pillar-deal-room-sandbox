import { parsePositiveMoney } from "@/lib/ui/deal-presentation";

export type SubmissionMetric = {
  key: string;
  label: string;
  value: string;
  formula: string;
};

function ratio(numerator: number, denominator: number): number | null {
  if (denominator <= 0 || numerator <= 0) {
    return null;
  }
  return numerator / denominator;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 1000) / 10}%`;
}

export function submissionFinancialInputs(input: {
  loanAmount?: number | null;
  requestedLoan?: string | number | null;
  purchasePrice?: string | number | null;
  rehabBudget?: string | number | null;
  estimatedArv?: string | number | null;
  currentValue?: string | number | null;
}): {
  loan: number | null;
  purchase: number | null;
  rehab: number | null;
  arv: number | null;
  value: number | null;
} {
  return {
    loan:
      parsePositiveMoney(input.loanAmount) ??
      parsePositiveMoney(input.requestedLoan),
    purchase: parsePositiveMoney(input.purchasePrice),
    rehab: parsePositiveMoney(input.rehabBudget),
    arv: parsePositiveMoney(input.estimatedArv),
    value: parsePositiveMoney(input.currentValue),
  };
}

export function deriveSubmissionMetrics(input: {
  loan: number | null;
  purchase: number | null;
  rehab: number | null;
  arv: number | null;
  value: number | null;
}): SubmissionMetric[] {
  const metrics: SubmissionMetric[] = [];
  const loan = input.loan;
  if (loan == null) {
    return metrics;
  }

  const basis = input.value ?? input.purchase;
  const ltv = basis != null ? ratio(loan, basis) : null;
  if (ltv != null) {
    metrics.push({
      key: "ltv",
      label: "LTV",
      value: formatPercent(ltv),
      formula: "Requested loan ÷ property value or purchase price",
    });
  }

  const cost =
    input.purchase != null
      ? input.purchase + (input.rehab ?? 0)
      : null;
  const ltc = cost != null ? ratio(loan, cost) : null;
  if (ltc != null) {
    metrics.push({
      key: "ltc",
      label: "LTC",
      value: formatPercent(ltc),
      formula: "Requested loan ÷ (purchase price + rehab budget)",
    });
  }

  const vsPurchase =
    input.purchase != null ? ratio(loan, input.purchase) : null;
  if (vsPurchase != null) {
    metrics.push({
      key: "loan_purchase",
      label: "Loan / purchase",
      value: formatPercent(vsPurchase),
      formula: "Requested loan ÷ purchase price",
    });
  }

  const vsArv = input.arv != null ? ratio(loan, input.arv) : null;
  if (vsArv != null) {
    metrics.push({
      key: "loan_arv",
      label: "Loan / ARV",
      value: formatPercent(vsArv),
      formula: "Requested loan ÷ ARV",
    });
  }

  return metrics;
}
