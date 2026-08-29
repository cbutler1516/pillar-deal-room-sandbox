/** Baseline processor tasks for DSCR purchase and refinance. */
export const DSCR_COMMON_BASELINE_KEYS = [
  "request_government_id",
  "request_lease_rent_schedule",
  "request_insurance_binder",
  "request_entity_documents",
  "request_bank_statements",
] as const;

export const DSCR_PURCHASE_BASELINE_KEYS = [
  ...DSCR_COMMON_BASELINE_KEYS,
  "request_purchase_agreement",
  "prepare_submission",
] as const;

export const DSCR_REFINANCE_BASELINE_KEYS = [
  ...DSCR_COMMON_BASELINE_KEYS,
  "request_mortgage_statement",
  "prepare_submission",
] as const;
