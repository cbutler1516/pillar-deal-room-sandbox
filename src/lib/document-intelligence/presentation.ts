import type { DocumentIntelligenceDocumentResult } from "@/lib/document-intelligence/types";

export const MATERIAL_DOCUMENT_FLAGS = [
  "Possible mismatch",
  "Possible duplicate",
  "Replacement received",
] as const;

export type MaterialDocumentFlag = (typeof MATERIAL_DOCUMENT_FLAGS)[number];

export function materialDocumentFlags(
  result: DocumentIntelligenceDocumentResult | null | undefined,
): MaterialDocumentFlag[] {
  if (!result) {
    return [];
  }
  const flags: MaterialDocumentFlag[] = [];
  if (result.needFit.some((item) => item.status === "mismatch")) {
    flags.push("Possible mismatch");
  }
  if (result.duplicates.length > 0) {
    flags.push("Possible duplicate");
  }
  if (result.recommendation.action === "review_replacement") {
    flags.push("Replacement received");
  }
  return flags;
}

export function documentHasMaterialIssue(
  result: DocumentIntelligenceDocumentResult | null | undefined,
): boolean {
  return materialDocumentFlags(result).length > 0;
}

export function documentLooksConsistent(
  result: DocumentIntelligenceDocumentResult | null | undefined,
): boolean {
  if (!result || documentHasMaterialIssue(result)) {
    return false;
  }
  return result.needFit.some((item) => item.linked && item.status === "fit");
}

export function documentIntelligenceHeadline(
  result: DocumentIntelligenceDocumentResult,
): string {
  const flags = materialDocumentFlags(result);
  if (flags[0]) {
    return flags[0];
  }
  if (documentLooksConsistent(result)) {
    return "Likely match";
  }
  return "Needs review";
}

export function documentIntelligenceExplanation(
  result: DocumentIntelligenceDocumentResult,
): string {
  const requested =
    result.needFit.find((item) => item.linked)?.needDocumentType ??
    result.needFit.find((item) => item.status === "fit" || item.status === "candidate")
      ?.needDocumentType ??
    result.classification.suggestedType;
  const headline = documentIntelligenceHeadline(result);
  if (headline === "Possible mismatch") {
    return requested
      ? `This file may not match the requested ${requested}.`
      : "This file may not match the requested item.";
  }
  if (headline === "Possible duplicate") {
    return "This file may already exist on the file.";
  }
  if (headline === "Replacement received" || headline === "Likely match") {
    return requested
      ? `This file appears consistent with the requested ${requested}. Processor review is still required.`
      : "This file appears consistent with the requested item. Processor review is still required.";
  }
  return "A processor still has to review this file.";
}

export function documentInspectorPrimaryAction(input: {
  documentType: string | null;
  linkedNeedCount: number;
  suggestedType?: string | null;
}): "save" | "attach" | "review" {
  if (
    !input.documentType ||
    (input.suggestedType && input.suggestedType !== input.documentType)
  ) {
    return "save";
  }
  if (input.linkedNeedCount === 0) {
    return "attach";
  }
  return "review";
}

export function documentNeedFitLabel(
  result: DocumentIntelligenceDocumentResult,
): string {
  const linkedFit = result.needFit.find((item) => item.linked);
  if (linkedFit?.status === "fit") {
    return "Likely match";
  }
  if (linkedFit?.status === "mismatch") {
    return "Possible mismatch";
  }
  if (linkedFit) {
    return "Needs review";
  }
  if (result.needFit.some((item) => item.status === "candidate")) {
    return "Unlinked candidate";
  }
  return "Unlinked";
}

export function shouldShowConfidence(confidence: number): boolean {
  return confidence > 0 && confidence < 0.7;
}
