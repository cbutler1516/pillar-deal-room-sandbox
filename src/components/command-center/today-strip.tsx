import Link from "next/link";
import { queueFilterHref } from "@/lib/command-center/filters";
import type { TodayStripCounts } from "@/lib/command-center/derive";
import { surfaceClass } from "@/components/ui/styles";

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
      className={`${surfaceClass("elevated")} flex flex-wrap gap-2 px-3 py-2.5`}
    >
      {STRIP_ITEMS.map((item) => (
        <Link
          key={item.key}
          href={queueFilterHref({
            assignment,
            bucket: item.bucket,
            work: item.work,
          })}
          className="inline-flex min-w-[7.5rem] flex-1 items-center justify-between gap-2 rounded-[10px] border border-line/80 bg-white/70 px-3 py-2 text-sm transition hover:border-pillar-teal/40 hover:bg-pillar-teal-soft/30"
        >
          <span className="text-ink-muted">{item.label}</span>
          <span className="font-semibold tabular-nums text-ink">{counts[item.key]}</span>
        </Link>
      ))}
    </section>
  );
}
