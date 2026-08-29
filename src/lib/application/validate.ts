import { applicationFieldVisibility } from "@/lib/application/fields";
import {
  APPLICATION_LOAN_TYPES,
  APPLICATION_TRANSACTIONS,
  type ApplicationDraft,
} from "@/lib/application/types";

export type ApplicationValidation =
  | { ok: true; value: ApplicationDraft }
  | { ok: false; error: string };

function required(value: string, label: string): string | null {
  return value.trim() ? null : `Enter ${label}.`;
}

function optionalNumber(value: string, label: string): string | null {
  if (!value.trim()) {
    return null;
  }
  const parsed = Number(value.replaceAll(",", ""));
  if (!Number.isFinite(parsed) || parsed < 0) {
    return `Enter a valid ${label}.`;
  }
  return null;
}

export function validateApplication(input: ApplicationDraft): ApplicationValidation {
  const loanType = input.loanType.trim();
  if (!(APPLICATION_LOAN_TYPES as readonly string[]).includes(loanType)) {
    return { ok: false, error: "Choose a loan type." };
  }
  if (!(APPLICATION_TRANSACTIONS as readonly string[]).includes(input.transactionType)) {
    return { ok: false, error: "Choose a transaction type." };
  }

  const visibility = applicationFieldVisibility(loanType, input.transactionType);
  const checks: Array<[string, string | null]> = [
    ["first name", required(input.firstName, "a first name")],
    ["last name", required(input.lastName, "a last name")],
    ["email", required(input.email, "an email")],
    ["phone", required(input.phone, "a phone number")],
    ["address", required(input.propertyAddress, "a property address")],
    ["city", required(input.propertyCity, "a city")],
    ["state", required(input.propertyState, "a state")],
    ["loan amount", required(input.loanAmount, "a requested loan amount")],
    ["loan amount number", optionalNumber(input.loanAmount, "loan amount")],
    ["purchase price", visibility.purchasePrice ? optionalNumber(input.purchasePrice, "purchase price") : null],
    ["current value", visibility.currentValue ? optionalNumber(input.currentValue, "current value") : null],
    ["payoff", visibility.existingPayoff ? optionalNumber(input.existingPayoff, "existing payoff") : null],
  ];

  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
    return { ok: false, error: "Enter a valid email." };
  }

  for (const [, error] of checks) {
    if (error) {
      return { ok: false, error };
    }
  }

  return { ok: true, value: { ...input, loanType } };
}

export function parseMoney(value: string): number | null {
  if (!value.trim()) {
    return null;
  }
  const parsed = Number(value.replaceAll(",", ""));
  return Number.isFinite(parsed) ? parsed : null;
}
