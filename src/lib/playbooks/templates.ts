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

const VAR_PATTERN = /\{\{\s*([a-z_]+)\s*\}\}/gi;

export function isRequestTemplateVar(value: string): value is RequestTemplateVar {
  return (REQUEST_TEMPLATE_VARS as readonly string[]).includes(value);
}

export function renderRequestTemplate(
  template: string | null | undefined,
  context: RequestTemplateContext,
): string {
  if (!template) {
    return "";
  }
  return template.replace(VAR_PATTERN, (_match, rawKey: string) => {
    const key = rawKey.toLowerCase();
    if (!isRequestTemplateVar(key)) {
      return `[${key}]`;
    }
    const value = context[key];
    if (value == null || String(value).trim() === "") {
      return `[${key}]`;
    }
    return String(value).trim();
  });
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
  const count = input.expectedDocumentCount;
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
