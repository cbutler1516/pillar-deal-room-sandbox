import Link from "next/link";
import { NextActionsQueue } from "@/components/next-actions-queue";
import { StatusChip } from "@/components/status-chip";
import { StaffPresence } from "@/components/ui/staff-avatar";
import { TaskBoard } from "@/components/task-board";
import { PageHeader } from "@/components/ui/page-header";
import { SearchField, SegmentedControl, SelectField } from "@/components/ui/controls";
import { CardHeader } from "@/components/ui/surface-card";
import { buttonClass } from "@/components/ui/button";
import { linkClass, pageWidthClass } from "@/components/ui/styles";
import { requireInternalUser } from "@/lib/auth/session";
import { listActiveStaff } from "@/lib/communications/data";
import { listQueueContacts, listWorkspaceTasks, staffDisplayName } from "@/lib/data/deals";
import { operationalWorkFromSnapshot, queueSectionIds } from "@/lib/data/dashboard";
import { loadDealSnapshot } from "@/lib/data/snapshot";
import {
  ageInDays,
  dealExceptionCount,
  documentCompletion,
} from "@/lib/ops/metrics";
import { compareDealPriority, rankDealPriority } from "@/lib/ops/priority";
import {
  hrefWithQuery,
  matchesTaskQuery,
  taskSearchHaystack,
} from "@/lib/ops/ops-board";
import {
  QUEUE_TODAY_SECTIONS,
  groupOperationalWorkToday,
  hasActionableOperationalWork,
  workItemMatchesFilter,
} from "@/lib/ops/operational-work";
import { workQueueRow } from "@/lib/ops/queue-today";
import { formatAgeDays, formatCurrency, formatProperty } from "@/lib/format";
import { decorateBoardTasks } from "@/lib/playbooks/decorate";

const SECTIONS = [
  { key: "unassigned", label: "Unassigned" },
  { key: "missingItems", label: "Missing items" },
  { key: "documentsToReview", label: "Documents to review" },
  { key: "exceptions", label: "Exceptions" },
  { key: "readyForSubmission", label: "Ready to submit" },
] as const;

