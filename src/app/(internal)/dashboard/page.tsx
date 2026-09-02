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
import { canMutateWorkflow } from "@/lib/ops/workflow";
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
    <div className={`${pageWidthClass} space-y-10`}>
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border-b border-line pb-6">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.14em] text-ink-muted">
            {formatLongDate(now)}
          </p>
          <h2 className="font-display mt-2 text-[2rem] font-semibold leading-none tracking-tight text-ink">
            {greetingForNow(now)}, {firstName}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-muted">
            {board.summaryLine}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StaffAvatar name={displayName(profile)} size={40} />
          {manager ? (
            <ManagerViewToggle mode={teamMode ? "team" : "mine"} />
          ) : null}
        </div>
      </div>

      {teamMode ? (
        <TeamOverviewSection
          totals={board.teamOverview}
          workloadRows={board.teamWorkload.rows}
          unassigned={board.teamWorkload.unassigned}
        />
      ) : (
        <>
          <MyNextFiveSection
            items={board.myNextFive}
            staffNames={staffNames}
            locationByDeal={locationByDeal}
            canMutate={canMutateWorkflow(profile.role)}
            currentUserId={user.id}
          />

          <TodayStrip counts={board.todayStrip} assignment="mine" />

          {board.morningBrief ? (
            <div className="hidden lg:block">
              <MorningBriefPanel brief={board.morningBrief} />
            </div>
          ) : null}

          <div className="space-y-10 lg:hidden">
            <DocumentReviewInboxSection rows={board.documentInbox.slice(0, 3)} />
            <WaitingOnSection rows={board.waitingOn.slice(0, 4)} />
          </div>

          <div className="hidden space-y-10 lg:block">
            <div className="grid gap-10 xl:grid-cols-2">
              <StuckFilesSection rows={board.stuckFiles} />
              <WaitingOnSection rows={board.waitingOn} />
            </div>

            <div className="grid gap-10 xl:grid-cols-2">
              <RecentResponsesSection rows={board.recentResponses} />
              <DocumentReviewInboxSection rows={board.documentInbox} />
            </div>

            <div className="grid gap-10 xl:grid-cols-2">
              <ReadyToSubmitSection
                rows={board.readyToSubmit}
                staffNames={staffNames}
              />
              <ConditionsSection snapshot={board.conditions} />
            </div>

            <SinceYesterdaySection
              counts={board.sinceYesterday}
              summary={board.sinceYesterdaySummary}
            />

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
