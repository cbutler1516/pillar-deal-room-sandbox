import { isContactType } from "@/lib/contacts/types";
import type { PlaybookDefinition } from "@/lib/playbooks/types";

function documentRequest(input: {
  playbookKey: string;
  title: string;
  sourceType: PlaybookDefinition["sourceType"];
  timing: PlaybookDefinition["timing"];
  priority?: PlaybookDefinition["priority"];
  instructions: string;
  completionSummary: string;
  alwaysRequired: boolean;
  needCategory?: string;
  needDocumentType?: string;
  needMatchAliases?: string[];
  followUpIntervalHours?: number;
  escalationAfterHours?: number;
  taskKind?: PlaybookDefinition["taskKind"];
  requestTemplate?: string;
  requestSummary?: string;
  requiresContact?: boolean;
  contactType?: PlaybookDefinition["contactType"];
  expectedDocumentCount?: number | null;
}): PlaybookDefinition {
  const requiresContact =
    input.requiresContact ?? input.sourceType !== "internal";
  return {
    playbookKey: input.playbookKey,
    title: input.title,
    sourceType: input.sourceType,
    taskKind: input.taskKind ?? "request_document",
    timing: input.timing,
    priority: input.priority ?? "normal",
    instructions: input.instructions,
    completionRule: {
      key: `${input.playbookKey}_complete`,
      summary: input.completionSummary,
      requiresLinkedNeed: Boolean(input.needDocumentType),
      requiresNeedApprovedOrAccepted: Boolean(input.needDocumentType),
      requiresDocumentLinked: Boolean(input.needDocumentType),
      requiresProcessorAccepted: true,
      autoUnderwrite: false,
    },
    followUpIntervalHours: input.followUpIntervalHours ?? 24,
    escalationAfterHours: input.escalationAfterHours ?? 48,
    createsClientNeed: Boolean(input.needDocumentType),
    alwaysRequired: input.alwaysRequired,
    requiresContact,
    contactType:
      input.contactType ??
      (requiresContact && isContactType(input.sourceType)
        ? input.sourceType
        : undefined),
    requestTemplate:
      input.requestTemplate ??
      `Please provide the requested item for {{property_address}}.`,
    requestSummary:
      input.requestSummary ??
      `Request the item for {{property_address}}.`,
    needCategory: input.needCategory,
    needDocumentType: input.needDocumentType,
    needMatchAliases: input.needMatchAliases,
    expectedDocumentCount: input.expectedDocumentCount ?? null,
  };
}

