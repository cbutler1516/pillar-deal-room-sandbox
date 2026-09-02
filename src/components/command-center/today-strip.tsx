import Link from "next/link";
import { queueFilterHref } from "@/lib/command-center/filters";
import type { TodayStripCounts } from "@/lib/command-center/derive";

const STRIP_ITEMS: {
  key: keyof TodayStripCounts;
  label: string;
  bucket: "due_today" | "urgent" | "review" | "waiting" | "ready";
  work?: string;
}[] = [
  { key: "dueToday", label: "Due today", bucket: "due_today" },
  { key: "overdue", label: "Overdue", bucket: "urgent", work: "follow_up" },
  { key: "docsToReview", label: "Docs to review", bucket: "review" },
  { key: "waiting", label: "Waiting", bucket: "waiting" },
  { key: "readyToSubmit", label: "Ready to submit", bucket: "ready" },
];

export function TodayStrip({
  counts,
  assignment = "mine",
}: {
  counts: TodayStripCounts;
  assignment?: string;
}) {
  return (
    <section
      aria-label="Today"
      className="flex flex-wrap divide-x divide-line border-y border-line"
    >
      {STRIP_ITEMS.map((item) => (
        <Link
          key={item.key}
          href={queueFilterHref({
            assignment,
            bucket: item.bucket,
            work: item.work,
          })}
          className="inline-flex min-w-[7.5rem] flex-1 items-center justify-between gap-2 px-4 py-3 text-sm transition hover:bg-stone"
        >
          <span className="text-ink-muted">{item.label}</span>
          <span className="font-semibold tabular-nums text-ink">{counts[item.key]}</span>
        </Link>
      ))}
    </section>
  );
}
