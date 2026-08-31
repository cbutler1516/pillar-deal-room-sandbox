import {
  documentTypeTaxonomy,
  isPeriodSensitiveType,
  normalizeMetadataText,
  typesMatch,
} from "@/lib/document-intelligence/taxonomy";
import {
  DOCUMENT_INTELLIGENCE_DISCLAIMER,
  SANDBOX_MOCK_DOCUMENT_INTELLIGENCE_PROVIDER,
  type DocumentClassificationSuggestion,
  type DocumentDuplicateFlag,
  type DocumentIntelligenceDocument,
  type DocumentIntelligenceDocumentResult,
  type DocumentIntelligenceResult,
  type DocumentIntelligenceSnapshot,
  type DocumentNeedFitResult,
  type DocumentPeriodFlag,
  type DocumentReviewRecommendation,
  type DocumentSetCompleteness,
  type NeedIntelligenceHint,
} from "@/lib/document-intelligence/types";

const BLOCKED_CONTENT_KEYS = new Set([
  "bytes",
  "byte",
  "base64",
  "ocr",
  "extractedtext",
  "textcontent",
  "filecontent",
  "content",
  "buffer",
  "blob",
  "arraybuffer",
]);

function assertMetadataOnly(value: unknown): void {
  if (value == null || typeof value !== "object") {
    return;
  }
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(value)) {
    throw new Error("Raw file bytes are not accepted.");
  }
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (nested == null || nested === "") continue;
    if (BLOCKED_CONTENT_KEYS.has(key.toLowerCase())) {
      throw new Error("Raw file bytes are not accepted.");
    }
    if (Array.isArray(nested)) {
      for (const item of nested) assertMetadataOnly(item);
    } else if (typeof nested === "object") {
      assertMetadataOnly(nested);
    }
  }
}

const MONTHS: Record<string, string> = {
  january: "01",
  february: "02",
  march: "03",
  april: "04",
  may: "05",
  june: "06",
  july: "07",
  august: "08",
  september: "09",
  october: "10",
  november: "11",
  december: "12",
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  sept: "09",
  oct: "10",
  nov: "11",
  dec: "12",
};

