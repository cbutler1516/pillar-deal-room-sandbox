import { NextActionsQueue } from "@/components/next-actions-queue";
import { TaskBoard } from "@/components/task-board";
import { buttonClass } from "@/components/ui/button";
import { SearchField, SegmentedControl, SelectField } from "@/components/ui/controls";
import { PageHeader } from "@/components/ui/page-header";
import { SurfaceCard } from "@/components/ui/surface-card";
import { pageWidthClass } from "@/components/ui/styles";
import { requireInternalUser } from "@/lib/auth/session";
import { listQueueContacts, listWorkspaceTasks } from "@/lib/data/deals";
import { loadDealSnapshot } from "@/lib/data/snapshot";
import {
  hrefWithQuery,
  matchesTaskQuery,
  taskSearchHaystack,
} from "@/lib/ops/ops-board";
import { matchesQueueFilter, parseQueueFilter } from "@/lib/communications/filters";
import { decorateBoardTasks, decorateRankedActions } from "@/lib/playbooks/decorate";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const scope = typeof params.scope === "string" ? params.scope : "all";
  const source = typeof params.source === "string" ? params.source : "all";
  const timing = typeof params.timing === "string" ? params.timing : "all";
  const priority = typeof params.priority === "string" ? params.priority : "all";
  const dealId = typeof params.deal === "string" ? params.deal : "all";
  const followUp = typeof params.followUp === "string" ? params.followUp : "all";
  const escalated = typeof params.escalated === "string" ? params.escalated : "all";
  const queue = parseQueueFilter(typeof params.queue === "string" ? params.queue : undefined);
  const view = typeof params.view === "string" ? params.view : "list";
  const query = typeof params.q === "string" ? params.q : "";
  const { supabase, user } = await requireInternalUser();
  const snapshot = await loadDealSnapshot(supabase);
  const [tasks, contacts] = await Promise.all([
    listWorkspaceTasks(supabase),
    listQueueContacts(supabase),
  ]);
  const queryState = {
    q: query || undefined,
    scope: scope === "all" ? undefined : scope,
    source: source === "all" ? undefined : source,
    timing: timing === "all" ? undefined : timing,
    priority: priority === "all" ? undefined : priority,
    deal: dealId === "all" ? undefined : dealId,
    followUp: followUp === "all" ? undefined : followUp,
    escalated: escalated === "all" ? undefined : escalated,
    queue: queue ?? undefined,
    view: view === "list" ? undefined : view,
  };

  const filtered = decorateBoardTasks(tasks, snapshot.deals, contacts, snapshot.needs).filter((row) => {
    if (scope === "mine" && row.assignedTo !== user.id) {
      return false;
    }
    if (source !== "all" && row.sourceType !== source) {
      return false;
    }
    if (timing !== "all" && row.timing !== timing) {
      return false;
    }
    if (priority !== "all" && row.priority !== priority) {
      return false;
    }
    if (dealId !== "all" && row.dealId !== dealId) {
      return false;
    }
    if (followUp === "due" && !row.followUpDue) {
      return false;
    }
    if (escalated === "yes" && !row.escalationDue) {
      return false;
    }
    if (!matchesQueueFilter(row, queue)) {
      return false;
    }
    return matchesTaskQuery(
      taskSearchHaystack({
        borrowerName: row.borrowerName,
        entityName: row.entityName,
        dealReference: row.dealReference,
        propertyAddress: row.propertyAddress,
        title: row.title,
      }),
      query,
    );
  });
  const listRows = decorateRankedActions(tasks, snapshot.deals, contacts, snapshot.needs).filter((row) =>
    filtered.some((item) => item.id === row.id),
  );

  return (
    <div className={`${pageWidthClass} space-y-6`}>
      <PageHeader
        title="Tasks"
        description="Operational work across deals. Same ranking and board rules as the processor queue."
      />
      <SurfaceCard>
        <form className="grid gap-2 lg:grid-cols-6">
          <SearchField
            name="q"
            defaultValue={query}
            placeholder="Search borrower, task, deal, property"
            className="lg:col-span-2"
          />
          <SelectField name="scope" defaultValue={scope}>
            <option value="all">All Tasks</option>
            <option value="mine">My Tasks</option>
          </SelectField>
          <SelectField name="source" defaultValue={source}>
            <option value="all">All sources</option>
            <option value="borrower">Borrower</option>
            <option value="title">Title</option>
            <option value="insurance">Insurance</option>
            <option value="internal">Internal</option>
          </SelectField>
          <SelectField name="timing" defaultValue={timing}>
            <option value="all">All timing</option>
            <option value="required_now">Required now</option>
            <option value="required_later">Required later</option>
            <option value="optional">Optional</option>
          </SelectField>
          <SelectField name="priority" defaultValue={priority}>
            <option value="all">All priority</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
          </SelectField>
          <SelectField name="deal" defaultValue={dealId}>
            <option value="all">All deals</option>
            {snapshot.deals.map((deal) => (
              <option key={deal.id} value={deal.id}>
                {deal.borrowerName}
              </option>
            ))}
          </SelectField>
          <SelectField name="followUp" defaultValue={followUp}>
            <option value="all">Any follow-up</option>
            <option value="due">Follow-up due</option>
          </SelectField>
          <SelectField name="escalated" defaultValue={escalated}>
            <option value="all">Any escalation</option>
            <option value="yes">Escalated</option>
          </SelectField>
          <SelectField name="queue" defaultValue={queue ?? "all"}>
            <option value="all">All queue states</option>
            <option value="due_today">Due today</option>
            <option value="overdue">Follow-up overdue</option>
            <option value="waiting_borrower">Waiting on borrower</option>
            <option value="waiting_third_party">Waiting on third party</option>
            <option value="escalated">Escalated</option>
            <option value="no_contact">No contact</option>
            <option value="response_received">Response received</option>
            <option value="ready_review">Ready for review</option>
          </SelectField>
          {view !== "list" ? <input type="hidden" name="view" value={view} /> : null}
          <button type="submit" className={buttonClass("primary", "sm")}>
            Apply
          </button>
          <div className="lg:col-span-2">
            <SegmentedControl
              options={[
                {
                  label: "List",
                  href: hrefWithQuery("/tasks", queryState, { view: undefined }),
                  active: view !== "board",
                },
                {
                  label: "Board",
                  href: hrefWithQuery("/tasks", queryState, { view: "board" }),
                  active: view === "board",
                },
              ]}
            />
          </div>
        </form>
      </SurfaceCard>
      {view === "board" ? (
        <TaskBoard rows={filtered} />
      ) : (
        <NextActionsQueue
          rows={listRows}
          title="Task list"
          description="Ranked active work. Completed items appear on the board."
        />
      )}
    </div>
  );
}
