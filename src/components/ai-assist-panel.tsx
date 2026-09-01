import { AI_ASSIST_DISCLAIMER, type AISummaryResult } from "@/lib/ai/types";

function severityClass(severity: "info" | "warning" | "blocker"): string {
  if (severity === "blocker") {
    return "text-danger";
  }
  if (severity === "warning") {
    return "text-warning";
  }
  return "text-ink-muted";
}

export function AIAssistPanel({ result }: { result: AISummaryResult }) {
  const importantFlag =
    result.flags.find((flag) => flag.severity === "blocker") ??
    result.flags.find((flag) => flag.severity === "warning") ??
    result.flags[0] ??
    null;
  const suggestions = result.nextActions.slice(0, 3);

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium tracking-[0.08em] text-ink-muted uppercase">
        AI-assisted
      </p>
      <p className="text-sm leading-6 text-ink">{result.dealSummary}</p>
      {importantFlag ? (
        <p className={`text-sm font-medium leading-6 ${severityClass(importantFlag.severity)}`}>
          {importantFlag.title}
        </p>
      ) : null}
      {suggestions.length > 0 ? (
        <ul className="space-y-2">
          {suggestions.map((item) => (
            <li key={item.action}>
              <p className="text-sm font-medium text-ink">{item.action}</p>
              <p className="text-xs leading-5 text-ink-muted">{item.reason}</p>
            </li>
          ))}
        </ul>
      ) : null}

      <details className="group">
        <summary className="cursor-pointer text-sm text-ink-muted">
          More context
        </summary>
        <div className="mt-3 space-y-3">
          {result.communicationSummary ? (
            <p className="text-sm leading-6 text-ink">{result.communicationSummary}</p>
          ) : null}
          {result.blockerSummary ? (
            <p className="text-sm leading-6 text-ink">{result.blockerSummary}</p>
          ) : null}
          {result.recentChanges ? (
            <p className="text-sm leading-6 text-ink-muted">{result.recentChanges}</p>
          ) : null}
          {result.missingItems.length > 0 ? (
            <ul className="space-y-1">
              {result.missingItems.map((item) => (
                <li key={item} className="text-sm leading-6 text-ink">
                  {item}
                </li>
              ))}
            </ul>
          ) : null}
          {result.flags.length > 1 ? (
            <ul className="space-y-2">
              {result.flags.slice(1).map((flag) => (
                <li key={`${flag.kind}-${flag.title}-${flag.detail}`}>
                  <p className={`text-sm font-medium ${severityClass(flag.severity)}`}>
                    {flag.title}
                  </p>
                  <p className="text-xs text-ink-muted">{flag.detail}</p>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </details>

      <p className="text-xs leading-5 text-ink-muted">
        {AI_ASSIST_DISCLAIMER} AI cannot send communications, approve or reject
        documents, approve or waive Client Needs, change deal status, complete
        tasks, assign processors, or make underwriting decisions.
      </p>
    </div>
  );
}
