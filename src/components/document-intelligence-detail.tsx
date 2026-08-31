import {
  documentIntelligenceHeadline,
  documentNeedFitLabel,
  shouldShowConfidence,
} from "@/lib/document-intelligence/presentation";
import type { DocumentIntelligenceDocumentResult } from "@/lib/document-intelligence/types";
import { DOCUMENT_INTELLIGENCE_DISCLAIMER } from "@/lib/document-intelligence/types";

export function DocumentIntelligenceDetail({
  result,
}: {
  result: DocumentIntelligenceDocumentResult;
}) {
  const headline = documentIntelligenceHeadline(result);
  const fitLabel = documentNeedFitLabel(result);
  const linkedFit = result.needFit.find((item) => item.linked);
  const showConfidence = shouldShowConfidence(result.classification.confidence);
  const flags = [
    ...result.duplicates.map((flag) => flag.reasons[0]),
    ...(result.period ? [result.period.reasons[0]] : []),
    ...result.needFit
      .filter((item) => item.status === "mismatch" || item.status === "candidate")
      .map((item) => item.reasons[0]),
  ].filter(Boolean);

  return (
    <div className="space-y-3">
      <p className="text-[11px] font-medium tracking-wide text-ink-muted uppercase">
        Intelligence
      </p>
      <p className="text-sm font-medium leading-6 text-ink">{headline}</p>
      <p className="text-sm leading-6 text-ink">
        Suggested type: {result.classification.suggestedType ?? "None yet"}
        {showConfidence
          ? ` · metadata is only a partial match`
          : ""}
      </p>
      <p className="text-sm leading-6 text-ink">
        Need fit: {fitLabel}
        {linkedFit ? ` · ${linkedFit.needDocumentType}` : ""}
      </p>
      {result.period?.extractedPeriod ? (
        <p className="text-sm leading-6 text-ink-muted">
          Period hint: {result.period.extractedPeriod}
        </p>
      ) : null}
      <p className="text-sm leading-6 text-ink">{result.recommendation.label}</p>
      {flags.length > 0 ? (
        <ul className="space-y-1">
          {flags.slice(0, 4).map((flag) => (
            <li key={flag} className="text-sm leading-6 text-warning">
              {flag}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm leading-6 text-ink-muted">
          {headline === "Looks consistent with the requested item"
            ? "Looks consistent with the requested item. Processor review required."
            : "Processor review required."}
        </p>
      )}
      <p className="text-xs leading-5 text-ink-muted">
        {DOCUMENT_INTELLIGENCE_DISCLAIMER}
      </p>
    </div>
  );
}
