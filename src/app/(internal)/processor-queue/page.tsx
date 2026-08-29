import Link from "next/link";
import { NextActionsQueue } from "@/components/next-actions-queue";
import { StatusChip } from "@/components/status-chip";
import { TaskBoard } from "@/components/task-board";
import { PageHeader } from "@/components/ui/page-header";
import { SearchField, SegmentedControl, SelectField } from "@/components/ui/controls";
import { CardHeader, SurfaceCard } from "@/components/ui/surface-card";
import { buttonClass } from "@/components/ui/button";
import { linkClass, pageWidthClass } from "@/components/ui/styles";
import { requireInternalUser } from "@/lib/auth/session";
import { listQueueContacts, listWorkspaceTasks } from "@/lib/data/deals";
import { queueSectionIds } from "@/lib/data/dashboard";
import { loadDealSnapshot } from "@/lib/data/snapshot";
import {
  ageInDays,
  dealExceptionCount,
  documentCompletion,
} from "@/lib/ops/metrics";
import {
  hrefWithQuery,
  matchesTaskQuery,
  taskSearchHaystack,
} from "@/lib/ops/ops-board";
import { formatAgeDays, formatCurrency, formatProperty } from "@/lib/format";
import { decorateBoardTasks, decorateRankedActions } from "@/lib/playbooks/decorate";

const SECTIONS = [
  { key: "unassigned", label: "Unassigned" },
  { key: "missingItems", label: "Missing Items" },
  { key: "documentsToReview", label: "Documents To Review" },
  { key: "exceptions", label: "Exceptions" },
  { key: "readyForSubmission", label: "Ready For Submission" },
] as const;

