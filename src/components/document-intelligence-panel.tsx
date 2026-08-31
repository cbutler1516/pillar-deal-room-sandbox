import { CardHeader, SurfaceCard } from "@/components/ui/surface-card";
import {
  DOCUMENT_INTELLIGENCE_DISCLAIMER,
  type DocumentIntelligenceResult,
} from "@/lib/document-intelligence/types";

export function DocumentIntelligencePanel({
  result,
}: {
  result: DocumentIntelligenceResult;
}) {
  const queue = result.reviewQueue.slice(0, 6);
  return (
    <SurfaceCard elevated>
      <CardHeader
        title="Document intelligence"
        description={`${result.provider.replaceAll("_", " ")} · metadata only · no OCR`}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h4 className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
            Set completeness
          </h4>
          {result.completeness.length === 0 ? (
            <p className="mt-2 text-sm text-ink-muted">No Client Needs on this file.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {result.completeness.map((item) => (
                <li key={item.needId}>
                  <p className="text-sm font-medium text-ink">{item.documentType}</p>
                  <p className="text-xs text-ink-muted">{item.summary}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h4 className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
            Review priority
          </h4>
          {queue.length === 0 ? (
            <p className="mt-2 text-sm text-ink-muted">No documents to prioritize.</p>
          ) : (
            <ol className="mt-2 space-y-2">
              {queue.map((item) => (
                <li key={item.documentId}>
                  <p className="text-sm font-medium text-ink">{item.label}</p>
                  <p className="text-xs text-ink-muted">{item.fileName}</p>
                  <p className="text-xs text-ink-muted">{item.reasons[0]}</p>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
      <p className="mt-4 text-[11px] text-ink-muted">
        {DOCUMENT_INTELLIGENCE_DISCLAIMER} Intelligence cannot approve files,
        waive Needs, change deal status, or send communications.
      </p>
    </SurfaceCard>
  );
}
