import { DOCUMENT_INTELLIGENCE_DISCLAIMER } from "@/lib/document-intelligence/types";
import type { DocumentIntelligenceResult } from "@/lib/document-intelligence/types";

export function DocumentIntelligencePanel({
  result,
}: {
  result: DocumentIntelligenceResult;
}) {
  const queue = result.reviewQueue.slice(0, 6);
  return (
    <details className="group">
      <summary className="cursor-pointer text-sm font-medium text-ink-muted">
        Set completeness
      </summary>
      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <div>
          {result.completeness.length === 0 ? (
            <p className="text-sm leading-6 text-ink-muted">
              No Client Needs on this file.
            </p>
          ) : (
            <ul className="space-y-2">
              {result.completeness.map((item) => (
                <li key={item.needId}>
                  <p className="text-sm font-medium text-ink">{item.documentType}</p>
                  <p className="text-xs leading-5 text-ink-muted">{item.summary}</p>
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
            <p className="mt-2 text-sm leading-6 text-ink-muted">
              No documents to prioritize.
            </p>
          ) : (
            <ol className="mt-2 space-y-2">
              {queue.map((item) => (
                <li key={item.documentId}>
                  <p className="text-sm font-medium text-ink">{item.label}</p>
                  <p className="text-xs leading-5 text-ink-muted">{item.fileName}</p>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
      <p className="mt-4 text-xs leading-5 text-ink-muted">
        {DOCUMENT_INTELLIGENCE_DISCLAIMER} Intelligence cannot approve files,
        waive Needs, change deal status, or send communications.
      </p>
    </details>
  );
}