function filenameStem(fileName: string): string {
  return normalizeMetadataText(fileName).replace(
    /\b(20\d{2}|0?\d|1[0-2]|january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\b/g,
    "",
  ).replace(/\s+/g, " ").trim();
}

export function extractPeriodFromFileName(fileName: string): string | null {
  const normalized = normalizeMetadataText(fileName);
  const iso = normalized.match(/\b(20\d{2})[ -]?(\d{1,2})(?:[ -]?(\d{1,2}))?\b/);
  if (iso) {
    const month = iso[2].padStart(2, "0");
    return iso[3] ? `${iso[1]}-${month}-${iso[3].padStart(2, "0")}` : `${iso[1]}-${month}`;
  }
  for (const [name, month] of Object.entries(MONTHS)) {
    const match = normalized.match(new RegExp(`\\b${name}\\b(?:[ -]*(20\\d{2}))?`));
    if (match) {
      return match[1] ? `${match[1]}-${month}` : month;
    }
  }
  return null;
}

export function classifyFromMetadata(
  document: DocumentIntelligenceDocument,
): DocumentClassificationSuggestion {
  const taxonomy = documentTypeTaxonomy();
  const hay = normalizeMetadataText(document.fileName);
  let best: { type: string; alias: string; score: number } | null = null;
  for (const entry of taxonomy) {
    for (const alias of entry.aliases) {
      if (alias.length < 3) continue;
      const needle = normalizeMetadataText(alias);
      if (!needle) continue;
      const bounded = new RegExp(`\\b${needle.replace(/\s+/g, "\\s+")}\\b`);
      if (!bounded.test(hay) && !hay.includes(needle)) continue;
      const score = needle.length / Math.max(hay.length, 1);
      if (!best || score > best.score || (score === best.score && needle.length > best.alias.length)) {
        best = { type: entry.documentType, alias: needle, score };
      }
    }
  }

  if (best && best.score >= 0.18) {
    return {
      documentId: document.id,
      suggestedType: best.type,
      confidence: Math.min(0.93, Math.max(0.55, Number(best.score.toFixed(2)) + 0.45)),
      reasons: [`Filename includes “${best.alias}”.`],
      source: "filename",
    };
  }

  if (document.documentType) {
    return {
      documentId: document.id,
      suggestedType: document.documentType,
      confidence: 0.4,
      reasons: ["Using the current manual document type. Filename did not match a known type."],
      source: "manual_type",
    };
  }

  return {
    documentId: document.id,
    suggestedType: null,
    confidence: 0,
    reasons: ["Filename did not match a known document type. No bytes were read."],
    source: "unknown",
  };
}

function requestedTypesForNeed(
  snapshot: DocumentIntelligenceSnapshot,
  needId: string,
): string[] {
  return snapshot.requests
    .filter((item) => item.clientNeedId === needId && item.requestedType)
    .map((item) => item.requestedType as string);
}

export function evaluateNeedFit(
  document: DocumentIntelligenceDocument,
  classification: DocumentClassificationSuggestion,
  snapshot: DocumentIntelligenceSnapshot,
): DocumentNeedFitResult[] {
  const suggested = classification.suggestedType ?? document.documentType;
  return snapshot.needs.map((need) => {
    const linked = document.linkedNeedIds.includes(need.id);
    const requested = requestedTypesForNeed(snapshot, need.id);
    const matchesNeed = typesMatch(suggested, need.documentType);
    const matchesRequest = requested.some((item) => typesMatch(suggested, item));
    const reasons: string[] = [];
    let status: DocumentNeedFitResult["status"] = "unknown";

    if (!suggested) {
      status = linked ? "unknown" : "unlinked";
      reasons.push("No reliable type suggestion from metadata.");
    } else if (linked && matchesNeed) {
      status = "fit";
      reasons.push(`Linked to ${need.documentType}, which matches the suggested type.`);
    } else if (linked && !matchesNeed) {
      status = "mismatch";
      reasons.push(
        `Linked to ${need.documentType}, but metadata suggests ${suggested}.`,
      );
    } else if (!linked && (matchesNeed || matchesRequest)) {
      status = "candidate";
      reasons.push(
        matchesRequest
          ? `A request on this file asked for ${need.documentType}.`
          : `${need.documentType} is an unlinked match for the suggested type.`,
      );
    } else if (!linked) {
      status = "unlinked";
      reasons.push(`${need.documentType} does not match this filename.`);
    }

    return {
      documentId: document.id,
      needId: need.id,
      needDocumentType: need.documentType,
      status,
      linked,
      reasons,
    };
  });
}

export function flagDuplicates(
  document: DocumentIntelligenceDocument,
  classification: DocumentClassificationSuggestion,
  snapshot: DocumentIntelligenceSnapshot,
): DocumentDuplicateFlag[] {
  const flags: DocumentDuplicateFlag[] = [];
  const stem = filenameStem(document.fileName);
  const period = extractPeriodFromFileName(document.fileName);
  const type = classification.suggestedType ?? document.documentType;

  for (const other of snapshot.documents) {
    if (other.id === document.id) continue;
    const otherType = other.documentType;
    const otherPeriod = extractPeriodFromFileName(other.fileName);
    const sameName =
      normalizeMetadataText(document.fileName) ===
      normalizeMetadataText(other.fileName);
    const sameStem = Boolean(stem) && stem === filenameStem(other.fileName);
    const sameTypePeriod =
      Boolean(type) &&
      Boolean(period) &&
      typesMatch(type, otherType ?? type) &&
      period === otherPeriod;

    const distinctPeriods =
      Boolean(period) && Boolean(otherPeriod) && period !== otherPeriod;

    if (sameName) {
      flags.push({
        documentId: document.id,
        otherDocumentId: other.id,
        otherFileName: other.fileName,
        kind: "same_filename",
        severity: "warning",
        reasons: [`Another file on this deal uses the same filename: ${other.fileName}.`],
      });
    } else if (
      sameStem &&
      !distinctPeriods &&
      (typesMatch(type, otherType) || !otherType)
    ) {
      flags.push({
        documentId: document.id,
        otherDocumentId: other.id,
        otherFileName: other.fileName,
        kind: "same_stem",
        severity: "warning",
        reasons: [`Filename looks like a variant of ${other.fileName} after dates are ignored.`],
      });
    } else if (sameTypePeriod) {
      flags.push({
        documentId: document.id,
        otherDocumentId: other.id,
        otherFileName: other.fileName,
        kind: "same_type_and_period",
        severity: "info",
        reasons: [`Another ${type} file appears to cover ${period}.`],
      });
    }
  }
  return flags;
}

export function flagPeriod(
  document: DocumentIntelligenceDocument,
  classification: DocumentClassificationSuggestion,
  snapshot: DocumentIntelligenceSnapshot,
  duplicates: DocumentDuplicateFlag[],
): DocumentPeriodFlag | null {
  const type = classification.suggestedType ?? document.documentType;
  if (!isPeriodSensitiveType(type)) {
    return null;
  }
  const extracted = extractPeriodFromFileName(document.fileName);
  const relatedNeed = snapshot.needs.find(
    (need) =>
      document.linkedNeedIds.includes(need.id) || typesMatch(type, need.documentType),
  );
  if (!extracted) {
    return {
      documentId: document.id,
      extractedPeriod: null,
      kind: "missing",
      severity: "info",
      reasons: [
        "A period was not readable from the filename. Bytes were not inspected.",
      ],
    };
  }
  if (duplicates.some((flag) => flag.kind === "same_type_and_period")) {
    return {
      documentId: document.id,
      extractedPeriod: extracted,
      kind: "duplicate_period",
      severity: "warning",
      reasons: [`Filename period ${extracted} also appears on another linked or same-type file.`],
    };
  }
  const expected = relatedNeed?.expectedMonths;
  if (expected && expected > 1) {
    const siblingPeriods = new Set(
      snapshot.documents
        .filter(
          (other) =>
            other.id === document.id ||
            other.linkedNeedIds.some((id) => document.linkedNeedIds.includes(id)) ||
            typesMatch(type, other.documentType),
        )
        .map((other) => extractPeriodFromFileName(other.fileName))
        .filter((value): value is string => Boolean(value)),
    );
    if (siblingPeriods.size < expected) {
      return {
        documentId: document.id,
        extractedPeriod: extracted,
        kind: "gap",
        severity: "info",
        reasons: [
          `Filename period ${extracted} is readable. ${siblingPeriods.size} of ${expected} expected periods are visible from filenames.`,
        ],
      };
    }
  }
  return {
    documentId: document.id,
    extractedPeriod: extracted,
    kind: "readable",
    severity: "info",
    reasons: [`Filename appears to cover ${extracted}. This is not an authenticity check.`],
  };
}

export function evaluateCompleteness(
  snapshot: DocumentIntelligenceSnapshot,
): DocumentSetCompleteness[] {
  return snapshot.needs.map((need) => {
    const linked = snapshot.documents.filter((doc) =>
      doc.linkedNeedIds.includes(need.id),
    );
    const approvedCount = linked.filter((doc) => doc.status === "approved").length;
    const pendingCount = linked.filter((doc) =>
      ["received", "classifying", "needs_review"].includes(doc.status),
    ).length;
    const expected = need.expectedDocumentCount;
    const countMet = expected == null ? linked.length > 0 : linked.length >= expected;
    const processorDecisionRequired =
      linked.length > 0 &&
      need.status !== "approved" &&
      need.status !== "waived";
    let summary: string;
    if (linked.length === 0) {
      summary = need.required
        ? `No files linked to ${need.documentType}.`
        : `Optional ${need.documentType} has no linked files.`;
    } else if (countMet && processorDecisionRequired) {
      summary = `${linked.length}${expected != null ? ` of ${expected}` : ""} linked. Count may be met; a processor still has to decide.`;
    } else if (countMet) {
      summary = `${need.documentType} has a processor decision on file.`;
    } else {
      summary = `${linked.length} of ${expected} linked to ${need.documentType}.`;
    }
    return {
      needId: need.id,
      documentType: need.documentType,
      required: need.required,
      expectedCount: expected,
      linkedCount: linked.length,
      approvedCount,
      pendingCount,
      countMet,
      processorDecisionRequired,
      summary,
    };
  });
}

function recommend(
  document: DocumentIntelligenceDocument,
  snapshot: DocumentIntelligenceSnapshot,
  classification: DocumentClassificationSuggestion,
  fit: DocumentNeedFitResult[],
  duplicates: DocumentDuplicateFlag[],
  period: DocumentPeriodFlag | null,
): DocumentReviewRecommendation {
  const href = `/deals/${snapshot.deal.dealId}?tab=documents`;
  const mismatch = fit.find((item) => item.status === "mismatch");
  const candidate = fit.find((item) => item.status === "candidate");
  const reasons: string[] = [];
  let action: DocumentReviewRecommendation["action"] = "processor_decision";
  let label = "Review this file when you have time.";
  let priority = 40;

  const replacementFit = fit.find((item) => {
    const need = snapshot.needs.find((entry) => entry.id === item.needId);
    return (
      need?.status === "rejected" &&
      document.status !== "rejected" &&
      (item.status === "fit" || item.status === "candidate")
    );
  });

  if (mismatch) {
    action = "review_mismatch";
    label = `Review mismatched link to ${mismatch.needDocumentType}`;
    reasons.push(...mismatch.reasons);
    priority = 10;
  } else if (replacementFit) {
    action = "review_replacement";
    label = "Review replacement";
    reasons.push(
      `${replacementFit.needDocumentType} is still replacement needed. This file is a candidate. The rejected file stays on the ledger.`,
    );
    priority = 12;
  } else if (duplicates.length > 0) {
    action = "review_duplicate";
    label = `Review possible duplicate of ${duplicates[0].otherFileName}`;
    reasons.push(...duplicates[0].reasons);
    priority = 15;
  } else if (document.linkedNeedIds.length === 0 && candidate) {
    action = "link_need";
    label = `Consider linking to ${candidate.needDocumentType}`;
    reasons.push(...candidate.reasons);
    priority = 18;
  } else if (!document.documentType && classification.suggestedType) {
    action = "confirm_type";
    label = `Confirm suggested type: ${classification.suggestedType}`;
    reasons.push(...classification.reasons);
    priority = 20;
  } else if (period?.kind === "duplicate_period" || period?.kind === "gap") {
    action = "review_period";
    label =
      period.kind === "gap"
        ? "Review period coverage from filenames"
        : "Review overlapping statement period";
    reasons.push(...period.reasons);
    priority = 25;
  } else if (!classification.suggestedType && !document.documentType) {
    action = "review_unclassified";
    label = "Classify this file from metadata";
    reasons.push(...classification.reasons);
    priority = 30;
  } else if (["received", "classifying", "needs_review"].includes(document.status)) {
    action = "processor_decision";
    label = "Processor decision still required";
    reasons.push("Status is not approved or rejected. Intelligence cannot decide.");
    priority = 35;
  } else {
    reasons.push("No metadata issue stood out.");
  }

  const timing = snapshot.needs.find((need) =>
    document.linkedNeedIds.includes(need.id),
  )?.timing;
  if (timing === "required_now") {
    priority -= 3;
  }

  return {
    documentId: document.id,
    fileName: document.fileName,
    action,
    label,
    reasons,
    priority,
    href,
    executable: false,
  };
}

function analyzeDocument(
  document: DocumentIntelligenceDocument,
  snapshot: DocumentIntelligenceSnapshot,
): DocumentIntelligenceDocumentResult {
  const classification = classifyFromMetadata(document);
  const needFit = evaluateNeedFit(document, classification, snapshot);
  const duplicates = flagDuplicates(document, classification, snapshot);
  const period = flagPeriod(document, classification, snapshot, duplicates);
  return {
    documentId: document.id,
    classification,
    needFit,
    duplicates,
    period,
    recommendation: recommend(
      document,
      snapshot,
      classification,
      needFit,
      duplicates,
      period,
    ),
  };
}

export function analyzeDocumentIntelligence(
  snapshot: DocumentIntelligenceSnapshot,
): DocumentIntelligenceResult {
  assertMetadataOnly(snapshot);
  const documents = snapshot.documents.map((doc) => analyzeDocument(doc, snapshot));
  const completeness = evaluateCompleteness(snapshot);
  const reviewQueue = [...documents]
    .map((item) => item.recommendation)
    .sort((a, b) => a.priority - b.priority || a.fileName.localeCompare(b.fileName));

  return {
    provider: SANDBOX_MOCK_DOCUMENT_INTELLIGENCE_PROVIDER,
    engine: "deterministic",
    usedBytes: false,
    usedOcr: false,
    executable: false,
    canMutateWorkflow: false,
    documents,
    completeness,
    reviewQueue,
    disclaimer: DOCUMENT_INTELLIGENCE_DISCLAIMER,
  };
}

export function needIntelligenceHints(
  result: DocumentIntelligenceResult,
): NeedIntelligenceHint[] {
  const needIds = new Set(result.completeness.map((item) => item.needId));
  return [...needIds].map((needId) => {
    const completeness = result.completeness.find((item) => item.needId === needId);
    const fits = result.documents.flatMap((doc) =>
      doc.needFit.filter((item) => item.needId === needId),
    );
    return {
      needId,
      mismatch: fits.some((item) => item.status === "mismatch"),
      replacementCandidate: result.documents.some(
        (doc) =>
          doc.recommendation.action === "review_replacement" &&
          doc.needFit.some(
            (item) =>
              item.needId === needId &&
              (item.status === "fit" || item.status === "candidate"),
          ),
      ),
      reviewNeeded: Boolean(completeness?.processorDecisionRequired),
    };
  });
}

