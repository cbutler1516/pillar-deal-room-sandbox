import Link from "next/link";
import type { ReactNode } from "react";
import { labelClass, surfaceClass } from "@/components/ui/styles";

export type MetricAccent = "attention" | "waiting" | "review" | "ready";

const ACCENT: Record<MetricAccent, string> = {
  attention:
    "text-danger bg-[linear-gradient(180deg,var(--danger-soft)_0%,rgb(248_234_234/0.55)_100%)]",
  waiting:
    "text-amber bg-[linear-gradient(180deg,var(--amber-soft)_0%,rgb(248_241_221/0.5)_100%)]",
  review:
    "text-pillar-teal bg-[linear-gradient(180deg,var(--pillar-teal-soft)_0%,rgb(231_244_242/0.45)_100%)]",
  ready:
    "text-success bg-[linear-gradient(180deg,var(--success-soft)_0%,rgb(232_245_238/0.45)_100%)]",
};

const WASH: Record<MetricAccent, string> = {
  attention: "bg-[linear-gradient(180deg,#ffffff_0%,rgb(248_234_234/0.28)_100%)]",
  waiting: "bg-[linear-gradient(180deg,#ffffff_0%,rgb(248_241_221/0.3)_100%)]",
  review: "bg-[linear-gradient(180deg,#ffffff_0%,rgb(231_244_242/0.32)_100%)]",
  ready: "bg-[linear-gradient(180deg,#ffffff_0%,rgb(232_245_238/0.28)_100%)]",
};

const TOP: Record<MetricAccent, string> = {
  attention: "border-t-[3px] border-t-danger",
  waiting: "border-t-[3px] border-t-amber",
  review: "border-t-[3px] border-t-pillar-teal",
  ready: "border-t-[3px] border-t-success",
};

export function MetricCard({
  label,
  value,
  hint,
  href,
  accent = "review",
}: {
  label: string;
  value: number | string;
  hint?: string;
  href?: string;
  accent?: MetricAccent;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[1.5rem] font-semibold leading-none tracking-tight text-ink tabular-nums">
          {value}
        </p>
        <span
          className={`inline-flex h-9 w-9 items-center justify-center rounded-full shadow-[inset_0_1px_0_rgb(255_255_255/0.75),0_1px_3px_rgb(11_31_58/0.08)] ${ACCENT[accent]}`}
          aria-hidden
        >
          <MetricIcon accent={accent} className="h-4 w-4" />
        </span>
      </div>
      <p className={`mt-1.5 leading-4 ${labelClass}`}>{label}</p>
      {hint ? <p className="mt-0.5 text-[11px] leading-4 text-ink-muted">{hint}</p> : null}
    </>
  );
  const frame = `${surfaceClass("elevated", Boolean(href))} ${WASH[accent]} ${TOP[accent]} block px-3.5 py-2.5`;
  if (href) {
    return (
      <Link href={href} className={frame}>
        {body}
      </Link>
    );
  }
  return <section className={frame}>{body}</section>;
}

function MetricIcon({
  accent,
  className,
}: {
  accent: MetricAccent;
  className?: string;
}) {
  const icons: Record<MetricAccent, ReactNode> = {
    attention: (
      <path
        d="M10 3.8 2.8 16h14.4L10 3.8ZM10 8.2v3.6M10 14.2h.01"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
    waiting: (
      <path
        d="M10 4.5v5.2l3 1.8M10 17.2a7.2 7.2 0 1 0 0-14.4 7.2 7.2 0 0 0 0 14.4Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
    review: (
      <path
        d="M6 4.4h5.2L15 8.2V15.6H6zM11.2 4.4V8.2H15M7.8 10.6h4.4M7.8 13h3.2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
    ready: (
      <path
        d="M4.4 10.3 8.1 14l7.5-8.2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  };
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
      {icons[accent]}
    </svg>
  );
}
