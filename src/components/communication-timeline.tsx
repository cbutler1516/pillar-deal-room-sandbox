import { historyItemsFromAttempts } from "@/lib/communications/history";
import type { CommunicationAttempt } from "@/lib/communications/types";
import { formatTimestamp } from "@/lib/format";

export function CommunicationTimeline({
  attempts,
  title = "Communication history",
  empty = "No communications have been recorded on this file.",
}: {
  attempts: CommunicationAttempt[];
  title?: string;
  empty?: string;
}) {
  const items = historyItemsFromAttempts(attempts);
  return (
    <section>
      <h3 className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-ink-muted">{empty}</p>
      ) : (
        <ol className="mt-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="border-t border-line py-2.5 first:border-0"
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-ink">{item.title}</p>
                {item.simulated ? (
                  <span className="rounded-full bg-warning/15 px-1.5 py-0.5 text-[10px] font-semibold text-warning">
                    Simulated
                  </span>
                ) : null}
                <span className="text-[11px] text-ink-muted">
                  {item.channel} · not sent
                </span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-ink">
                {item.detail}
              </p>
              <p className="mt-0.5 text-[11px] text-ink-muted">
                {formatTimestamp(item.when)}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