export const COMMON_PLAYBOOKS: PlaybookDefinition[] = [
  documentRequest({
    playbookKey: "request_government_id",
    title: "Request government-issued ID",
    sourceType: "borrower",
    timing: "required_now",
    alwaysRequired: true,
    needCategory: "Identity",
    needDocumentType: "Government-issued ID",
    needMatchAliases: ["government id", "driver license", "passport"],
    requestTemplate:
      "Please provide a current government-issued photo ID for the borrower on {{deal_reference}}.",
    requestSummary: "Request a government-issued photo ID.",
    instructions:
      "Request a current government-issued photo ID. Confirm the name matches the borrower. Link the file to the Government-issued ID Client Need. Follow up in 24 hours. Escalate to the LO after 48 hours.",
    completionSummary:
      "Complete when the ID is received, reviewed, and the Client Need is approved or explicitly accepted. This is not a KYC legal determination.",
  }),
  documentRequest({
    playbookKey: "request_construction_plans",
    title: "Request construction plans",
    sourceType: "borrower",
    timing: "required_now",
    alwaysRequired: false,
    needCategory: "Construction",
    needDocumentType: "Construction Plans",
    needMatchAliases: ["plans", "architectural"],
    instructions:
      "Request current construction plans. Confirm they are for this property. Link them to the Construction Plans Client Need. Follow up in 24 hours. Escalate to the LO after 48 hours.",
    completionSummary:
      "Complete when the plans are received, reviewed, and the Client Need is approved or explicitly accepted.",
  }),
  documentRequest({
    playbookKey: "request_construction_budget",
    title: "Request construction budget",
    sourceType: "borrower",
    timing: "required_now",
    alwaysRequired: false,
    needCategory: "Construction",
    needDocumentType: "Construction Budget",
    needMatchAliases: ["construction budget"],
    instructions:
      "Request a line-item construction budget. Confirm it covers the planned work. Link it to the Construction Budget Client Need. Follow up in 24 hours. Escalate to the LO after 48 hours.",
    completionSummary:
      "Complete when a usable budget is received, reviewed, and the Client Need is approved or explicitly accepted.",
  }),
  documentRequest({
    playbookKey: "request_permits",
    title: "Request permits status",
    sourceType: "borrower",
    timing: "required_now",
    alwaysRequired: false,
    needCategory: "Construction",
    needDocumentType: "Permits",
    needMatchAliases: ["permit"],
    instructions:
      "Request permit evidence or a written status. Confirm the property address. Link files to the Permits Client Need. Follow up in 24 hours. Escalate to the LO after 48 hours.",
    completionSummary:
      "Complete when permit evidence or status is received, reviewed, and the Client Need is approved or explicitly accepted.",
  }),
  documentRequest({
    playbookKey: "request_land_documentation",
    title: "Request land documentation",
    sourceType: "borrower",
    timing: "required_now",
    alwaysRequired: false,
    needCategory: "Legal",
    needDocumentType: "Land Documentation",
    needMatchAliases: ["land", "deed"],
    instructions:
      "Request evidence of land ownership or the land contract. Confirm the parcel matches the deal. Link it to the Land Documentation Client Need. Follow up in 24 hours. Escalate to the LO after 48 hours.",
    completionSummary:
      "Complete when land documentation is received, reviewed, and the Client Need is approved or explicitly accepted.",
  }),
  documentRequest({
    playbookKey: "request_construction_schedule",
    title: "Request construction schedule",
    sourceType: "borrower",
    timing: "required_later",
    alwaysRequired: false,
    needCategory: "Construction",
    needDocumentType: "Construction Schedule",
    needMatchAliases: ["construction schedule"],
    instructions:
      "Request a construction schedule. Confirm start and completion estimates. Link it to the Construction Schedule Client Need. Follow up in 24 hours. Escalate to the LO after 48 hours.",
    completionSummary:
      "Complete when the schedule is received, reviewed, and the Client Need is approved or explicitly accepted.",
  }),
  documentRequest({
    playbookKey: "request_bank_statements",
    title: "Request most recent bank statements",
    sourceType: "borrower",
    timing: "required_now",
    alwaysRequired: true,
    needCategory: "Liquidity",
    needDocumentType: "Bank Statements",
    needMatchAliases: ["bank statements", "liquidity"],
    expectedDocumentCount: 2,
    requestTemplate:
      "Please provide your most recent {{expected_months}} months of complete bank statements, including all pages.",
    requestSummary:
      "Request the most recent {{expected_months}} months of complete bank statements.",
    instructions:
      "Confirm the Client Need months (for example, most recent 2 months). Contact the borrower and request complete statements for each required month. When files arrive, verify every page is present, the account holder matches the borrower or entity, and the statement period is correct. Link each statement to the Bank Statements Client Need. If pages or months are missing, follow up the same day. If there is no complete package within 24 hours, follow up. Escalate to the LO after 48 hours.",
    completionSummary:
      "Complete when the expected statements are received, the processor has reviewed them, and the related Client Need is approved or explicitly accepted. This is not an underwriting decision.",
  }),
  documentRequest({
    playbookKey: "request_pay_stubs",
    title: "Request most recent pay stubs",
    sourceType: "borrower",
    timing: "required_now",
    alwaysRequired: false,
    needCategory: "Income",
    needDocumentType: "Pay Stubs",
    needMatchAliases: ["pay stub", "pay stubs"],
    expectedDocumentCount: 2,
    requestTemplate:
      "Please provide your most recent {{expected_document_count}} pay stubs.",
    requestSummary: "Request the most recent {{expected_document_count}} pay stubs.",
    instructions:
      "Confirm the lookback (for example, most recent 30 days). Request each stub covering that window. Check pay dates, employer name, and that YTD figures are readable. Link every stub to the Pay Stubs Client Need. Follow up if a date is missing. Escalate to the LO after 48 hours with no complete set.",
    completionSummary:
      "Complete when all expected stubs are received, reviewed, and the Pay Stubs Client Need is approved or explicitly accepted. No income conclusion is made here.",
  }),
  documentRequest({
    playbookKey: "request_entity_documents",
    title: "Request entity documents",
    sourceType: "borrower",
    timing: "required_now",
    alwaysRequired: true,
    needCategory: "Entity",
    needDocumentType: "Entity Documents",
    needMatchAliases: ["entity"],
    instructions:
      "Ask the borrower for articles, operating agreement, and good-standing evidence as applicable. Confirm the entity name matches the deal. Link each file to the Entity Documents Client Need. Follow up in 24 hours if the package is incomplete. Escalate to the LO after 48 hours.",
    completionSummary:
      "Complete when the entity package is received, reviewed, and the Entity Documents Client Need is approved or explicitly accepted.",
  }),
  documentRequest({
    playbookKey: "request_purchase_agreement",
    title: "Request purchase agreement",
    sourceType: "borrower",
    timing: "required_now",
    alwaysRequired: true,
    needCategory: "Legal",
    needDocumentType: "Purchase Agreement",
    needMatchAliases: ["purchase agreement", "psa"],
    instructions:
      "Request the fully executed purchase agreement. Confirm buyer, seller, property address, and signatures. Link the file to the Purchase Agreement Client Need. Follow up in 24 hours if unsigned or missing pages. Escalate to the LO after 48 hours.",
    completionSummary:
      "Complete when the executed agreement is received, reviewed, and the Purchase Agreement Client Need is approved or explicitly accepted.",
  }),
  documentRequest({
    playbookKey: "request_rehab_budget",
    title: "Request rehab budget",
    sourceType: "borrower",
    timing: "required_now",
    alwaysRequired: false,
    needCategory: "Rehab",
    needDocumentType: "Rehab Budget",
    needMatchAliases: ["rehab budget"],
    instructions:
      "Request a line-item rehab budget for this Fix & Flip. Confirm it covers the planned work and matches the property. Link it to the Rehab Budget Client Need. Follow up in 24 hours if only a lump sum is sent. Escalate to the LO after 48 hours.",
    completionSummary:
      "Complete when a usable budget is received, reviewed, and the Rehab Budget Client Need is approved or explicitly accepted.",
  }),
  documentRequest({
    playbookKey: "request_scope_of_work",
    title: "Request scope of work",
    sourceType: "borrower",
    timing: "required_now",
    alwaysRequired: false,
    needCategory: "Rehab",
    needDocumentType: "Scope of Work",
    needMatchAliases: ["scope of work"],
    instructions:
      "Request a written scope of work describing the rehab. Confirm it is property-specific. Link it to the Scope of Work Client Need. Follow up in 24 hours if it is generic or incomplete. Escalate to the LO after 48 hours.",
    completionSummary:
      "Complete when the scope is received, reviewed, and the Scope of Work Client Need is approved or explicitly accepted.",
  }),
  documentRequest({
    playbookKey: "request_lease_rent_schedule",
    title: "Request lease / rent schedule",
    sourceType: "borrower",
    timing: "required_now",
    alwaysRequired: false,
    needCategory: "Income",
    needDocumentType: "Lease / Rent Schedule",
    needMatchAliases: ["lease", "rent schedule"],
    instructions:
      "Request the current lease or rent schedule. Confirm tenant, rent amount, and property address. Link the file to the Lease / Rent Schedule Client Need. Follow up in 24 hours if unsigned or expired. Escalate to the LO after 48 hours.",
    completionSummary:
      "Complete when the lease/schedule is received, reviewed, and the related Client Need is approved or explicitly accepted. Do not calculate DSCR here.",
  }),
  documentRequest({
    playbookKey: "request_mortgage_statement",
    title: "Request mortgage statement",
    sourceType: "borrower",
    timing: "required_now",
    alwaysRequired: false,
    needCategory: "Debt",
    needDocumentType: "Mortgage Statement",
    needMatchAliases: ["mortgage statement"],
    instructions:
      "For refinance files, request the current mortgage statement. Confirm the property and unpaid balance are visible. Link it to the Mortgage Statement Client Need. Follow up in 24 hours. Escalate to the LO after 48 hours.",
    completionSummary:
      "Complete when the statement is received, reviewed, and the Mortgage Statement Client Need is approved or explicitly accepted.",
  }),
  documentRequest({
    playbookKey: "request_rent_roll",
    title: "Request rent roll",
    sourceType: "borrower",
    timing: "required_now",
    alwaysRequired: false,
    needCategory: "Income",
    needDocumentType: "Rent Roll",
    needMatchAliases: ["rent roll"],
    instructions:
      "Request a current rent roll. Confirm unit count and that occupied units show rent. Link it to the Rent Roll Client Need. Follow up in 24 hours if units are missing. Escalate to the LO after 48 hours.",
    completionSummary:
      "Complete when the rent roll is received, reviewed, and the Client Need is approved or explicitly accepted.",
  }),
  documentRequest({
    playbookKey: "request_t12",
    title: "Request T12",
    sourceType: "borrower",
    timing: "required_now",
    alwaysRequired: false,
    needCategory: "Financials",
    needDocumentType: "T12",
    needMatchAliases: ["t12"],
    instructions:
      "Request the trailing-12 operating statement. Confirm the property name and period. Link it to the T12 Client Need. Follow up in 24 hours if the period is wrong. Escalate to the LO after 48 hours.",
    completionSummary:
      "Complete when the T12 is received, reviewed, and the Client Need is approved or explicitly accepted. Do not underwrite cash flow here.",
  }),
  documentRequest({
    playbookKey: "request_pfs",
    title: "Request personal financial statement",
    sourceType: "borrower",
    timing: "required_now",
    alwaysRequired: false,
    needCategory: "Sponsor",
    needDocumentType: "PFS",
    needMatchAliases: ["pfs", "personal financial"],
    instructions:
      "Request the sponsor PFS. Confirm it is signed and dated. Link it to the PFS Client Need. Follow up in 24 hours if unsigned. Escalate to the LO after 48 hours.",
    completionSummary:
      "Complete when the PFS is received, reviewed, and the Client Need is approved or explicitly accepted.",
  }),
  documentRequest({
    playbookKey: "request_sreo",
    title: "Request schedule of real estate owned",
    sourceType: "borrower",
    timing: "required_now",
    alwaysRequired: false,
    needCategory: "Sponsor",
    needDocumentType: "Schedule of Real Estate Owned",
    needMatchAliases: ["sreo", "real estate owned"],
    instructions:
      "Request the SREO. Confirm properties and balances are listed. Link it to the SREO Client Need. Follow up in 24 hours if incomplete. Escalate to the LO after 48 hours.",
    completionSummary:
      "Complete when the SREO is received, reviewed, and the Client Need is approved or explicitly accepted.",
  }),
  documentRequest({
    playbookKey: "request_closing_protection_letter",
    title: "Request closing protection letter",
    sourceType: "title",
    taskKind: "contact_third_party",
    timing: "required_later",
    alwaysRequired: false,
    needCategory: "Title",
    needDocumentType: "Closing Protection Letter",
    needMatchAliases: ["cpl", "closing protection"],
    requestTemplate: "Please provide the Closing Protection Letter for {{property_address}}.",
    requestSummary: "Request the Closing Protection Letter for {{property_address}}.",
    instructions:
      "Identify the title contact. Request a Closing Protection Letter for this property and borrower/entity. When received, attach it to the deal and link it to the CPL Client Need if one exists. Review names, property, and file reference. If no response within 24 hours, follow up. Escalate to the LO after 48 hours.",
    completionSummary:
      "Complete when the CPL is received, linked, and the processor marks it accepted. This is not a title-insurance legal opinion.",
  }),
  documentRequest({
    playbookKey: "request_preliminary_title_report",
    title: "Request preliminary title report",
    sourceType: "title",
    taskKind: "contact_third_party",
    timing: "required_later",
    alwaysRequired: false,
    needCategory: "Title",
    needDocumentType: "Preliminary Title Report",
    needMatchAliases: ["title report", "prelim"],
    instructions:
      "Ask title for the preliminary title report. Confirm the legal description matches the deal property. Link the report to the Title Client Need when used. Follow up in 24 hours. Escalate to the LO after 48 hours.",
    completionSummary:
      "Complete when the prelim is received, linked if applicable, and the processor marks it accepted.",
  }),
  documentRequest({
    playbookKey: "request_property_tax_certificate",
    title: "Request property tax certificate",
    sourceType: "title",
    taskKind: "contact_third_party",
    timing: "required_later",
    alwaysRequired: false,
    needCategory: "Title",
    needDocumentType: "Property Tax Certificate",
    needMatchAliases: ["tax certificate"],
    instructions:
      "Request the property tax certificate from title. Confirm the parcel and address. Link it if a Client Need exists. Follow up in 24 hours. Escalate to the LO after 48 hours.",
    completionSummary:
      "Complete when the certificate is received and the processor marks it accepted.",
  }),
  documentRequest({
    playbookKey: "request_insurance_binder",
    title: "Request insurance binder",
    sourceType: "insurance",
    taskKind: "contact_third_party",
    timing: "required_now",
    alwaysRequired: false,
    needCategory: "Insurance",
    needDocumentType: "Insurance",
    needMatchAliases: ["insurance", "binder"],
    requestTemplate:
      "Please provide the current insurance binder for {{property_address}} showing the borrower/entity and required lender/mortgagee information.",
    requestSummary:
      "Request the current hazard insurance binder for {{property_address}}.",
    instructions:
      "Contact the insurance agent listed on the deal and request the current binder. Verify the property address and borrower/entity name. Verify lender/mortgagee language if the file requires it. Upload/link the received document to the Insurance Client Need. If no response within 24 hours, follow up. Escalate to the LO after 48 hours. Do not decide coverage adequacy beyond these checks.",
    completionSummary:
      "Complete when evidence of coverage is received, linked, and the processor marks it accepted. This is not an insurance-compliance determination.",
  }),
  documentRequest({
    playbookKey: "request_hazard_insurance_invoice",
    title: "Request hazard insurance invoice",
    sourceType: "insurance",
    taskKind: "contact_third_party",
    timing: "required_later",
    alwaysRequired: false,
    needCategory: "Insurance",
    needDocumentType: "Insurance Invoice",
    needMatchAliases: ["insurance invoice", "hazard"],
    instructions:
      "Request the hazard insurance invoice or paid receipt from the agent. Confirm it matches the same policy as the binder. Link it if an Insurance Invoice Client Need exists. Follow up in 24 hours. Escalate to the LO after 48 hours.",
    completionSummary:
      "Complete when the invoice/receipt is received and the processor marks it accepted.",
  }),
  documentRequest({
    playbookKey: "follow_up_appraisal_status",
    title: "Check appraisal / valuation status",
    sourceType: "appraiser",
    taskKind: "follow_up",
    timing: "required_later",
    alwaysRequired: false,
    instructions:
      "Contact the appraiser or AMC. Record who you spoke with and the expected delivery date. Update last contacted and the next follow-up. If the date slips, notify the LO. Escalate after 48 hours of silence.",
    completionSummary:
      "Complete when a delivery date is confirmed or the report has arrived. Do not accept or reject value.",
  }),
  documentRequest({
    playbookKey: "follow_up_appraisal_report",
    title: "Follow up on appraisal report",
    sourceType: "appraiser",
    taskKind: "follow_up",
    timing: "required_later",
    alwaysRequired: false,
    needCategory: "Valuation",
    needDocumentType: "Appraisal",
    needMatchAliases: ["appraisal"],
    instructions:
      "If the report is late, follow up with the appraiser. When it arrives, link it to the Appraisal Client Need if present. Confirm the address only. Escalate to the LO after 48 hours if still missing.",
    completionSummary:
      "Complete when the report is received and linked if applicable. Do not conclude value.",
  }),
  documentRequest({
    playbookKey: "request_contractor_insurance",
    title: "Request contractor insurance",
    sourceType: "contractor",
    taskKind: "contact_third_party",
    timing: "optional",
    alwaysRequired: false,
    needCategory: "Rehab",
    needDocumentType: "Contractor Insurance",
    needMatchAliases: ["contractor insurance"],
    instructions:
      "Ask the contractor for current liability insurance. Confirm the named insured. Link the certificate if a Client Need exists. Follow up in 24 hours. Escalate to the LO after 48 hours.",
    completionSummary:
      "Complete when the certificate is received and the processor marks it accepted.",
  }),
  documentRequest({
    playbookKey: "request_contractor_estimate",
    title: "Request contractor estimate / scope",
    sourceType: "contractor",
    taskKind: "contact_third_party",
    timing: "optional",
    alwaysRequired: false,
    needCategory: "Rehab",
    needDocumentType: "Contractor Estimate",
    needMatchAliases: ["contractor estimate"],
    instructions:
      "Request the contractor estimate or scope. Confirm it is for this property. Link it if a Client Need exists. Follow up in 24 hours. Escalate to the LO after 48 hours.",
    completionSummary:
      "Complete when the estimate is received and the processor marks it accepted.",
  }),
  documentRequest({
    playbookKey: "request_wiring_closing_contact",
    title: "Collect wiring / closing contact information",
    sourceType: "escrow",
    taskKind: "request_information",
    timing: "required_later",
    alwaysRequired: false,
    instructions:
      "Identify escrow or the closing attorney. Collect the official contact name, email, and phone. Store only those fields on this task. Do not store wiring numbers in task notes. Follow up in 24 hours. Escalate to the LO after 48 hours.",
    completionSummary:
      "Complete when a verified closing contact is recorded on the task. Do not treat this as wiring-instruction approval.",
  }),
  documentRequest({
    playbookKey: "request_settlement_items",
    title: "Request settlement items",
    sourceType: "closing_attorney",
    taskKind: "contact_third_party",
    timing: "required_later",
    alwaysRequired: false,
    instructions:
      "Ask escrow or the closing attorney what settlement items they still need. Record the list in blocked reason if anything is outstanding. Follow up in 24 hours. Escalate to the LO after 48 hours.",
    completionSummary:
      "Complete when the settlement punch-list is received and outstanding items are tasked. This does not clear the file to close.",
  }),
  {
    playbookKey: "review_bank_statements",
    title: "Review bank statements",
    sourceType: "internal",
    taskKind: "review_document",
    timing: "required_now",
    priority: "high",
    instructions:
      "Open the Bank Statements Client Need. Confirm expected months are present, pages are complete, and the account holder matches. If a statement still needs review, leave the need in needs_review. Do not approve the need until the requirement as a whole is satisfied. Escalate to the LO only if the package cannot be interpreted.",
    completionRule: {
      key: "review_bank_statements_complete",
      summary:
        "Complete when the processor has reviewed the linked statements. Approval of the Client Need is a separate decision and is never automatic.",
      requiresLinkedNeed: true,
      requiresNeedApprovedOrAccepted: false,
      requiresDocumentLinked: true,
      requiresProcessorAccepted: true,
      autoUnderwrite: false,
    },
    followUpIntervalHours: null,
    escalationAfterHours: 48,
    createsClientNeed: false,
    alwaysRequired: false,
    requiresContact: false,
    needDocumentType: "Bank Statements",
    needMatchAliases: ["bank statements", "liquidity"],
  },
  {
    playbookKey: "follow_up_lease",
    title: "Follow up on lease / rent schedule",
    sourceType: "borrower",
    taskKind: "follow_up",
    timing: "required_now",
    priority: "normal",
    instructions:
      "Check the Lease / Rent Schedule Client Need. If the file is still in review or missing pages, contact the borrower for the correction. Record last contacted and the next follow-up. Escalate to the LO after 48 hours.",
    completionRule: {
      key: "follow_up_lease_complete",
      summary:
        "Complete when the lease item is no longer blocked or the processor has a documented borrower response. Do not calculate DSCR.",
      requiresLinkedNeed: true,
      requiresNeedApprovedOrAccepted: false,
      requiresDocumentLinked: false,
      requiresProcessorAccepted: true,
      autoUnderwrite: false,
    },
    followUpIntervalHours: 24,
    escalationAfterHours: 48,
    createsClientNeed: false,
    alwaysRequired: false,
    requiresContact: true,
    contactType: "borrower",
    requestTemplate:
      "Please send the corrected or complete lease / rent schedule for {{property_address}}.",
    requestSummary:
      "Follow up on the lease / rent schedule for {{property_address}}.",
    needDocumentType: "Lease / Rent Schedule",
    needMatchAliases: ["lease", "rent schedule"],
  },
  {
    playbookKey: "prepare_submission",
    title: "Prepare submission when complete",
    sourceType: "internal",
    taskKind: "prepare_submission",
    timing: "required_later",
    priority: "low",
    instructions:
      "Do not start this until required-now tasks are complete or waived. Walk the Client Needs list. If anything required is still missing or in review, stop and create or reopen the matching request task. When the file is actually ready, mark this complete. This does not submit to a lender.",
    completionRule: {
      key: "prepare_submission_complete",
      summary:
        "Complete when the processor confirms required-now items are satisfied or waived. This is not an underwriting or credit decision.",
      requiresLinkedNeed: false,
      requiresNeedApprovedOrAccepted: false,
      requiresDocumentLinked: false,
      requiresProcessorAccepted: true,
      autoUnderwrite: false,
    },
    followUpIntervalHours: null,
    escalationAfterHours: null,
    createsClientNeed: false,
    alwaysRequired: false,
    requiresContact: false,
  },
  {
    playbookKey: "resolve_exception",
    title: "Resolve file exception",
    sourceType: "internal",
    taskKind: "resolve_exception",
    timing: "required_now",
    priority: "urgent",
    instructions:
      "Read the exception on the deal. Identify the source (borrower, title, internal). Document the blocked reason. Either collect the replacement item or route the exception to the LO. Do not dismiss an urgent exception without a note.",
    completionRule: {
      key: "resolve_exception_complete",
      summary:
        "Complete when the blocking exception is cleared or explicitly accepted by the processor/LO. No credit conclusion is made.",
      requiresLinkedNeed: false,
      requiresNeedApprovedOrAccepted: false,
      requiresDocumentLinked: false,
      requiresProcessorAccepted: true,
      autoUnderwrite: false,
    },
    followUpIntervalHours: 12,
    escalationAfterHours: 24,
    createsClientNeed: false,
    alwaysRequired: false,
    requiresContact: false,
  },
  {
    playbookKey: "follow_up_borrower",
    title: "Follow up with borrower",
    sourceType: "borrower",
    taskKind: "follow_up",
    timing: "required_now",
    priority: "high",
    instructions:
      "Review outstanding borrower Client Needs. Contact the borrower with a specific list of missing items. Record last contacted and schedule the next follow-up. Escalate to the LO after 48 hours without a response.",
    completionRule: {
      key: "follow_up_borrower_complete",
      summary:
        "Complete when the borrower has responded or the outstanding items are tasked separately. Do not mark the deal complete from this task.",
      requiresLinkedNeed: false,
      requiresNeedApprovedOrAccepted: false,
      requiresDocumentLinked: false,
      requiresProcessorAccepted: true,
      autoUnderwrite: false,
    },
    followUpIntervalHours: 24,
    escalationAfterHours: 48,
    createsClientNeed: false,
    alwaysRequired: false,
    requiresContact: true,
    contactType: "borrower",
    requestTemplate:
      "Please send the outstanding items for {{deal_reference}} / {{property_address}}.",
    requestSummary:
      "Follow up with {{contact_name}} on outstanding borrower items.",
  },
];
