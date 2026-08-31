import { listPlaybooks } from "@/lib/playbooks/registry";

export type TaxonomyEntry = {
  documentType: string;
  aliases: string[];
  periodSensitive: boolean;
};

const EXTRA_ALIASES: Record<string, string[]> = {
  "Bank Statements": [
    "bank statement",
    "chase statement",
    "wells fargo statement",
    "proof of funds",
  ],
  "Pay Stubs": ["paystub", "pay-stub"],
  "Government-issued ID": ["drivers license", "driver license", "passport"],
  "Entity Documents": [
    "articles",
    "operating agreement",
    "articles of organization",
  ],
  "Purchase Agreement": ["psa", "purchase contract"],
  "Mortgage Statement": ["mortgage statement"],
  Appraisal: ["appraisal report"],
  T12: ["t-12", "trailing 12"],
  Insurance: ["binder", "dec page", "hazard insurance"],
  "Insurance Invoice": ["insurance invoice"],
};

const PERIOD_SENSITIVE = new Set([
  "Bank Statements",
  "Pay Stubs",
  "Mortgage Statement",
  "Insurance Invoice",
  "T12",
  "Rent Roll",
  "Lease / Rent Schedule",
]);

export function documentTypeTaxonomy(): TaxonomyEntry[] {
  const byType = new Map<string, Set<string>>();
  for (const playbook of listPlaybooks()) {
    const type = playbook.needDocumentType;
    if (!type) continue;
    const aliases = byType.get(type) ?? new Set<string>();
    aliases.add(type.toLowerCase());
    for (const alias of playbook.needMatchAliases ?? []) {
      aliases.add(alias.toLowerCase());
    }
    for (const extra of EXTRA_ALIASES[type] ?? []) {
      aliases.add(extra.toLowerCase());
    }
    byType.set(type, aliases);
  }
  return [...byType.entries()].map(([documentType, aliases]) => ({
    documentType,
    aliases: [...aliases].sort((a, b) => b.length - a.length),
    periodSensitive: PERIOD_SENSITIVE.has(documentType),
  }));
}

export function normalizeMetadataText(value: string): string {
  return value
    .toLowerCase()
    .replace(/\.[a-z0-9]{2,8}$/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function typesMatch(left: string | null, right: string | null): boolean {
  if (!left || !right) return false;
  const a = normalizeMetadataText(left);
  const b = normalizeMetadataText(right);
  if (a === b) return true;
  return a.includes(b) || b.includes(a);
}

export function isPeriodSensitiveType(documentType: string | null): boolean {
  if (!documentType) return false;
  return documentTypeTaxonomy().some(
    (entry) =>
      entry.periodSensitive && typesMatch(entry.documentType, documentType),
  );
}
