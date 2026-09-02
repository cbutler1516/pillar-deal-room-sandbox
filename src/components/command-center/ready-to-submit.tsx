import Link from "next/link";
import { StaffPresence } from "@/components/ui/staff-avatar";
import { SectionHeader } from "@/components/ui/surface-card";
import { buttonClass } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import type { ReadyToSubmitRow } from "@/lib/command-center/derive";

export function ReadyToSubmitSection({
  rows,
  staffNames,
}: {
  rows: ReadyToSubmitRow[];
  staffNames: Record<string, string>;
}) {
  if (rows.length === 0) {
    return null;
  }
  return (
    <section>
      <SectionHeader title="Ready to submit" meta={rows.length} />
      <ul>
        {rows.map((row) => (
          <li key={row.dealId} className="border-b border-line py-2.5 last:border-0">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{row.borrowerName}</p>
                <p className="text-xs text-ink-muted">
                  {row.loanType ?? "Loan"} · {formatCurrency(row.loanAmount)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <StaffPresence
                  name={
                    row.processorId ? staffNames[row.processorId] ?? null : null
                  }
                  unassigned={!row.processorId}
                />
                <Link href={row.href} className={buttonClass("accent", "sm")}>
                  Prepare submission
                </Link>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
