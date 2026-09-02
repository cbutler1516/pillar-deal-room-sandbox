import { CommandRow } from "@/components/ui/command-row";
import { SectionHeader } from "@/components/ui/surface-card";
import type { WaitingOnRow } from "@/lib/command-center/waiting-on";

export function WaitingOnSection({ rows }: { rows: WaitingOnRow[] }) {
  if (rows.length === 0) {
    return null;
  }
  return (
    <section>
      <SectionHeader title="Waiting for" meta={rows.reduce((sum, row) => sum + row.count, 0)} />
      <ul>
        {rows.map((row) => (
          <CommandRow
            key={row.key}
            href={row.href}
            title={row.label}
            detail={
              row.oldestLabel
                ? `Oldest ${row.oldestLabel.replace(/^Waiting /, "")}`
                : undefined
            }
            meta={`${row.count}`}
            action="Open"
          />
        ))}
      </ul>
    </section>
  );
}
