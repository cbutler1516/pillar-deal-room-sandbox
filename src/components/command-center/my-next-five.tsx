import { NextActionsQueue } from "@/components/next-actions-queue";
import { workQueueRow } from "@/lib/ops/queue-today";
import type { OperationalWorkItem } from "@/lib/ops/operational-work";
import { deriveQueueActionPlan } from "@/lib/queue-actions/derive";

export function MyNextFiveSection({
  items,
  staffNames,
  locationByDeal,
  canMutate,
  currentUserId,
}: {
  items: OperationalWorkItem[];
  staffNames: Record<string, string>;
  locationByDeal: Record<string, string>;
  canMutate: boolean;
  currentUserId: string;
}) {
  return (
    <section className="border-l-2 border-accent pl-5">
      <NextActionsQueue
        rows={items.map((row) => ({
          ...workQueueRow(row, { location: locationByDeal[row.dealId] }),
          actionPlan: deriveQueueActionPlan(row, { canMutate, currentUserId }),
        }))}
        staffNames={staffNames}
        title="Up next"
        empty="Nothing assigned to you right now."
      />
    </section>
  );
}
