import { ConditionsSection } from "@/components/command-center/conditions-section";
import { DocumentReviewInboxSection } from "@/components/command-center/document-review-inbox";
import { ManagerViewToggle } from "@/components/command-center/manager-toggle";
import { MorningBriefPanel } from "@/components/command-center/morning-brief-panel";
import { MyNextFiveSection } from "@/components/command-center/my-next-five";
import { ReadyToSubmitSection } from "@/components/command-center/ready-to-submit";
import { RecentResponsesSection } from "@/components/command-center/recent-responses";
import { SinceYesterdaySection } from "@/components/command-center/since-yesterday";
import { StuckFilesSection } from "@/components/command-center/stuck-files";
import { TeamOverviewSection } from "@/components/command-center/team-overview";
import { TodayStrip } from "@/components/command-center/today-strip";
import { UnassignedSection } from "@/components/command-center/unassigned-section";
import { WaitingOnSection } from "@/components/command-center/waiting-on";
import { StaffAvatar } from "@/components/ui/staff-avatar";
import { pageWidthClass } from "@/components/ui/styles";
import { displayName } from "@/lib/auth/authorization";
import { formatRoleLabel, isUserRole } from "@/lib/auth/roles";
import { isManagerRole } from "@/lib/command-center/derive";
import { listActiveStaff } from "@/lib/communications/data";
import { getCommandCenterSnapshot } from "@/lib/data/command-center";
import { staffDisplayName } from "@/lib/data/deals";
import {
  firstNameFromProfile,
  formatLongDate,
  greetingForNow,
} from "@/lib/ops/ops-board";
import { requireInternalUser } from "@/lib/auth/session";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const view = typeof params.view === "string" ? params.view : "mine";
  const { supabase, profile, user } = await requireInternalUser();
  const now = new Date();
  const staff = await listActiveStaff(supabase);
  const { data: roleRows } = await supabase
    .from("users")
    .select("id, role")
    .in("id", staff.length > 0 ? staff.map((person) => person.id) : ["__none__"]);
  const roleById = Object.fromEntries(
    (roleRows ?? []).map((row) => [String(row.id), row.role]),
  );
  const staffForWorkload = staff.map((person) => {
    const role = roleById[person.id];
    return {
      id: person.id,
      name: staffDisplayName(person),
      role: isUserRole(role) ? formatRoleLabel(role) : "Processor",
    };
  });
  const board = await getCommandCenterSnapshot(supabase, {
    userId: user.id,
    role: profile.role,
    staff: staffForWorkload,
    now,
  });
  const staffNames = Object.fromEntries(
    staff.map((person) => [person.id, staffDisplayName(person)]),
  );
  const locationByDeal = board.locationByDeal;
  const firstName = firstNameFromProfile(profile);
  const manager = isManagerRole(profile.role);
  const teamMode = manager && view === "team";

  return (
    <div className={`${pageWidthClass} space-y-5`}>
      <div className="rounded-[16px] border border-pillar-navy/15 bg-[linear-gradient(115deg,rgb(11_31_58/0.1)_0%,var(--pillar-teal-soft)_36%,#ffffff_70%,var(--info-soft)_100%)] px-4 py-3 shadow-[var(--shadow-elevated)]">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex min-w-0 items-center gap-3.5">
            <StaffAvatar name={displayName(profile)} size={48} />
            <div className="min-w-0">
              <p className="text-[11px] leading-4 text-ink-muted">
                {formatLongDate(now)}
              </p>
              <h2 className="mt-0.5 text-lg font-semibold leading-6 tracking-tight text-ink">
                {greetingForNow(now)}, {firstName}
              </h2>
            </div>
          </div>
          <p className="max-w-xl text-sm leading-5 text-ink-muted">
            {board.summaryLine}
          </p>
        </div>
      </div>

      {manager ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ManagerViewToggle mode={teamMode ? "team" : "mine"} />
        </div>
      ) : null}

      {teamMode ? (
        <TeamOverviewSection
          totals={board.teamOverview}
          workloadRows={board.teamWorkload.rows}
          unassigned={board.teamWorkload.unassigned}
        />
      ) : (
        <>
          <TodayStrip counts={board.todayStrip} assignment="mine" />

          <div className="lg:hidden space-y-5">
            <MyNextFiveSection
              items={board.myNextFive}
              staffNames={staffNames}
              locationByDeal={locationByDeal}
            />
            <DocumentReviewInboxSection rows={board.documentInbox.slice(0, 3)} />
            <WaitingOnSection rows={board.waitingOn.slice(0, 4)} />
          </div>

          <div className="hidden lg:block space-y-5">
            <MyNextFiveSection
              items={board.myNextFive}
              staffNames={staffNames}
              locationByDeal={locationByDeal}
            />

            {board.morningBrief ? (
              <MorningBriefPanel brief={board.morningBrief} />
            ) : null}

            <div className="grid gap-5 xl:grid-cols-2">
              <StuckFilesSection rows={board.stuckFiles} />
              <WaitingOnSection rows={board.waitingOn} />
            </div>

            <div className="grid gap-5 xl:grid-cols-2">
              <RecentResponsesSection rows={board.recentResponses} />
              <DocumentReviewInboxSection rows={board.documentInbox} />
            </div>

            <div className="grid gap-5 xl:grid-cols-3">
              <ConditionsSection snapshot={board.conditions} />
              <ReadyToSubmitSection
                rows={board.readyToSubmit}
                staffNames={staffNames}
              />
              <SinceYesterdaySection
                counts={board.sinceYesterday}
                summary={board.sinceYesterdaySummary}
              />
            </div>

            {manager ? (
              <UnassignedSection
                rows={board.unassigned}
                totalCount={board.unassignedCount}
              />
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
