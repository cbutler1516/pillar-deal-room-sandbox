import type { ReactNode } from "react";

export type FactRow = {
  label: string;
  value: ReactNode;
};

export function FactLedger({
  rows,
  columns = 1,
}: {
  rows: FactRow[];
  columns?: 1 | 2;
}) {
  if (rows.length === 0) {
    return null;
  }
  return (
    <dl
      className={
        columns === 2
          ? "grid border-y border-line sm:grid-cols-2"
          : "divide-y divide-line border-y border-line"
      }
    >
      {rows.map((row) => (
        <div
          key={row.label}
          className={
            columns === 2
              ? "flex items-baseline justify-between gap-6 border-b border-line py-2.5 sm:px-4 sm:first:pl-0 sm:odd:border-r sm:odd:pr-6 sm:even:pl-6"
              : "flex items-baseline justify-between gap-6 py-2.5"
          }
        >
          <dt className="text-[12px] text-ink-muted">{row.label}</dt>
          <dd className="text-right text-[13px] font-medium tabular-nums text-ink">
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
