import { CommandRow } from "@/components/ui/command-row";
import { SectionHeader } from "@/components/ui/surface-card";
import type { DocumentReviewInboxRow } from "@/lib/command-center/documents-inbox";

export function DocumentReviewInboxSection({
  rows,
}: {
  rows: DocumentReviewInboxRow[];
}) {
  if (rows.length === 0) {
    return null;
  }
  return (
    <section>
      <SectionHeader title="To review" meta={rows.length} />
      <ul>
        {rows.map((row) => (
          <CommandRow
            key={row.id}
            href={row.href}
            title={row.fileName}
            detail={[
              row.borrowerName,
              row.suggestedType,
              row.intelligenceFlag,
              row.ageLabel,
            ]
              .filter(Boolean)
              .join(" · ")}
            action="Review"
          />
        ))}
      </ul>
    </section>
  );
}
