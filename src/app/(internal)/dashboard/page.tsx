import Link from "next/link";
import { NextActionsQueue } from "@/components/next-actions-queue";
import { WorkloadSummary } from "@/components/workload-summary";
import { listActiveStaff } from "@/lib/communications/data";
import { summarizeWorkload } from "@/lib/communications/workload";
import { isAdmin } from "@/lib/auth/roles";
import { staffDisplayName } from "@/lib/data/deals";
import { StatusChip } from "@/components/status-chip";
import { MetricCard } from "@/components/ui/metric-card";
import { CardHeader, SurfaceCard } from "@/components/ui/surface-card";
import { linkClass, pageLeadClass, pageTitleClass, pageWidthClass } from "@/components/ui/styles";
import { requireInternalUser } from "@/lib/auth/session";
import { listQueueContacts, listQueueTasks, listRecentActivity, listReviewDocuments } from "@/lib/data/deals";
import { getDashboardCounts } from "@/lib/data/dashboard";
import { loadDealSnapshot } from "@/lib/data/snapshot";
import { formatActivityDisplay } from "@/lib/ops/activity-display";
import {
  computeOpsMetrics,
  firstNameFromProfile,
  formatLongDate,
  greetingForHour,
  waitingCounts,
} from "@/lib/ops/ops-board";
import { decorateRankedActions } from "@/lib/playbooks/decorate";

const WAITING_LABELS = [
  { key: "borrower", label: "Borrower" },
  { key: "title", label: "Title" },
  { key: "insurance", label: "Insurance" },
  { key: "other", label: "Other third party" },
] as const;

export default async function DashboardPage() {
  const { supabase, profile } = await requireInternalUser();
  const now = new Date();
  const [counts, snapshot, queueTasks, queueContacts, reviewDocs, activity, staff] =
    await Promise.all([
      getDashboardCounts(supabase),
      loadDealSnapshot(supabase),
      listQueueTasks(supabase),
      listQueueContacts(supabase),
      listReviewDocuments(supabase),
      listRecentActivity(supabase),
      listActiveStaff(supabase),
    ]);
  const nextActions = decorateRankedActions(
    queueTasks,
    snapshot.deals,
    queueContacts,
    snapshot.needs,
    now,
  );
  const metrics = computeOpsMetrics({
    newDeals: counts.newDeals,
    documentsToReview: counts.documentsToReview,
    readyForSubmission: counts.readyForSubmission,
    ranked: nextActions,
  });
  const waiting = waitingCounts(nextActions);
  const readyDeals = snapshot.deals.filter(
    (deal) => deal.status === "ready_for_submission",
  );
  const firstName = firstNameFromProfile(profile);
  const staffNames = Object.fromEntries(
    staff.map((person) => [person.id, staffDisplayName(person)]),
  );
  const workload = summarizeWorkload(queueTasks, staffNames);

  return (
    <div className={`${pageWidthClass} space-y-8`}>
      <div>
        <p className="text-[11px] text-ink-muted">{formatLongDate(now)}</p>
        <h2 className={`mt-1 ${pageTitleClass}`}>
          {greetingForHour(now.getHours())}, {firstName}
        </h2>
        <p className={pageLeadClass}>
          Work that is blocking, waiting, or ready to move. New evaluation
          applications from{" "}
          <Link href="/apply" className={linkClass}>
            /apply
          </Link>{" "}
          appear here as new deals.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard label="New deals" value={metrics.newDeals} />
        <MetricCard label="Required now" value={metrics.requiredNow} />
        <MetricCard label="Documents to review" value={metrics.documentsToReview} />
        <MetricCard label="Waiting on borrower" value={metrics.waitingOnBorrower} />
        <MetricCard label="Ready for submission" value={metrics.readyForSubmission} />
        <MetricCard label="Escalations" value={metrics.escalations} />
      </div>

      {isAdmin(profile.role) ? <WorkloadSummary rows={workload} /> : null}

      <NextActionsQueue
        rows={nextActions.slice(0, 6)}
        title="Needs attention"
        description="Highest-value processor actions."
        empty="You’re clear for now. No processor actions need attention."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <SurfaceCard>
          <CardHeader title="Waiting on others" />
          <ul>
            {WAITING_LABELS.map((item) => (
              <li
                key={item.key}
                className="flex items-center justify-between border-t border-line py-2 first:border-0"
              >
                <span className="text-sm text-ink">{item.label}</span>
                <span className="text-sm tabular-nums text-ink-muted">
                  {waiting[item.key]}
                </span>
              </li>
            ))}
          </ul>
        </SurfaceCard>

        <SurfaceCard>
          <CardHeader title="Documents to review" />
          {reviewDocs.length === 0 ? (
            <p className="text-sm text-ink-muted">
              No documents are waiting for review.
            </p>
          ) : (
            <ul>
              {reviewDocs.map((doc) => {
                const deal = snapshot.deals.find((item) => item.id === doc.dealId);
                return (
                  <li key={doc.id} className="border-t border-line py-2 first:border-0">
                    <Link href={`/deals/${doc.dealId}?tab=documents`} className={linkClass}>
                      {doc.fileName}
                    </Link>
                    <p className="text-xs text-ink-muted">
                      {deal?.borrowerName ?? "Unknown deal"} · {doc.documentType ?? "Document"}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </SurfaceCard>

        <SurfaceCard>
          <CardHeader title="Ready for submission" />
          {readyDeals.length === 0 ? (
            <p className="text-sm text-ink-muted">
              No files are staged for submission.
            </p>
          ) : (
            <ul>
              {readyDeals.map((deal) => (
                <li
                  key={deal.id}
                  className="flex items-center justify-between gap-3 border-t border-line py-2 first:border-0"
                >
                  <div>
                    <Link href={`/deals/${deal.id}`} className={linkClass}>
                      {deal.borrowerName}
                    </Link>
                    <p className="text-xs text-ink-muted">{deal.dealReference}</p>
                  </div>
                  <StatusChip status={deal.status} />
                </li>
              ))}
            </ul>
          )}
        </SurfaceCard>
      </div>

      <SurfaceCard>
        <CardHeader title="Recent activity" />
        {activity.length === 0 ? (
          <p className="text-sm text-ink-muted">No operational events yet.</p>
        ) : (
          <ul>
            {activity.map((event) => {
              const deal = snapshot.deals.find((item) => item.id === event.dealId);
              const display = formatActivityDisplay(event);
              return (
                <li key={event.id} className="border-t border-line py-2 first:border-0">
                  <p className="text-sm font-medium text-ink">{display.who}</p>
                  <p className="text-sm text-ink">
                    {display.didWhat}
                    {display.toWhat ? ` ${display.toWhat}` : ""}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {deal?.borrowerName ?? "Deal"} · {display.when}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </SurfaceCard>
    </div>
  );
}
