export function ProgressBar({
  complete,
  total,
}: {
  complete: number;
  total: number;
}) {
  const percent = total === 0 ? 0 : Math.round((complete / total) * 100);
  return (
    <div className="min-w-24">
      <div className="h-2 overflow-hidden rounded-full bg-workspace">
        <div
          className="h-full rounded-full bg-mineral"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-1 text-[11px] tabular-nums text-ink-muted">
        {complete}/{total}
      </p>
    </div>
  );
}
