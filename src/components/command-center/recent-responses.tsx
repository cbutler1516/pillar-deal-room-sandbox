import { CommandRow } from "@/components/ui/command-row";
import { SectionHeader } from "@/components/ui/surface-card";
import type { RecentResponseRow } from "@/lib/command-center/derive";

export function RecentResponsesSection({ rows }: { rows: RecentResponseRow[] }) {
  if (rows.length === 0) {
    return null;
  }
  return (
    <section>
      <SectionHeader title="Review — replies" meta={rows.length} />
      <ul>
        {rows.map((row) => (
          <CommandRow
            key={row.id}
            href={row.href}
            title={`${row.borrowerName} replied`}
            detail={`${row.taskTitle} · ${row.ageLabel}`}
            action="Review"
          />
        ))}
      </ul>
    </section>
  );
}
