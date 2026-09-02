import { TaskBoard } from "@/components/task-board";
import { WorkLedger } from "@/components/ui/work-ledger";
import { buttonClass } from "@/components/ui/button";
import {
  SearchField,
  SegmentedControl,
  SelectField,
  Toolbar,
} from "@/components/ui/controls";
import { PageHeader } from "@/components/ui/page-header";
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
import { queuePrimaryAction, queueWhyNow } from "@/lib/ops/queue-today";

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
        description="Assigned actions. Daily work is in Work."
      />
      <Toolbar
        trailing={
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
        }
      >
        <form className="grid flex-1 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <SearchField
            name="q"
            compact
            defaultValue={query}
            placeholder="Search borrower, task, deal, property"
            className="sm:col-span-3 lg:col-span-2"
          />
          <SelectField name="scope" compact defaultValue={scope}>
            <option value="all">All Tasks</option>
            <option value="mine">My Tasks</option>
          </SelectField>
          <SelectField name="source" compact defaultValue={source}>
            <option value="all">All sources</option>
            <option value="borrower">Borrower</option>
            <option value="title">Title</option>
            <option value="insurance">Insurance</option>
            <option value="internal">Internal</option>
          </SelectField>
          <SelectField name="timing" compact defaultValue={timing}>
            <option value="all">Any timing</option>
            <option value="required_now">Needed now</option>
            <option value="required_later">Needed later</option>
            <option value="optional">Optional</option>
          </SelectField>
          <SelectField name="priority" compact defaultValue={priority}>
            <option value="all">All priority</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
          </SelectField>
          <SelectField name="deal" compact defaultValue={dealId}>
            <option value="all">All deals</option>
            {snapshot.deals.map((deal) => (
              <option key={deal.id} value={deal.id}>
                {deal.borrowerName}
              </option>
            ))}
          </SelectField>
          <SelectField name="followUp" compact defaultValue={followUp}>
            <option value="all">Any follow-up</option>
            <option value="due">Follow-up due</option>
          </SelectField>
          <SelectField name="escalated" compact defaultValue={escalated}>
            <option value="all">Any escalation</option>
            <option value="yes">Escalated</option>
          </SelectField>
          <SelectField name="queue" compact defaultValue={queue ?? "all"}>
            <option value="all">Any status</option>
            <option value="due_today">Due today</option>
            <option value="overdue">Follow-up overdue</option>
            <option value="waiting_borrower">Waiting for borrower</option>
            <option value="waiting_third_party">Waiting for third party</option>
            <option value="escalated">Escalated</option>
            <option value="no_contact">No contact</option>
            <option value="response_received">Reply received</option>
            <option value="ready_review">Ready for review</option>
          </SelectField>
          {view !== "list" ? <input type="hidden" name="view" value={view} /> : null}
          <button type="submit" className={buttonClass("secondary", "sm")}>
            Apply
          </button>
        </form>
      </Toolbar>
      {view === "board" ? (
        <TaskBoard rows={filtered} />
      ) : (
        <WorkLedger
          rows={listRows.map((row) => {
            const action = queuePrimaryAction(row);
            return {
              id: row.id,
              borrowerName: row.borrowerName,
              context: [row.loanType, row.dealReference]
                .filter(Boolean)
                .join(" · "),
              title: row.title,
              reason: queueWhyNow(row),
              actionLabel: action.label,
              href: action.href,
              hot: row.escalationDue || row.followUpDue,
              ownerName: row.contactName,
            };
          })}
          title="Tasks"
          description="Open items first. Completed items are on the board."
        />
      )}
    </div>
  );
}
