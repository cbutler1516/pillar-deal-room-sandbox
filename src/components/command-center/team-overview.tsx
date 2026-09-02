import Link from "next/link";
import { StaffAvatar } from "@/components/ui/staff-avatar";
import { buttonClass } from "@/components/ui/button";
import { surfaceClass } from "@/components/ui/styles";
import type { TeamOverviewTotals } from "@/lib/command-center/derive";
import type { TeamWorkloadRow } from "@/lib/team/workload";

export function TeamOverviewSection({
  totals,
  workloadRows,
  unassigned,
}: {
  totals: TeamOverviewTotals;
  workloadRows: TeamWorkloadRow[];
  unassigned: TeamWorkloadRow;
}) {
  return (
    <div className="space-y-5">
      <section className={`${surfaceClass("elevated")} px-4 py-4`}>
        <h3 className="text-sm font-semibold text-ink">Team overview</h3>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
          <TeamStat label="Active work" value={totals.totalActiveWork} />
          <TeamStat label="Unassigned" value={totals.unassigned} />
          <TeamStat label="Urgent" value={totals.urgent} />
          <TeamStat label="Review" value={totals.review} />
          <TeamStat label="Waiting" value={totals.waiting} />
          <TeamStat label="Ready" value={totals.ready} />
        </dl>
      </section>

      <section
        className={`${surfaceClass("elevated")} border-l-4 border-l-rose-400 px-4 py-4`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <StaffAvatar unassigned size={40} />
            <div>
              <h3 className="text-sm font-semibold text-ink">Unassigned</h3>
              <p className="text-xs text-ink-muted">
                {unassigned.activeFiles} unclaimed file
                {unassigned.activeFiles === 1 ? "" : "s"}
              </p>
            </div>
          </div>
          <Link href={unassigned.href} className={buttonClass("accent", "sm")}>
            View unassigned
          </Link>
        </div>
      </section>

      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {workloadRows.map((row) => (
          <li key={row.id}>
            <article className={`${surfaceClass("card")} px-4 py-4`}>
              <div className="flex items-start gap-3">
                <StaffAvatar name={row.name} size={40} />
                <div>
                  <h3 className="text-sm font-semibold text-ink">{row.name}</h3>
                  <p className="text-xs text-ink-muted">{row.role}</p>
                </div>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <TeamStat label="Current load" value={row.activeFiles} compact />
                <TeamStat label="Urgent" value={row.urgent} compact />
                <TeamStat label="Review" value={row.documentsToReview} compact />
                <TeamStat label="Waiting" value={row.waiting} compact />
                <TeamStat label="Ready" value={row.ready} compact />
              </dl>
              <Link href={row.href} className={`${buttonClass("secondary", "sm")} mt-3`}>
                View work
              </Link>
            </article>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TeamStat({
  label,
  value,
  compact,
}: {
  label: string;
  value: number;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div>
        <dt className="text-[11px] text-ink-muted">{label}</dt>
        <dd className="mt-0.5 font-semibold tabular-nums text-ink">{value}</dd>
      </div>
    );
  }
  return (
    <div className="rounded-[10px] border border-line/70 bg-white/60 px-3 py-2">
      <dt className="text-[11px] text-ink-muted">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold tabular-nums text-ink">{value}</dd>
    </div>
  );
}