const WORK_FILTERS = [
  { value: "all", label: "All work" },
  { value: "attention", label: "Needs attention" },
  { value: "new", label: "New" },
  { value: "review", label: "Needs review" },
  { value: "missing_contact", label: "Missing contact" },
  { value: "replacement", label: "Replacement" },
  { value: "follow_up", label: "Follow-up" },
  { value: "waiting", label: "Waiting" },
  { value: "escalated", label: "Escalated" },
  { value: "ready", label: "Ready" },
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
  const view = typeof params.view === "string" ? params.view : "today";
  const query = typeof params.q === "string" ? params.q : "";
  const work = typeof params.work === "string" ? params.work : "all";
  const queryState = {
    q: query || undefined,
    assignment: assignment === "all" ? undefined : assignment,
    urgency: urgency === "all" ? undefined : urgency,
    view: view === "today" ? undefined : view,
    work: work === "all" ? undefined : work,
  };

  const { supabase } = await requireInternalUser();
  const snapshot = await loadDealSnapshot(supabase);
  const [queueTasks, queueContacts, staff] = await Promise.all([
    listWorkspaceTasks(supabase),
    listQueueContacts(supabase),
    listActiveStaff(supabase),
  ]);
  const staffNames = Object.fromEntries(
    staff.map((person) => [person.id, staffDisplayName(person)]),
  );
  const now = new Date();
  const workItems = operationalWorkFromSnapshot(snapshot, now).filter((row) => {
    if (assignment === "unassigned" && row.assignedProcessorId) {
      return false;
    }
    if (!workItemMatchesFilter(row, work)) {
      return false;
    }
    return matchesTaskQuery(
      taskSearchHaystack({
        borrowerName: row.borrowerName,
        entityName: row.entityName,
        dealReference: row.dealReference,
        title: row.title,
      }),
      query,
    );
  });
  const boardRows = decorateBoardTasks(
    queueTasks,
    snapshot.deals,
    queueContacts,
    snapshot.needs,
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
  const today = groupOperationalWorkToday(workItems);
  const hasWork = hasActionableOperationalWork(workItems);
  const locationByDeal = Object.fromEntries(
    snapshot.deals.map((deal) => [
      deal.id,
      formatProperty(deal.propertyCity, deal.propertyState),
    ]),
  );
  const toQueueRow = (row: (typeof workItems)[number]) =>
    workQueueRow(row, { location: locationByDeal[row.dealId] });

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
    const priority = rankDealPriority(
      {
        id: deal.id,
        status: deal.status,
        assignedProcessorId: deal.assignedProcessorId,
        createdAt: deal.createdAt,
        dealReference: deal.dealReference,
      },
      snapshot.needs.map((need) => ({
        ...need,
        timing:
          snapshot.tasks.find((task) => task.clientNeedId === need.id)?.timing ??
          null,
      })),
      snapshot.documents,
      snapshot.tasks,
    );
    return { ...deal, exceptions, docs, ageDays, priority };
  };

  return (
    <div className={`${pageWidthClass} space-y-8`}>
      <PageHeader
        title="Queue"
        description="Today’s work, in the order it should be handled."
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          options={[
            {
              label: "Today",
              href: hrefWithQuery("/processor-queue", queryState, { view: undefined }),
              active: view !== "files" && view !== "board",
            },
            {
              label: "Files",
              href: hrefWithQuery("/processor-queue", queryState, { view: "files" }),
              active: view === "files",
            },
            {
              label: "Board",
              href: hrefWithQuery("/processor-queue", queryState, { view: "board" }),
              active: view === "board",
            },
          ]}
        />
        <Link href="/tasks" className={`text-sm ${linkClass}`}>
          Tasks
        </Link>
      </div>

      <details className="group" open={work !== "all"}>
        <summary className="cursor-pointer text-sm font-medium text-ink-muted">
          Filter
        </summary>
        <form className="mt-3 flex flex-wrap items-center gap-2">
          <SearchField
            name="q"
            defaultValue={query}
            placeholder="Search borrower, task, deal, property"
            className="min-w-56 flex-1"
          />
          <SelectField name="work" defaultValue={work}>
            {WORK_FILTERS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectField>
          <SelectField name="assignment" defaultValue={assignment}>
            <option value="all">All assignments</option>
            <option value="unassigned">Unassigned only</option>
          </SelectField>
          <SelectField name="urgency" defaultValue={urgency}>
            <option value="all">All urgency</option>
            <option value="exceptions">Exceptions first</option>
            <option value="aging">Aging 7+ days</option>
          </SelectField>
          {view !== "today" ? <input type="hidden" name="view" value={view} /> : null}
          <button type="submit" className={buttonClass("accent", "sm")}>
            Apply
          </button>
        </form>
      </details>

      {view === "board" ? (
        <TaskBoard rows={boardRows} />
      ) : view === "files" ? (
        <div className="space-y-8">
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
            rows.sort((a, b) => compareDealPriority(a.priority, b.priority));

            return (
              <section key={section.key}>
                <CardHeader title={section.label} meta={rows.length} />
                {rows.length === 0 ? (
                  <p className="text-sm leading-6 text-ink-muted">
                    Nothing in this lane.
                  </p>
                ) : (
                  <ul className="divide-y divide-line border-y border-line">
                    {rows.map((deal) => (
                      <li
                        key={`${section.key}-${deal.id}`}
                        className="flex flex-wrap items-center justify-between gap-3 py-4"
                      >
                        <div>
                          <Link href={`/deals/${deal.id}`} className={`text-sm ${linkClass}`}>
                            {deal.borrowerName}
                          </Link>
                          <p className="text-sm leading-6 text-ink-muted">
                            {deal.loanType} · {formatCurrency(deal.loanAmount)} ·{" "}
                            {formatProperty(deal.propertyCity, deal.propertyState)}
                          </p>
                          <p className="text-xs text-ink-muted">
                            {deal.priority.label}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          <StatusChip status={deal.status} />
                          <StaffPresence
                            name={
                              deal.assignedProcessorId
                                ? staffNames[deal.assignedProcessorId]
                                : null
                            }
                            unassigned={!deal.assignedProcessorId}
                          />
                          <span className="text-ink-muted">
                            {formatAgeDays(deal.ageDays)}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      ) : !hasWork ? (
        <p className="text-sm leading-6 text-ink-muted">
          Nothing needs your attention.
        </p>
      ) : (
        <div className="space-y-8">
          {QUEUE_TODAY_SECTIONS.map((section) => {
            const rows = today[section.key];
            if (rows.length === 0 && section.key === "new") {
              return null;
            }
            return (
              <NextActionsQueue
                key={section.key}
                rows={rows.map(toQueueRow)}
                staffNames={staffNames}
                title={section.label}
                empty={
                  section.key === "waiting"
                    ? "Nobody is waiting on a reply."
                    : section.key === "needs_review"
                      ? "Nothing is ready to review."
                      : section.key === "due_today"
                        ? "Nothing else is due today."
                        : section.key === "new"
                          ? "No new files."
                          : "No urgent items."
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
