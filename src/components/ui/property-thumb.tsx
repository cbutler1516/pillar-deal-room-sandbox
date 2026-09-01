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
      className={`relative aspect-[16/9] w-[7.5rem] shrink-0 overflow-hidden rounded-[13px] border border-line bg-[linear-gradient(180deg,#eef2f6_0%,#e4eaf1_100%)] shadow-[var(--shadow-card)] sm:w-32 ${className}`.trim()}
    >
      <BuildingMark />
    </div>
  );
}

function BuildingMark() {
  return (
    <svg
      viewBox="0 0 48 48"
      className="absolute inset-0 m-auto h-8 w-8 text-slate/70"
      aria-hidden
    >
      <path
        d="M10 38V16l14-8 14 8v22H10Z"
        fill="currentColor"
        fillOpacity="0.08"
      />
      <path
        d="M10 38V16l14-8 14 8v22"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M18 38V26h12v12M20 20h2.2M25.8 20H28M20 24.4h2.2M25.8 24.4H28"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
