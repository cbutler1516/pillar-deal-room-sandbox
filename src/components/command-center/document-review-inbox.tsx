import Link from "next/link";
import { SectionHeader } from "@/components/ui/surface-card";
import { buttonClass } from "@/components/ui/button";
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
      <SectionHeader title="Documents to review" meta={rows.length} />
      <ul>
        {rows.map((row) => (
          <li key={row.id} className="border-b border-line py-2.5 last:border-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{row.fileName}</p>
                <p className="text-xs text-ink-muted">
                  {row.borrowerName} · {row.suggestedType}
                  {row.intelligenceFlag ? ` · ${row.intelligenceFlag}` : ""}
                  {row.ageLabel ? ` · ${row.ageLabel}` : ""}
                </p>
              </div>
              <Link href={row.href} className={buttonClass("secondary", "sm")}>
                Review document
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
