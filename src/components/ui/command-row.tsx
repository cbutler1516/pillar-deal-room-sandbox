import Link from "next/link";
import type { ReactNode } from "react";

export function CommandRow({
  href,
  title,
  detail,
  action,
  hot = false,
  meta,
}: {
  href: string;
  title: string;
  detail?: ReactNode;
  action?: string;
  hot?: boolean;
  meta?: ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-3 border-b border-line py-2.5 transition last:border-0 hover:bg-stone/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pillar-teal/40"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-ink">
            {title}
          </span>
          {detail ? (
            <span
              className={`mt-0.5 block truncate text-[11px] ${
                hot ? "text-warning" : "text-ink-muted"
              }`}
            >
              {detail}
            </span>
          ) : null}
        </span>
        {meta ? (
          <span className="hidden shrink-0 text-[11px] tabular-nums text-ink-muted sm:block">
            {meta}
          </span>
        ) : null}
        {action ? (
          <span className="shrink-0 text-[11px] font-medium text-mineral">
            {action} →
          </span>
        ) : null}
      </Link>
    </li>
  );
}
