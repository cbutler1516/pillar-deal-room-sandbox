import { CommandRow } from "@/components/ui/command-row";
import { SectionHeader } from "@/components/ui/surface-card";
import type { UnassignedFileRow } from "@/lib/command-center/derive";

export function UnassignedSection({
  rows,
  totalCount,
}: {
  rows: UnassignedFileRow[];
  totalCount: number;
}) {
  if (totalCount === 0) {
    return null;
  }
  return (
    <section>
      <SectionHeader
        title="Unassigned"
        meta={totalCount}
        actions={
          totalCount > rows.length ? (
            <a
              href="/processor-queue?assignment=unassigned"
              className="text-[11px] font-medium text-mineral"
            >
              View all →
            </a>
          ) : undefined
        }
      />
      <ul>
        {rows.map((row) => (
          <CommandRow
            key={row.id}
            href={row.href}
            title={row.borrowerName}
            detail={row.reason}
            action="Open"
          />
        ))}
      </ul>
    </section>
  );
}
