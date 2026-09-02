import Link from "next/link";
import { SectionHeader } from "@/components/ui/surface-card";
import {
  tableHeadClass,
  tableRowClass,
  tableCellClass,
} from "@/components/ui/styles";
import type { TeamOverviewTotals } from "@/lib/command-center/derive";
import type { TeamWorkloadRow } from "@/lib/team/workload";
import { FactLedger } from "@/components/ui/fact-ledger";

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
    <div className="space-y-8">
      <section>
        <SectionHeader title="Team" />
        <FactLedger
          columns={2}
          rows={[
            { label: "Active work", value: totals.totalActiveWork },
            { label: "Unassigned", value: totals.unassigned },
            { label: "Urgent", value: totals.urgent },
            { label: "Review", value: totals.review },
            { label: "Waiting", value: totals.waiting },
            { label: "Ready to send", value: totals.ready },
          ]}
        />
      </section>

      {unassigned.activeFiles > 0 ? (
        <section className="flex flex-wrap items-baseline justify-between gap-3 border-y border-line py-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
              Unassigned
            </p>
            <p className="mt-1 text-sm text-ink">
              {unassigned.activeFiles} unclaimed file
              {unassigned.activeFiles === 1 ? "" : "s"}
            </p>
          </div>
          <Link href={unassigned.href} className="text-[13px] font-medium text-mineral">
            View unassigned →
          </Link>
        </section>
      ) : null}

      <section>
        <SectionHeader title="Workload" />
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-[13px]">
            <thead className={`${tableHeadClass} border-y border-line`}>
              <tr>
                <th className={`${tableCellClass} font-medium`}>Owner</th>
                <th className={`${tableCellClass} text-right font-medium`}>Load</th>
                <th className={`${tableCellClass} text-right font-medium`}>Urgent</th>
                <th className={`${tableCellClass} text-right font-medium`}>Review</th>
                <th className={`${tableCellClass} text-right font-medium`}>Waiting</th>
                <th className={`${tableCellClass} text-right font-medium`}>Ready</th>
                <th className={`${tableCellClass} font-medium`}> </th>
              </tr>
            </thead>
            <tbody>
              {workloadRows.map((row) => (
                <tr key={row.id} className={tableRowClass}>
                  <td className={tableCellClass}>
                    <p className="font-medium text-ink">{row.name}</p>
                    <p className="text-[11px] text-ink-muted">{row.role}</p>
                  </td>
                  <td className={`${tableCellClass} text-right tabular-nums`}>
                    {row.activeFiles}
                  </td>
                  <td className={`${tableCellClass} text-right tabular-nums`}>
                    {row.urgent}
                  </td>
                  <td className={`${tableCellClass} text-right tabular-nums`}>
                    {row.documentsToReview}
                  </td>
                  <td className={`${tableCellClass} text-right tabular-nums`}>
                    {row.waiting}
                  </td>
                  <td className={`${tableCellClass} text-right tabular-nums`}>
                    {row.ready}
                  </td>
                  <td className={`${tableCellClass} text-right`}>
                    <Link href={row.href} className="text-[11px] font-medium text-mineral">
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
