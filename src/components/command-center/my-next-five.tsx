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
    <NextActionsQueue
      rows={items.map((row) =>
        workQueueRow(row, { location: locationByDeal[row.dealId] }),
      )}
      staffNames={staffNames}
      title="My next 5"
      description="Your highest-priority assigned work"
      empty="Nothing assigned to you right now."
      layout="grid"
      accent="urgent"
    />
  );
}
