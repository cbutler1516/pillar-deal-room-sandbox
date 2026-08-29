import { cardClass, labelClass } from "@/components/ui/styles";

export function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <section className={`${cardClass} px-4 py-3`}>
      <p className="text-2xl font-semibold tracking-tight text-ink tabular-nums">
        {value}
      </p>
      <p className={`mt-1 ${labelClass}`}>{label}</p>
      {hint ? <p className="mt-1 text-[11px] text-ink-muted">{hint}</p> : null}
    </section>
  );
}
