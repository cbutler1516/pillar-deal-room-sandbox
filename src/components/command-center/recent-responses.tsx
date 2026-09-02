import Link from "next/link";
import { SectionHeader } from "@/components/ui/surface-card";
import { buttonClass } from "@/components/ui/button";
import type { RecentResponseRow } from "@/lib/command-center/derive";

export function RecentResponsesSection({ rows }: { rows: RecentResponseRow[] }) {
  if (rows.length === 0) {
    return null;
  }
  return (
    <section>
      <SectionHeader title="Recent responses" meta={rows.length} />
      <ul>
        {rows.map((row) => (
          <li key={row.id} className="border-b border-line py-2.5 last:border-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">
                  {row.borrowerName} replied
                </p>
                <p className="text-xs text-ink-muted">
                  {row.taskTitle} · {row.ageLabel}
                </p>
              </div>
              <Link href={row.href} className={buttonClass("secondary", "sm")}>
                Review reply
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
