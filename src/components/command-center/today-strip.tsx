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
  { key: "readyToSubmit", label: "Ready to send", bucket: "ready" },
];

export function TodayStrip({
  counts,
  assignment = "mine",
}: {
  counts: TodayStripCounts;
  assignment?: string;
}) {
  return (
    <section aria-label="Today" className="border-y border-line">
      <div className="grid grid-cols-2 sm:grid-cols-5">
        {STRIP_ITEMS.map((item) => (
          <Link
            key={item.key}
            href={queueFilterHref({
              assignment,
              bucket: item.bucket,
              work: item.work,
            })}
            className="flex flex-col gap-1 border-line px-4 py-3.5 transition hover:bg-stone/70 sm:border-r sm:last:border-r-0 max-sm:border-b max-sm:odd:border-r"
          >
            <span className="text-[10px] uppercase tracking-[0.12em] text-ink-muted">
              {item.label}
            </span>
            <span className="text-[1.375rem] font-semibold tabular-nums leading-none text-ink">
              {counts[item.key]}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
