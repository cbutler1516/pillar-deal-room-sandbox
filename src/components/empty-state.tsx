export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="px-2 py-8">
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      <p className="mt-1 max-w-lg text-sm leading-6 text-ink-muted">{description}</p>
    </div>
  );
}
