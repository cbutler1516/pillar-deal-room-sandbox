import Link from "next/link";
import { CardHeader, SurfaceCard } from "@/components/ui/surface-card";
import { buttonClass } from "@/components/ui/button";
import type { ConditionsSnapshot } from "@/lib/command-center/conditions";

export function ConditionsSection({ snapshot }: { snapshot: ConditionsSnapshot }) {
  const total =
    snapshot.open +
    snapshot.waiting +
    snapshot.received +
    snapshot.needsReview;
  if (total === 0) {
    return null;
  }
  return (
    <SurfaceCard tone="elevated">
      <CardHeader title="Conditions" />
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Stat label="Open" value={snapshot.open} />
        <Stat label="Waiting" value={snapshot.waiting} />
        <Stat label="Received" value={snapshot.received} />
        <Stat label="Needs review" value={snapshot.needsReview} />
      </dl>
      <Link href={snapshot.href} className={`${buttonClass("secondary", "sm")} mt-4`}>
        View conditions
      </Link>
    </SurfaceCard>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-[11px] text-ink-muted">{label}</dt>
      <dd className="mt-0.5 font-semibold tabular-nums text-ink">{value}</dd>
    </div>
  );
}
