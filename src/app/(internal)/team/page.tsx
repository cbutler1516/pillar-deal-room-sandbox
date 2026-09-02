import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { StaffAvatar } from "@/components/ui/staff-avatar";
import { buttonClass } from "@/components/ui/button";
import { pageWidthClass, surfaceClass } from "@/components/ui/styles";
import { requireInternalUser } from "@/lib/auth/session";
import { formatRoleLabel, isUserRole } from "@/lib/auth/roles";
import { listActiveStaff } from "@/lib/communications/data";
import { operationalWorkFromSnapshot } from "@/lib/data/dashboard";
import { staffDisplayName } from "@/lib/data/deals";
import { loadDealSnapshot } from "@/lib/data/snapshot";
import { buildTeamWorkload, type TeamWorkloadRow } from "@/lib/team/workload";

export default async function TeamPage() {
  const { supabase } = await requireInternalUser();
  const now = new Date();
  const [snapshot, staff] = await Promise.all([
    loadDealSnapshot(supabase),
    listActiveStaff(supabase),
  ]);
  const { data: roleRows } = await supabase
    .from("users")
    .select("id, role")
    .in(
      "id",
      staff.length > 0 ? staff.map((person) => person.id) : ["__none__"],
    );
  const roleById = Object.fromEntries(
    (roleRows ?? []).map((row) => [String(row.id), row.role]),
  );
  const items = operationalWorkFromSnapshot(snapshot, now);
  const workload = buildTeamWorkload({
    staff: staff.map((person) => {
      const role = roleById[person.id];
      return {
        id: person.id,
        name: staffDisplayName(person),
        role: isUserRole(role) ? formatRoleLabel(role) : "Processor",
      };
    }),
    deals: snapshot.deals,
    items,
  });

  return (
    <div className={`${pageWidthClass} space-y-6`}>
      <PageHeader
        title="Team workload"
        description="Who owns what across the processing team. Counts come from live file work — not scores."
      />

      <UnassignedCard row={workload.unassigned} />

      {workload.rows.length === 0 ? (
        <p className="text-sm text-ink-muted">
          No active processors are in this sandbox yet.
        </p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {workload.rows.map((row) => (
            <li key={row.id}>
              <WorkloadCard row={row} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function UnassignedCard({ row }: { row: TeamWorkloadRow }) {
  return (
    <section className="border-l-2 border-danger bg-stone/40 px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <StaffAvatar unassigned size={40} label="Unassigned work" />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-ink">Unassigned</h3>
            <p className="mt-0.5 text-xs text-ink-muted">
              Unclaimed files, urgent work, and new applications
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-ink sm:grid-cols-3">
              <Count label="Unclaimed files" value={row.activeFiles} />
              <Count label="Urgent" value={row.urgent} />
              <Count label="Waiting" value={row.waiting} />
            </dl>
            <p className="mt-2 text-sm text-ink">
              {row.activeFiles} unclaimed file{row.activeFiles === 1 ? "" : "s"}
              {row.urgent > 0 ? ` · ${row.urgent} urgent` : ""}
            </p>
          </div>
        </div>
        <Link href={row.href} className={buttonClass("accent", "sm")}>
          View unassigned work
        </Link>
      </div>
    </section>
  );
}

function WorkloadCard({ row }: { row: TeamWorkloadRow }) {
  return (
    <article className={`${surfaceClass("card")} px-4 py-4`}>
      <div className="flex items-start gap-3">
        <StaffAvatar name={row.name} size={40} label={`${row.name}, ${row.role}`} />
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ink">{row.name}</h3>
          <p className="text-[11px] uppercase tracking-[0.08em] text-ink-muted">
            {row.role}
          </p>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <Count label="Current load" value={row.activeFiles} />
        <Count label="Urgent" value={row.urgent} />
        <Count label="Review" value={row.documentsToReview} />
        <Count label="Waiting" value={row.waiting} />
        <Count label="Ready" value={row.ready} />
      </dl>
      <Link href={row.href} className={`${buttonClass("secondary", "sm")} mt-4`}>
        View work
      </Link>
    </article>
  );
}

function Count({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-[0.06em] text-ink-muted">
        {label}
      </dt>
      <dd className="mt-0.5 font-semibold tabular-nums text-ink">{value}</dd>
    </div>
  );
}
