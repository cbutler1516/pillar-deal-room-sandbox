import { CommandRow } from "@/components/ui/command-row";
import { SectionHeader } from "@/components/ui/surface-card";
import type { StuckFileRow } from "@/lib/command-center/stuck";

export function StuckFilesSection({ rows }: { rows: StuckFileRow[] }) {
  if (rows.length === 0) {
    return null;
  }
  return (
    <section>
      <SectionHeader title="Needs attention" meta={rows.length} />
      <ul>
        {rows.map((row) => (
          <CommandRow
            key={row.id}
            href={row.href}
            title={row.borrowerName}
            detail={`${row.reason}${row.ageLabel ? ` · ${row.ageLabel}` : ""}`}
            action="Open"
            hot
          />
        ))}
      </ul>
    </section>
  );
}
