export const REQUEST_TEMPLATE_VARS = [
  "borrower_name",
  "entity_name",
  "property_address",
  "loan_type",
  "deal_reference",
  "contact_name",
  "expected_document_count",
  "expected_months",
] as const;

export type RequestTemplateVar = (typeof REQUEST_TEMPLATE_VARS)[number];

export type RequestTemplateContext = Partial<
  Record<RequestTemplateVar, string | number | null | undefined>
>;

const DEFAULTS: Partial<Record<RequestTemplateVar, string>> = {
  expected_months: "2",
  expected_document_count: "2",
};

const MUSTACHE_PATTERN = /\{\{\s*([a-z_]+)\s*\}\}/gi;
const DOLLAR_PATTERN = /\$\{\s*([a-z_]+)\s*\}/gi;
const BRACKET_PATTERN = /\[([a-z_]+)\]/gi;
const UNRESOLVED_TOKEN =
  /(\{\{\s*[a-z_]+\s*\}\}|\$\{\s*[a-z_]+\s*\}|\[[a-z_]+\])/i;

export function isRequestTemplateVar(value: string): value is RequestTemplateVar {
  return (REQUEST_TEMPLATE_VARS as readonly string[]).includes(value);
}

function contextValue(
  key: string,
  context: RequestTemplateContext,
): string | null {
  if (!isRequestTemplateVar(key)) {
    return null;
  }
  const raw = context[key];
  if (raw != null && String(raw).trim() !== "") {
    return String(raw).trim();
  }
  return DEFAULTS[key] ?? null;
}

function replaceKnownTokens(
  template: string,
  context: RequestTemplateContext,
): string {
  const replace = (_match: string, rawKey: string) => {
    const value = contextValue(rawKey.toLowerCase(), context);
    return value ?? "";
  };
  return template
    .replace(MUSTACHE_PATTERN, replace)
    .replace(DOLLAR_PATTERN, replace)
    .replace(BRACKET_PATTERN, replace);
}

function tidyRenderedText(text: string): string {
  return text
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/([,;]){2,}/g, "$1")
    .replace(/\(\s*\)/g, "")
    .replace(/\s+\./g, ".")
    .replace(/\s+(to|for|from|with|at|on)\.?$/gi, "")
    .replace(/^\s*[,.;:]\s*/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function hasUnresolvedPlaybookPlaceholder(text: string): boolean {
  return UNRESOLVED_TOKEN.test(text);
}

export function renderRequestTemplate(
  template: string | null | undefined,
  context: RequestTemplateContext,
): string {
  if (!template) {
    return "";
  }
  const rendered = tidyRenderedText(replaceKnownTokens(template, context));
  if (hasUnresolvedPlaybookPlaceholder(rendered)) {
    return tidyRenderedText(rendered.replace(UNRESOLVED_TOKEN, ""));
  }
  return rendered;
}

export function requestSummaryFromTemplate(rendered: string): string {
  if (!rendered) {
    return "";
  }
  const first = rendered.split(/(?<=\.)\s/)[0] ?? rendered;
  return first.trim();
}

export function templateContextFromDeal(input: {
  borrowerName?: string | null;
  entityName?: string | null;
  propertyAddress?: string | null;
  propertyCity?: string | null;
  propertyState?: string | null;
  loanType?: string | null;
  dealReference?: string | null;
  contactName?: string | null;
  expectedDocumentCount?: number | null;
}): RequestTemplateContext {
  const address = [input.propertyAddress, input.propertyCity, input.propertyState]
    .filter(Boolean)
    .join(", ");
  const count = input.expectedDocumentCount ?? 2;
  return {
    borrower_name: input.borrowerName,
    entity_name: input.entityName,
    property_address: address || input.propertyAddress,
    loan_type: input.loanType,
    deal_reference: input.dealReference,
    contact_name: input.contactName,
    expected_document_count: count,
    expected_months: count,
  };
}