export default async function ProcessorQueuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const urgency = typeof params.urgency === "string" ? params.urgency : "all";
  const assignment =
    typeof params.assignment === "string" ? params.assignment : "all";
  const view = typeof params.view === "string" ? params.view : "priority";
  const query = typeof params.q === "string" ? params.q : "";
  const queryState = {
    q: query || undefined,
    assignment: assignment === "all" ? undefined : assignment,
    urgency: urgency === "all" ? undefined : urgency,
    view: view === "priority" ? undefined : view,
  };

  const { supabase } = await requireInternalUser();
  const snapshot = await loadDealSnapshot(supabase);
  const [queueTasks, queueContacts] = await Promise.all([
    listWorkspaceTasks(supabase),
    listQueueContacts(supabase),
  ]);
  const nextActions = decorateRankedActions(
    queueTasks,
    snapshot.deals,
    queueContacts,
  ).filter((row) =>
    matchesTaskQuery(
      taskSearchHaystack({
        borrowerName: row.borrowerName,
        entityName: row.entityName,
        dealReference: row.dealReference,
        propertyAddress: row.propertyAddress,
        title: row.title,
      }),
      query,
    ),
  );
  const boardRows = decorateBoardTasks(
    queueTasks,
    snapshot.deals,
    queueContacts,
  ).filter((row) =>
    matchesTaskQuery(
      taskSearchHaystack({
        borrowerName: row.borrowerName,
        entityName: row.entityName,
        dealReference: row.dealReference,
        propertyAddress: row.propertyAddress,
        title: row.title,
      }),
      query,
    ),
  );
  const sections = queueSectionIds(
    snapshot.deals,
    snapshot.needs,
    snapshot.documents,
    snapshot.tasks,
  );

  const decorate = (id: string) => {
    const deal = snapshot.deals.find((item) => item.id === id);
    if (!deal) return null;
    const exceptions = dealExceptionCount(
      deal.id,
      snapshot.needs,
      snapshot.documents,
      snapshot.tasks,
    );
    const docs = documentCompletion(deal.id, snapshot.needs);
    const ageDays = ageInDays(deal.createdAt);
    return { ...deal, exceptions, docs, ageDays };
  };

  return (
    <div className={`${pageWidthClass} space-y-6`}>
      <PageHeader
        title="Processor Queue"
        description="Work the ranked queue, or scan the board by status."
      />

      <SurfaceCard>
        <form className="flex flex-wrap items-center gap-2">
          <SearchField
            name="q"
            defaultValue={query}
            placeholder="Search borrower, task, deal, property"
            className="min-w-56 flex-1"
          />
          <SelectField name="assignment" defaultValue={assignment}>
            <option value="all">All assignments</option>
            <option value="unassigned">Unassigned only</option>
          </SelectField>
          <SelectField name="urgency" defaultValue={urgency}>
            <option value="all">All urgency</option>
            <option value="exceptions">Exceptions first</option>
            <option value="aging">Aging 7+ days</option>
          </SelectField>
          {view !== "priority" ? <input type="hidden" name="view" value={view} /> : null}
          <button type="submit" className={buttonClass("primary", "sm")}>
            Apply
          </button>
          <SegmentedControl
            options={[
              {
                label: "Priority",
                href: hrefWithQuery("/processor-queue", queryState, { view: undefined }),
                active: view !== "board",
              },
              {
                label: "Board",
                href: hrefWithQuery("/processor-queue", queryState, { view: "board" }),
                active: view === "board",
              },
            ]}
          />
        </form>
      </SurfaceCard>

      {view === "board" ? (
        <TaskBoard rows={boardRows} />
      ) : (
        <>
          <NextActionsQueue rows={nextActions} />
          <div className="space-y-4">
            {SECTIONS.map((section) => {
              let rows = sections[section.key]
                .map(decorate)
                .filter((row) => row != null);

              if (assignment === "unassigned") {
                rows = rows.filter((row) => !row.assignedProcessorId);
              }
              if (urgency === "exceptions") {
                rows = rows.filter((row) => row.exceptions > 0);
              }
              if (urgency === "aging") {
                rows = rows.filter((row) => row.ageDays >= 7);
              }
              if (query) {
                rows = rows.filter((row) =>
                  matchesTaskQuery(
                    taskSearchHaystack({
                      borrowerName: row.borrowerName,
                      entityName: row.entityName,
                      dealReference: row.dealReference,
                      propertyAddress: row.propertyAddress,
                    }),
                    query,
                  ),
                );
              }
              rows.sort((a, b) => b.exceptions - a.exceptions || b.ageDays - a.ageDays);

              return (
                <SurfaceCard key={section.key} padded={false}>
                  <div className="px-5 py-4">
                    <CardHeader title={section.label} meta={rows.length} />
                  </div>
                  {rows.length === 0 ? (
                    <p className="px-5 pb-4 text-sm text-ink-muted">
                      Nothing in this queue lane.
                    </p>
                  ) : (
                    <ul>
                      {rows.map((deal) => (
                        <li
                          key={`${section.key}-${deal.id}`}
                          className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3.5"
                        >
                          <div>
                            <Link href={`/deals/${deal.id}`} className={`text-sm ${linkClass}`}>
                              {deal.borrowerName}
                            </Link>
                            <p className="text-xs text-ink-muted">
                              {deal.loanType} · {formatCurrency(deal.loanAmount)} ·{" "}
                              {formatProperty(deal.propertyCity, deal.propertyState)}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 text-xs">
                            <StatusChip status={deal.status} />
                            <span className="text-ink-muted">
                              Docs {deal.docs.complete}/{deal.docs.required}
                            </span>
                            <span
                              className={
                                deal.exceptions > 0
                                  ? "font-medium text-danger"
                                  : "text-ink-muted"
                              }
                            >
                              {deal.exceptions} exc
                            </span>
                            <span className="text-ink-muted">
                              {formatAgeDays(deal.ageDays)}
                            </span>
                            <span className="text-ink-muted">
                              {deal.assignedProcessorId ? "Assigned" : "Unassigned"}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </SurfaceCard>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
