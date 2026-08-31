import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { CardHeader } from "@/components/ui/surface-card";
import { queuePrimaryAction, queueWhyNow } from "@/lib/ops/queue-today";
import type { DecoratedAction } from "@/lib/playbooks/decorate";

export type NextActionRow = DecoratedAction;

export function NextActionsQueue({
  rows,
  title = "Next Actions",
  description,
  empty = "Nothing needs your attention.",
  compact = false,
}: {
  rows: NextActionRow[];
  title?: string;
  description?: string;
  empty?: string;
  compact?: boolean;
}) {
  return (
    <section>
      <div className="mb-3">
        <CardHeader title={title} description={description} meta={rows.length} />
      </div>
      {rows.length === 0 ? (
        <p className="text-sm leading-6 text-ink-muted">{empty}</p>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {rows.map((row) => {
            const action = queuePrimaryAction(row);
            return (
              <li
                key={row.id}
                className="flex flex-wrap items-start justify-between gap-3 py-4"
              >
                <Link href={action.href} className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{row.borrowerName}</p>
                  <p className="mt-1 text-sm leading-6 text-ink">{row.title}</p>
                  <p
                    className={`mt-0.5 text-sm leading-6 ${
                      row.escalationDue || row.followUpDue
                        ? "text-warning"
                        : "text-ink-muted"
                    }`}
                  >
                    {queueWhyNow(row)}
                  </p>
                </Link>
                {compact ? null : (
                  <Link
                    href={action.href}
                    className={`${buttonClass("accent", "sm")} shrink-0`}
                  >
                    {action.label}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
