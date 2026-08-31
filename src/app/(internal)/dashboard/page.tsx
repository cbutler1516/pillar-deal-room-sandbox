import Link from "next/link";
import { NextActionsQueue } from "@/components/next-actions-queue";
import { StatusChip } from "@/components/status-chip";
import { MetricCard } from "@/components/ui/metric-card";
import { CardHeader, SurfaceCard } from "@/components/ui/surface-card";
import { linkClass, pageLeadClass, pageTitleClass, pageWidthClass } from "@/components/ui/styles";
import { requireInternalUser } from "@/lib/auth/session";
import { listQueueContacts, listQueueTasks, listReviewDocuments } from "@/lib/data/deals";
import { getDashboardCounts } from "@/lib/data/dashboard";
import { loadDealSnapshot } from "@/lib/data/snapshot";
import {
  firstNameFromProfile,
  formatLongDate,
  greetingForHour,
  waitingBucket,
  waitingCounts,
} from "@/lib/ops/ops-board";
import { staffHour } from "@/lib/format";
import { decorateRankedActions } from "@/lib/playbooks/decorate";

const WAITING_LABELS = [
  { key: "borrower", label: "Borrower" },
  { key: "title", label: "Title" },
  { key: "insurance", label: "Insurance" },
  { key: "other", label: "Other" },
] as const;

export default async function DashboardPage() {
  const { supabase, profile } = await requireInternalUser();
  const now = new Date();
  const [counts, snapshot, queueTasks, queueContacts, reviewDocs] = await Promise.all([
    getDashboardCounts(supabase),
    loadDealSnapshot(supabase),
    listQueueTasks(supabase),
    listQueueContacts(supabase),
    listReviewDocuments(supabase),
  ]);
  const nextActions = decorateRankedActions(
    queueTasks,
    snapshot.deals,
    queueContacts,
    snapshot.needs,
    now,
  );
  const attentionFiles = new Set(nextActions.map((row) => row.dealId)).size;
  const waiting = waitingCounts(nextActions);
  const waitingTotal = waiting.borrower + waiting.title + waiting.insurance + waiting.other;
  const waitingRows = nextActions
    .filter((row) => row.status === "waiting")
    .slice(0, 6);
  const readyDeals = snapshot.deals
    .filter((deal) => deal.status === "ready_for_submission")
    .slice(0, 6);
  const firstName = firstNameFromProfile(profile);
  const fileWord = attentionFiles === 1 ? "file" : "files";

  return (
    <div className={`${pageWidthClass} space-y-8`}>
      <div>
        <p className="text-[11px] text-ink-muted">{formatLongDate(now)}</p>
        <h2 className={`mt-1 ${pageTitleClass}`}>
          {greetingForHour(staffHour(now))}, {firstName}
        </h2>
        <p className={pageLeadClass}>
          {attentionFiles === 0
            ? "Nothing needs your attention right now."
            : `${attentionFiles} ${fileWord} need your attention today.`}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Needs attention" value={attentionFiles} />
        <MetricCard label="Waiting" value={waitingTotal} />
        <MetricCard label="Docs to review" value={counts.documentsToReview} />
        <MetricCard label="Ready" value={counts.readyForSubmission} />
      </div>

      <NextActionsQueue
        rows={nextActions.slice(0, 7)}
        title="Needs attention"
        description="Highest-priority files. Open a row to work it."
        empty="You’re clear for now."
        compact
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <SurfaceCard>
          <CardHeader title="Waiting on others" />
          {waitingRows.length === 0 ? (
            <p className="text-sm text-ink-muted">Nobody is waiting on a reply.</p>
          ) : (
            <ul>
              {waitingRows.map((row) => (
                <li key={row.id} className="border-t border-line py-2.5 first:border-0">
                  <Link href={`/deals/${row.dealId}`} className={linkClass}>
                    {row.borrowerName}
                  </Link>
                  <p className="text-xs text-ink-muted">
                    {WAITING_LABELS.find((item) => item.key === waitingBucket(row.sourceType))
                      ?.label ?? "Other"}
                    {row.contactName ? ` · ${row.contactName}` : ""}
                    {" · "}
                    {row.title}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </SurfaceCard>

        <SurfaceCard>
          <CardHeader title="Ready for submission" />
          {readyDeals.length === 0 ? (
            <p className="text-sm leading-6 text-ink-muted">
              No files are ready to submit.
            </p>
          ) : (
            <ul>
              {readyDeals.map((deal) => (
                <li
                  key={deal.id}
                  className="flex items-center justify-between gap-3 border-t border-line py-2.5 first:border-0"
                >
                  <div>
                    <Link href={`/deals/${deal.id}`} className={linkClass}>
                      {deal.borrowerName}
                    </Link>
                    <p className="text-xs text-ink-muted">
                      {deal.loanType ?? deal.dealReference}
                    </p>
                  </div>
                  <StatusChip status={deal.status} label="Ready" />
                </li>
              ))}
            </ul>
          )}
        </SurfaceCard>
      </div>

      {reviewDocs.length > 0 ? (
        <p className="text-xs text-ink-muted">
          {reviewDocs.length} document{reviewDocs.length === 1 ? "" : "s"} waiting in{" "}
          <Link href="/processor-queue" className={linkClass}>
            Queue
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}
