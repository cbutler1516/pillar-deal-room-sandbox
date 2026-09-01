import { AI_ASSIST_DISCLAIMER } from "@/lib/ai/types";
import type { DealSummarySection } from "@/lib/submission/summary";
import type { SubmissionManifestItem } from "@/lib/submission/manifest";

const FORBIDDEN =
  /\b(approved|qualified|eligible|likely approval|risk score|interest rate|lender selected|(i('ll| will)|we will|will) send|wire|ssn|social security|account number|password|token|secret)\b/gi;
const RATE = /\b\d+(\.\d+)?\s*%/;

function fieldValue(sections: DealSummarySection[], label: string): string {
  for (const section of sections) {
    const row = section.fields.find((field) => field.label === label);
    if (row) {
      return row.value;
    }
  }
  return "Not provided";
}

function highlights(sections: DealSummarySection[]): string[] {
  const rows: string[] = [];
  const loanType = fieldValue(sections, "Loan type");
  const purpose = fieldValue(sections, "Purpose");
  const amount = fieldValue(sections, "Requested amount");
  if (loanType !== "Not provided") {
    rows.push(`Business-purpose ${loanType} request.`);
  }
  if (purpose !== "Not provided") {
    rows.push(purpose);
  }
  if (amount !== "Not provided") {
    rows.push(`Requested loan ${amount}.`);
  }
  return rows.slice(0, 3);
}

export function isCopySafeSubmissionText(value: string): boolean {
  return (
    !/\b(approved|qualified|eligible|likely approval|risk score|interest rate|lender selected|(i('ll| will)|we will|will) send|wire|ssn|social security|account number|password|token|secret)\b/i.test(
      value,
    ) && !/\b(ssn|password|token|secret|portal)\b/i.test(value)
  );
}

export function buildSubmissionEmail(input: {
  borrowerName: string;
  loanType: string | null;
  propertyAddress: string | null;
  propertyCity: string | null;
  propertyState: string | null;
  sections: DealSummarySection[];
  manifest: SubmissionManifestItem[];
}): { subject: string; body: string } {
  const location = [
    input.propertyAddress,
    [input.propertyCity, input.propertyState].filter(Boolean).join(", "),
  ]
    .filter(Boolean)
    .join(", ");
  const subject = [
    input.loanType?.trim() || "Business-purpose",
    "Submission",
    "—",
    input.borrowerName.trim(),
    location ? `— ${location}` : "",
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+—\s+$/, "");

  const bullets = highlights(input.sections);
  const docs =
    input.manifest.length === 0
      ? "No approved, linked documents are in the submission package yet."
      : input.manifest
          .map((item) => `- ${item.fileName} (${item.documentType})`)
          .join("\n");

  const body = [
    "Hello,",
    "",
    "Please see the attached submission for the following business-purpose loan opportunity.",
    "",
    `Borrower/Entity: ${fieldValue(input.sections, "Borrower")}${
      fieldValue(input.sections, "Entity") !== "Not provided"
        ? ` / ${fieldValue(input.sections, "Entity")}`
        : ""
    }`,
    `Property: ${fieldValue(input.sections, "Address")}`,
    `Loan Purpose: ${fieldValue(input.sections, "Purpose")}`,
    `Requested Loan: ${fieldValue(input.sections, "Requested amount")}`,
    `Purchase Price: ${fieldValue(input.sections, "Purchase price")}`,
    `Rehab Budget: ${fieldValue(input.sections, "Rehab budget")}`,
    `ARV: ${fieldValue(input.sections, "ARV / value")}`,
    `Closing Timeline: ${fieldValue(input.sections, "Closing timeline")}`,
    "",
    "Highlights:",
    ...(bullets.length > 0 ? bullets.map((item) => `- ${item}`) : ["- Facts above are taken from the file. No underwriting conclusion is implied."]),
    "",
    "The supporting documents currently included in the submission package are listed below.",
    docs,
    "",
    "Please let us know if you have any initial questions or additional requirements.",
    "",
    "Thank you,",
    "",
    "Pillar Private Lending",
  ].join("\n");

  return { subject, body };
}

export function polishSubmissionEmail(body: string): {
  body: string;
  suggestion: true;
} {
  const cleaned = body
    .replace(FORBIDDEN, "")
    .replace(RATE, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .trim();
  return {
    body: `${cleaned}\n\n${AI_ASSIST_DISCLAIMER}`,
    suggestion: true,
  };
}
