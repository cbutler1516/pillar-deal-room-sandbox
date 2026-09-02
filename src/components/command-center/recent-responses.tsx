import Link from "next/link";
import { CardHeader, SurfaceCard } from "@/components/ui/surface-card";
import { buttonClass } from "@/components/ui/button";
import type { RecentResponseRow } from "@/lib/command-center/derive";

export function RecentResponsesSection({ rows }: { rows: RecentResponseRow[] }) {
  if (rows.length === 0) {
    return null;
  }
  return (
    <SurfaceCard tone="elevated">
      <CardHeader title="Recent responses" meta={rows.length} />
      <ul>
        {rows.map((row) => (
          <li key={row.id} className="border-t border-line py-2.5 first:border-0">
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
    </SurfaceCard>
  );
}
