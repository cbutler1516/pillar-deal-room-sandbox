export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="border border-dashed border-line bg-stone/40 px-4 py-8">
      <span
        className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-[8px] border border-line bg-surface text-slate"
        aria-hidden
      >
        <EmptyMark />
      </span>
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      <p className="mt-1 max-w-lg text-sm leading-6 text-ink-muted">{description}</p>
    </div>
  );
}

function EmptyMark() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden>
      <rect
        x="4"
        y="5"
        width="12"
        height="11"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M7 9.2h6M7 12h4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
