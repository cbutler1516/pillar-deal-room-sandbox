import { CommandRow } from "@/components/ui/command-row";
import { SectionHeader } from "@/components/ui/surface-card";
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
      <SectionHeader title="Ready" meta={rows.length} />
      <ul>
        {rows.map((row) => (
          <CommandRow
            key={row.dealId}
            href={row.href}
            title={row.borrowerName}
            detail={`${row.loanType ?? "Loan"} · ${formatCurrency(row.loanAmount)}${
              row.processorId && staffNames[row.processorId]
                ? ` · ${staffNames[row.processorId]}`
                : ""
            }`}
            action="Submit"
          />
        ))}
      </ul>
    </section>
  );
}
