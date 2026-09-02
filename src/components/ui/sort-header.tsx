import Link from "next/link";
import type { DealSortDirection } from "@/lib/ops/deal-sort";

export function SortHeader({
  label,
  accessibleName,
  href,
  direction = null,
  align = "left",
  className = "",
}: {
  label: string;
  accessibleName: string;
  href: string;
  direction?: DealSortDirection | null;
  align?: "left" | "right";
  className?: string;
}) {
  const sorted = direction != null;
  const ariaSort = direction === "asc" ? "ascending" : direction === "desc" ? "descending" : "none";
  const ariaLabel = sorted
    ? `${accessibleName}, sorted ${direction === "asc" ? "ascending" : "descending"}`
    : `Sort by ${accessibleName}`;

  return (
    <th aria-sort={ariaSort} scope="col" className={className}>
      <Link
        href={href}
        aria-label={ariaLabel}
        className={`group inline-flex min-h-8 items-center gap-1 rounded-[4px] px-1 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pillar-teal/40 ${
          align === "right" ? "w-full justify-end" : ""
        } ${
          sorted
            ? "font-semibold text-ink"
            : "font-medium text-ink-muted hover:text-ink"
        }`}
      >
        <span>{label}</span>
        <SortChevron direction={direction} />
      </Link>
    </th>
  );
}

function SortChevron({ direction }: { direction: DealSortDirection | null }) {
  const active = direction != null;
  return (
    <span
      aria-hidden
      className={`inline-flex h-3 w-2 shrink-0 items-center justify-center ${
        active ? "text-ink" : "text-ink-muted opacity-0 group-hover:opacity-50 group-focus-visible:opacity-50"
      }`}
    >
      <svg viewBox="0 0 8 12" className="h-3 w-2" fill="none">
        <path
          d="M4 1.5 7 5H1z"
          fill="currentColor"
          className={direction === "desc" ? "opacity-25" : ""}
        />
        <path
          d="M4 10.5 1 7h6z"
          fill="currentColor"
          className={direction === "asc" ? "opacity-25" : ""}
        />
      </svg>
    </span>
  );
}
