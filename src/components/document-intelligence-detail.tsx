import type { DocumentIntelligenceDocumentResult } from "@/lib/document-intelligence/types";
import { DOCUMENT_INTELLIGENCE_DISCLAIMER } from "@/lib/document-intelligence/types";

function formatConfidence(value: number): string {
  if (!value) return "—";
  return `${Math.round(value * 100)}% metadata confidence`;
}

export function DocumentIntelligenceDetail({
  result,
}: {
  result: DocumentIntelligenceDocumentResult;
}) {
  const flags = [
    ...result.duplicates.map((flag) => flag.reasons[0]),
    ...(result.period ? [result.period.reasons[0]] : []),
    ...result.needFit
      .filter((item) => item.status === "mismatch" || item.status === "candidate")
      .map((item) => item.reasons[0]),
  ].filter(Boolean);

  return (
    <div className="space-y-2 rounded-lg border border-line bg-surface-muted/50 px-3 py-2">
      <p className="text-[11px] font-semibold tracking-wide text-ink-muted uppercase">
        Intelligence suggestion
      </p>
      <p className="text-sm text-ink">
        {result.classification.suggestedType ?? "No suggested type"}
        <span className="ml-2 text-xs text-ink-muted">
          {formatConfidence(result.classification.confidence)}
        </span>
      </p>
      <p className="text-xs text-ink-muted">
        {result.classification.reasons[0]}
      </p>
      <p className="text-sm font-medium text-ink">{result.recommendation.label}</p>
      {flags.length > 0 ? (
        <ul className="space-y-1">
          {flags.slice(0, 4).map((flag) => (
            <li key={flag} className="text-xs text-warning">
              {flag}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="text-[11px] text-ink-muted">{DOCUMENT_INTELLIGENCE_DISCLAIMER}</p>
    </div>
  );
}
