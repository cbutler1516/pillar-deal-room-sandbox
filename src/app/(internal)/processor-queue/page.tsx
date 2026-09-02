import Link from "next/link";
import { NextActionsQueue } from "@/components/next-actions-queue";
import { StatusChip } from "@/components/status-chip";
import { StaffPresence } from "@/components/ui/staff-avatar";
import { TaskBoard } from "@/components/task-board";
import { PageHeader } from "@/components/ui/page-header";
import {
  ChipGroup,
  FilterChip,
  SearchField,
  SegmentedControl,
  SelectField,
  Toolbar,
} from "@/components/ui/controls";
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
} from "@/lib/ops/operational-work";
import { workQueueRow } from "@/lib/ops/queue-today";
import { formatAgeDays, formatCurrency, formatProperty } from "@/lib/format";
import { decorateBoardTasks } from "@/lib/playbooks/decorate";
import {
  filterOperationalWork,
  QUEUE_BUCKET_FILTERS,
  QUEUE_SOURCE_FILTERS,
  type QueueBucketFilter,
  type QueueSourceFilter,
} from "@/lib/command-center/filters";

const SECTIONS = [
  { key: "unassigned", label: "Unassigned" },
  { key: "missingItems", label: "Missing items" },
  { key: "documentsToReview", label: "Documents to review" },
  { key: "exceptions", label: "Exceptions" },
  { key: "readyForSubmission", label: "Ready to submit" },
] as const;

const WORK_FILTERS = [
  { value: "all", label: "All work" },
  { value: "attention", label: "Files needing attention" },
  { value: "new", label: "New" },
  { value: "review", label: "Needs review" },
  { value: "missing_contact", label: "Missing contact" },
  { value: "replacement", label: "Replacement" },
  { value: "follow_up", label: "Follow-up" },
  { value: "waiting", label: "Waiting" },
  { value: "escalated", label: "Escalated" },
  { value: "ready", label: "Ready to submit" },
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
  const bucket =
    typeof params.bucket === "string" &&
    QUEUE_BUCKET_FILTERS.includes(params.bucket as QueueBucketFilter)
      ? (params.bucket as QueueBucketFilter)
      : undefined;
  const source =
    typeof params.source === "string" &&
    QUEUE_SOURCE_FILTERS.includes(params.source as QueueSourceFilter)
      ? (params.source as QueueSourceFilter)
      : undefined;
  const queryState = {
    q: query || undefined,
    assignment: assignment === "all" ? undefined : assignment,
    urgency: urgency === "all" ? undefined : urgency,
    view: view === "today" ? undefined : view,
    work: work === "all" ? undefined : work,
    bucket,
    source,
  };

  const { supabase, user } = await requireInternalUser();
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
  const allItems = operationalWorkFromSnapshot(snapshot, now);
  const workItems = filterOperationalWork({
    items: allItems.filter((row) =>
      matchesTaskQuery(
        taskSearchHaystack({
          borrowerName: row.borrowerName,
          entityName: row.entityName,
          dealReference: row.dealReference,
          propertyAddress: snapshot.deals.find((deal) => deal.id === row.dealId)
            ?.propertyAddress,
          title: row.title,
        }),
        query,
      ),
    ),
    assignment,
    bucket,
    source,
    work,
    currentUserId: user.id,
    tasks: snapshot.tasks,
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

      <Toolbar
        chips={
          <>
            <ChipGroup label="Status">
              {(
                [
                  ["urgent", "Urgent"],
                  ["due_today", "Due today"],
                  ["review", "Review"],
                  ["waiting", "Waiting"],
                  ["new", "New"],
                  ["ready", "Ready"],
                ] as const
              ).map(([value, label]) => (
                <FilterChip
                  key={value}
                  active={bucket === value}
                  href={hrefWithQuery("/processor-queue", queryState, {
                    bucket: bucket === value ? undefined : value,
                    work: undefined,
                  })}
                >
                  {label}
                </FilterChip>
              ))}
            </ChipGroup>
            <span aria-hidden className="mx-1 h-4 w-px bg-line" />
            <ChipGroup label="Source">
              {(
                [
                  ["borrower", "Borrower"],
                  ["title", "Title"],
                  ["insurance", "Insurance"],
                  ["lender", "Lender"],
                ] as const
              ).map(([value, label]) => (
                <FilterChip
                  key={value}
                  active={source === value}
                  href={hrefWithQuery("/processor-queue", queryState, {
                    source: source === value ? undefined : value,
                  })}
                >
                  {label}
                </FilterChip>
              ))}
            </ChipGroup>
          </>
        }
      >
        <form className="flex flex-1 flex-wrap items-center gap-2">
          <SearchField
            name="q"
            compact
            defaultValue={query}
            placeholder="Search borrower, entity, property, file ID"
            className="min-w-56 flex-1"
          />
          <SelectField name="assignment" compact defaultValue={assignment}>
            <option value="all">All</option>
            <option value="mine">Mine</option>
            <option value="unassigned">Unassigned</option>
            {staff.map((person) => (
              <option key={person.id} value={person.id}>
                {staffDisplayName(person)}
              </option>
            ))}
          </SelectField>
          <SelectField name="work" compact defaultValue={work}>
            {WORK_FILTERS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectField>
          <SelectField name="urgency" compact defaultValue={urgency}>
            <option value="all">All urgency</option>
            <option value="exceptions">Exceptions first</option>
            <option value="aging">Aging 7+ days</option>
          </SelectField>
          {view !== "today" ? <input type="hidden" name="view" value={view} /> : null}
          {bucket ? <input type="hidden" name="bucket" value={bucket} /> : null}
          {source ? <input type="hidden" name="source" value={source} /> : null}
          <button type="submit" className={buttonClass("secondary", "sm")}>
            Apply
          </button>
        </form>
      </Toolbar>

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
            } else if (assignment !== "all") {
              rows = rows.filter((row) => row.assignedProcessorId === assignment);
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
        <div className="space-y-8 xl:grid xl:grid-cols-[minmax(0,1.4fr)_minmax(17rem,0.8fr)] xl:items-start xl:gap-8 xl:space-y-0">
          <div className="space-y-8">
            {QUEUE_TODAY_SECTIONS.filter((section) =>
              section.key === "urgent" ||
              section.key === "due_today" ||
              section.key === "needs_review",
            ).map((section) => (
              <NextActionsQueue
                key={section.key}
                rows={today[section.key].map(toQueueRow)}
                staffNames={staffNames}
                title={section.label}
                empty={
                  section.key === "needs_review"
                    ? "Nothing is ready to review."
                    : section.key === "due_today"
                      ? "Nothing else is due today."
                      : "No urgent items."
                }
              />
            ))}
          </div>
          <div className="space-y-8">
            {QUEUE_TODAY_SECTIONS.filter(
              (section) => section.key === "waiting" || section.key === "new",
            ).map((section) => {
              if (today[section.key].length === 0 && section.key === "new") {
                return null;
              }
              return (
                <NextActionsQueue
                  key={section.key}
                  rows={today[section.key].map(toQueueRow)}
                  staffNames={staffNames}
                  title={section.label}
                  compact
                  empty={
                    section.key === "waiting"
                      ? "Nobody is waiting on a reply."
                      : "No new files."
                  }
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
