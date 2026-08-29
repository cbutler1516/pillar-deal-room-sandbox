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
      <div className="h-1.5 overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-pillar-teal"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-1 text-[11px] text-ink-muted">
        {complete}/{total}
      </p>
    </div>
  );
}
