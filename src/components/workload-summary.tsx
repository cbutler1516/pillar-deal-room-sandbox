import { StaffPresence } from "@/components/ui/staff-avatar";
import { CardHeader, SurfaceCard } from "@/components/ui/surface-card";
import type { ProcessorWorkload } from "@/lib/communications/workload";

export function WorkloadSummary({
  rows,
}: {
  rows: ProcessorWorkload[];
}) {
  return (
    <SurfaceCard>
      <CardHeader
        title="Processor workload"
        description="Copy-only queue pressure. Nothing is sent from this summary."
        meta={rows.length}
      />
      {rows.length === 0 ? (
        <p className="text-sm text-ink-muted">No active processor work.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="mt-3 w-full text-left text-sm">
            <thead className="text-[11px] uppercase text-ink-muted">
              <tr>
                <th className="pb-2 font-medium">Processor</th>
                <th className="pb-2 font-medium">No contact</th>
                <th className="pb-2 font-medium">Waiting</th>
                <th className="pb-2 font-medium">Follow-up overdue</th>
                <th className="pb-2 font-medium">Escalated</th>
                <th className="pb-2 font-medium">Responses</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.processorId ?? "unassigned"} className="border-t border-line">
                  <td className="py-2 font-medium text-ink">
                    <StaffPresence
                      name={row.processorName}
                      unassigned={!row.processorId}
                    />
                  </td>
                  <td className="py-2 tabular-nums text-ink">{row.noContact}</td>
                  <td className="py-2 tabular-nums text-ink">{row.waiting}</td>
                  <td className="py-2 tabular-nums text-ink">{row.followUpOverdue}</td>
                  <td className="py-2 tabular-nums text-ink">{row.escalated}</td>
                  <td className="py-2 tabular-nums text-ink">{row.responseReceived}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SurfaceCard>
  );
}
