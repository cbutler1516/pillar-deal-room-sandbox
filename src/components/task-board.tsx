import Link from "next/link";
import { TaskBadges } from "@/components/task-badges";
import { BOARD_COLUMNS, boardColumnForStatus } from "@/lib/ops/ops-board";
import { formatTimestamp } from "@/lib/format";
import type { DecoratedAction } from "@/lib/playbooks/decorate";

const EMPTY: Record<string, string> = {
  todo: "You’re clear for now.",
  in_progress: "Nothing is in processor hands.",
  waiting: "No one is being waited on.",
  done: "No completed items in this view.",
};

export function TaskBoard({ rows }: { rows: DecoratedAction[] }) {
  return (
    <div className="grid gap-4 xl:grid-cols-4">
      {BOARD_COLUMNS.map((column) => {
        const cards = rows.filter(
          (row) => boardColumnForStatus(row.status) === column.key,
        );
        return (
          <section key={column.key} className="min-w-0">
            <div className="mb-2 flex items-baseline justify-between px-0.5">
              <h3 className="text-sm font-semibold text-ink">{column.label}</h3>
              <span className="text-[11px] tabular-nums text-ink-muted">
                {cards.length}
              </span>
            </div>
            <ul className="rounded-[14px] border border-line bg-surface">
              {cards.length === 0 ? (
                <li className="px-3 py-6 text-xs text-ink-muted">
                  {EMPTY[column.key] ?? "You’re clear for now."}
                </li>
              ) : (
                cards.map((row, index) => (
                  <li
                    key={row.id}
                    className={index === 0 ? "" : "border-t border-line"}
                  >
                    <Link
                      href={`/deals/${row.dealId}?tab=tasks`}
                      className="block px-3 py-2.5 hover:bg-surface-muted/70"
                    >
                      <p className="text-sm font-medium text-ink">{row.borrowerName}</p>
                      <p className="text-xs text-ink-muted">{row.dealReference}</p>
                      <p className="mt-1 text-sm text-ink">{row.title}</p>
                      <p className="mt-1 text-xs text-ink-muted">
                        {row.contactMissing
                          ? "Contact missing"
                          : row.contactName ?? row.sourceType?.replaceAll("_", " ")}
                        {" · "}
                        {formatTimestamp(row.nextFollowUpAt)}
                      </p>
                      <div className="mt-1">
                        <TaskBadges row={row} compact />
                      </div>
                    </Link>
                  </li>
                ))
              )}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
