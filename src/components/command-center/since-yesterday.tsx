import Link from "next/link";
import { CardHeader, SurfaceCard } from "@/components/ui/surface-card";
import { linkClass } from "@/components/ui/styles";
import type { SinceYesterdayCounts } from "@/lib/command-center/since-yesterday";

export function SinceYesterdaySection({
  counts,
  summary,
}: {
  counts: SinceYesterdayCounts;
  summary: string;
}) {
  return (
    <SurfaceCard tone="elevated">
      <CardHeader title="Since yesterday" />
      {counts.lines.length === 0 ? (
        <p className="text-sm text-ink-muted">No notable changes since yesterday.</p>
      ) : (
        <>
          <p className="text-sm leading-6 text-ink">{summary}</p>
          <ul className="mt-3 space-y-1">
            {counts.lines.map((row) => (
              <li key={row.label} className="text-sm text-ink-muted">
                {row.href ? (
                  <Link href={row.href} className={linkClass}>
                    {row.count} {row.count === 1 ? row.label : `${row.label}s`}
                  </Link>
                ) : (
                  <span>
                    {row.count} {row.count === 1 ? row.label : `${row.label}s`}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </SurfaceCard>
  );
}
