import Link from "next/link";
import { SectionHeader } from "@/components/ui/surface-card";
import { linkClass } from "@/components/ui/styles";
import type { WaitingOnRow } from "@/lib/command-center/waiting-on";

export function WaitingOnSection({ rows }: { rows: WaitingOnRow[] }) {
  if (rows.length === 0) {
    return null;
  }
  return (
    <section>
      <SectionHeader title="Waiting on" />
      <ul className="grid gap-2 sm:grid-cols-2">
        {rows.map((row) => (
          <li key={row.key}>
            <Link
              href={row.href}
              className={`${linkClass} block rounded-[10px] border border-line/70 px-3 py-2 hover:border-pillar-teal/30 hover:bg-pillar-teal-soft/20`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-ink">{row.label}</span>
                <span className="text-sm tabular-nums text-ink-muted">
                  {row.count} item{row.count === 1 ? "" : "s"}
                </span>
              </div>
              {row.oldestLabel ? (
                <p className="mt-0.5 text-xs text-ink-muted">
                  Oldest: {row.oldestLabel.replace(/^Waiting /, "")}
                </p>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
