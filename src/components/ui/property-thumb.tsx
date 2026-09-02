export function PropertyThumb({
  address,
  className = "",
}: {
  address?: string | null;
  className?: string;
}) {
  const label = address?.trim()
    ? `No property photo on file for ${address}`
    : "No property photo on file";

  return (
    <div
      role="img"
      aria-label={label}
      className={`relative aspect-[16/9] w-[7.5rem] shrink-0 overflow-hidden rounded-[10px] border border-line bg-stone sm:w-32 ${className}`.trim()}
    >
      <span
        className="absolute inset-0 shadow-[inset_0_1px_0_rgb(255_255_255/0.7)]"
        aria-hidden
      />
      <span className="absolute inset-0 m-auto flex h-10 w-10 items-center justify-center rounded-[8px] border border-line bg-surface">
        <BuildingMark />
      </span>
    </div>
  );
}

function BuildingMark() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5 text-slate" aria-hidden>
      <path
        d="M10 38V16l14-8 14 8v22H10Z"
        fill="currentColor"
        fillOpacity="0.12"
      />
      <path
        d="M10 38V16l14-8 14 8v22"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M18 38V26h12v12M20 20h2.2M25.8 20H28M20 24.4h2.2M25.8 24.4H28"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
