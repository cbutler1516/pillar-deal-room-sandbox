import {
  DOCUMENT_REVIEW_REQUIRED,
  documentIntelligenceExplanation,
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
  const explanation = documentIntelligenceExplanation(result);
  const fitLabel = documentNeedFitLabel(result);
  const linkedFit = result.needFit.find((item) => item.linked);
  const showConfidence = shouldShowConfidence(result.classification.confidence);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-base font-semibold tracking-tight text-ink">{headline}</p>
        <p className="mt-2 text-sm leading-6 text-ink">{explanation}</p>
        <p className="mt-1 text-sm leading-6 text-ink-muted">{DOCUMENT_REVIEW_REQUIRED}</p>
      </div>

      <dl className="space-y-3">
        <InspectorField
          label="Suggested type"
          value={result.classification.suggestedType ?? "None yet"}
        />
        <InspectorField
          label="Need fit"
          value={
            linkedFit ? `${fitLabel} · ${linkedFit.needDocumentType}` : fitLabel
          }
        />
        {result.period?.extractedPeriod ? (
          <InspectorField label="Period" value={result.period.extractedPeriod} />
        ) : null}
        {showConfidence ? (
          <InspectorField
            label="Confidence"
            value="Metadata is only a partial match"
            quiet
          />
        ) : null}
      </dl>

      <details className="group">
        <summary className="cursor-pointer text-sm text-ink-muted">
          Intelligence detail
        </summary>
        <div className="mt-3 space-y-2">
          <p className="text-sm leading-6 text-ink">{result.recommendation.label}</p>
          {result.classification.reasons.slice(0, 3).map((reason) => (
            <p key={reason} className="text-sm leading-6 text-ink-muted">
              {reason}
            </p>
          ))}
          <p className="text-xs leading-5 text-ink-muted">
            {DOCUMENT_INTELLIGENCE_DISCLAIMER}
          </p>
        </div>
      </details>
    </div>
  );
}

function InspectorField({
  label,
  value,
  quiet = false,
}: {
  label: string;
  value: string;
  quiet?: boolean;
}) {
  return (
    <div>
      <dt className={`text-xs font-medium ${quiet ? "text-ink-muted/60" : "text-ink-muted"}`}>
        {label}
      </dt>
      <dd className={`mt-1 text-sm ${quiet ? "text-ink-muted" : "text-ink"}`}>{value}</dd>
    </div>
  );
}
