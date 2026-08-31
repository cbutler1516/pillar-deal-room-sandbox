import Link from "next/link";
import { CopyTextButton } from "@/components/copy-text-button";
import { CardHeader, SurfaceCard } from "@/components/ui/surface-card";
import { formatTimestamp } from "@/lib/format";
import type { DecoratedAction } from "@/lib/playbooks/decorate";
import { escalationLabel } from "@/lib/playbooks/logic";

export type NextActionRow = DecoratedAction;

export function NextActionsQueue({
  rows,
  title = "Next Actions",
  description = "Ranked work with source, contact, and the next concrete action.",
  empty = "You’re clear for now. No processor actions need attention.",
}: {
  rows: NextActionRow[];
  title?: string;
  description?: string;
  empty?: string;
}) {
  return (
    <SurfaceCard padded={false} elevated>
      <div className="px-5 py-4">
        <CardHeader title={title} description={description} meta={rows.length} />
      </div>
      {rows.length === 0 ? (
        <p className="px-5 pb-4 text-sm text-ink-muted">{empty}</p>
      ) : (
        <ul>
          {rows.map((row) => (
            <li
              key={row.id}
              className="grid gap-3 border-t border-line px-5 py-3.5 hover:bg-surface-muted/50 lg:grid-cols-[minmax(0,1.5fr)_minmax(12rem,0.9fr)_auto]"
            >
              <Link href={`/deals/${row.dealId}?tab=tasks`} className="min-w-0">
                <p className="text-sm font-semibold text-ink">{row.borrowerName}</p>
                <p className="text-xs text-ink-muted">
                  {row.entityName ?? row.dealReference}
                </p>
                <p className="mt-1 text-sm text-ink">{row.title}</p>
                <p className="mt-0.5 truncate text-xs text-ink-muted">
                  {row.suggestedRequest ||
                    row.instructionsSummary ||
                    "Open the task for instructions."}
                </p>
              </Link>
              <div className="text-xs text-ink-muted">
                <p>
                  {row.sourceType?.replaceAll("_", " ") ?? "Internal"}
                  {row.contactMissing
                    ? " · Contact missing"
                    : row.contactName
                      ? ` · ${row.contactName}`
                      : ""}
                </p>
                <p className="mt-1">
                  {row.followUpDue ? "Follow-up overdue" : "Follow-up"}{" "}
                  {formatTimestamp(row.nextFollowUpAt)}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {row.requestText ? (
                    <CopyTextButton value={row.requestText} label="Copy Request" />
                  ) : null}
                  {row.contactEmail ? (
                    <CopyTextButton value={row.contactEmail} label="Copy Email" />
                  ) : null}
                  {row.contactPhone ? (
                    <CopyTextButton value={row.contactPhone} label="Copy Phone" />
                  ) : null}
                </div>
              </div>
              <div className="flex flex-col items-start gap-1 text-xs sm:items-end">
                <p className="capitalize text-ink">{row.priority}</p>
                <p className="capitalize text-ink-muted">
                  {row.status.replaceAll("_", " ")}
                </p>
                {row.escalationDue ? (
                  <p className="font-medium text-danger">
                    {escalationLabel(row.escalationLevel, row.escalationDue)}
                  </p>
                ) : null}
                {row.priority === "urgent" ? (
                  <p className="font-medium text-danger">Urgent</p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </SurfaceCard>
  );
}
