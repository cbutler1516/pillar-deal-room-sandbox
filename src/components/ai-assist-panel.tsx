import { CardHeader, SurfaceCard } from "@/components/ui/surface-card";
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
  return (
    <SurfaceCard elevated>
      <CardHeader
        title="Processor assist"
        description={`${result.provider.replaceAll("_", " ")} · ${result.engine} · does not change the file`}
      />
      <p className="text-sm text-ink">{result.dealSummary}</p>
      <p className="mt-2 text-sm text-ink">{result.communicationSummary}</p>
      <p className="mt-2 text-sm text-ink">{result.blockerSummary}</p>
      <p className="mt-2 text-sm text-ink-muted">{result.recentChanges}</p>

      {result.missingItems.length > 0 ? (
        <div className="mt-4">
          <h4 className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
            Missing items
          </h4>
          <ul className="mt-1 space-y-1">
            {result.missingItems.map((item) => (
              <li key={item} className="text-sm text-ink">
                {item}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {result.flags.length > 0 ? (
        <div className="mt-4">
          <h4 className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
            Workflow flags
          </h4>
          <ul className="mt-1 space-y-2">
            {result.flags.map((flag) => (
              <li key={`${flag.kind}-${flag.title}-${flag.detail}`}>
                <p className={`text-sm font-medium ${severityClass(flag.severity)}`}>
                  {flag.title}
                </p>
                <p className="text-xs text-ink-muted">{flag.detail}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {result.nextActions.length > 0 ? (
        <div className="mt-4">
          <h4 className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
            Suggested next actions
          </h4>
          <ul className="mt-1 space-y-2">
            {result.nextActions.map((item) => (
              <li key={item.action}>
                <p className="text-sm font-medium text-ink">{item.action}</p>
                <p className="text-xs text-ink-muted">{item.reason}</p>
                <a
                  href={item.href}
                  className="mt-0.5 inline-block text-xs font-medium text-pillar-navy underline"
                >
                  Open {item.target}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="mt-4 text-[11px] text-ink-muted">
        {AI_ASSIST_DISCLAIMER} AI cannot send communications, approve or reject
        documents, approve or waive Client Needs, change deal status, complete
        tasks, assign processors, or make underwriting decisions.
      </p>
    </SurfaceCard>
  );
}
