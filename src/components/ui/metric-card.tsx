import Link from "next/link";
import { cardClass, labelClass } from "@/components/ui/styles";

export function MetricCard({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: number | string;
  hint?: string;
  href?: string;
}) {
  const body = (
    <>
      <p className="text-2xl font-semibold tracking-tight text-ink tabular-nums">
        {value}
      </p>
      <p className={`mt-1 ${labelClass}`}>{label}</p>
      {hint ? <p className="mt-1 text-[11px] text-ink-muted">{hint}</p> : null}
    </>
  );
  if (href) {
    return (
      <Link href={href} className={`${cardClass} block px-4 py-3 hover:bg-surface-muted`}>
        {body}
      </Link>
    );
  }
  return <section className={`${cardClass} px-4 py-3`}>{body}</section>;
}
