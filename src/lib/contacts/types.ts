export const CONTACT_TYPES = [
  "borrower",
  "co_borrower",
  "title",
  "insurance",
  "escrow",
  "closing_attorney",
  "appraiser",
  "contractor",
  "property_manager",
  "cpa",
  "lender",
  "realtor",
  "loan_officer",
  "other",
] as const;

export type ContactType = (typeof CONTACT_TYPES)[number];

export const CONTACT_GROUPS = [
  {
    key: "borrower_sponsor",
    label: "Borrower / Sponsor",
    types: ["borrower", "co_borrower"] as const,
  },
  {
    key: "title_closing",
    label: "Title / Closing",
    types: ["title", "escrow", "closing_attorney"] as const,
  },
  {
    key: "insurance",
    label: "Insurance",
    types: ["insurance"] as const,
  },
  {
    key: "valuation",
    label: "Valuation",
    types: ["appraiser"] as const,
  },
  {
    key: "contractor",
    label: "Contractor",
    types: ["contractor"] as const,
  },
  {
    key: "property_management",
    label: "Property Management",
    types: ["property_manager"] as const,
  },
  {
    key: "other",
    label: "Other",
    types: ["cpa", "lender", "realtor", "loan_officer", "other"] as const,
  },
] as const;

export const CONTACT_MISSING = "contact_missing";

export type DealContactRow = {
  id: string;
  dealId: string;
  contactType: ContactType;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  isPrimary: boolean;
  archivedAt: string | null;
};

export function isContactType(value: string): value is ContactType {
  return (CONTACT_TYPES as readonly string[]).includes(value);
}

export function contactTypeLabel(type: string): string {
  return type.replaceAll("_", " ");
}
