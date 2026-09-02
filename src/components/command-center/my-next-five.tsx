import { NextActionsQueue } from "@/components/next-actions-queue";
import { workQueueRow } from "@/lib/ops/queue-today";
import type { OperationalWorkItem } from "@/lib/ops/operational-work";

export function MyNextFiveSection({
  items,
  staffNames,
  locationByDeal,
}: {
  items: OperationalWorkItem[];
  staffNames: Record<string, string>;
  locationByDeal: Record<string, string>;
}) {
  return (
    <section className="border-l-2 border-accent pl-5">
      <NextActionsQueue
        rows={items.map((row) =>
          workQueueRow(row, { location: locationByDeal[row.dealId] }),
        )}
        staffNames={staffNames}
        title="Up next"
        empty="Nothing assigned to you right now."
      />
    </section>
  );
}
