import Link from "next/link";
import { CardHeader, SurfaceCard } from "@/components/ui/surface-card";
import { buttonClass } from "@/components/ui/button";
import type { UnassignedFileRow } from "@/lib/command-center/derive";

export function UnassignedSection({
  rows,
  totalCount,
}: {
  rows: UnassignedFileRow[];
  totalCount: number;
}) {
  if (totalCount === 0) {
    return null;
  }
  return (
    <SurfaceCard tone="elevated">
      <CardHeader title="Unassigned" meta={totalCount} />
      <ul>
        {rows.map((row) => (
          <li key={row.id} className="border-t border-line py-2.5 first:border-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{row.borrowerName}</p>
                <p className="text-xs text-ink-muted">{row.reason}</p>
              </div>
              <Link href={row.href} className={buttonClass("secondary", "sm")}>
                Open file
              </Link>
            </div>
          </li>
        ))}
      </ul>
      <Link
        href="/processor-queue?assignment=unassigned"
        className={`${buttonClass("secondary", "sm")} mt-3`}
      >
        View unassigned
      </Link>
    </SurfaceCard>
  );
}
