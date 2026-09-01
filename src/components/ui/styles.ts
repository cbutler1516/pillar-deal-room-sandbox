export type SurfaceTone = "flat" | "card" | "elevated";

const SURFACE: Record<SurfaceTone, string> = {
  flat: "rounded-[14px] border border-transparent bg-transparent shadow-none",
  card: "rounded-[14px] border border-line bg-surface shadow-[var(--shadow-card)]",
  elevated:
    "rounded-[14px] border border-line bg-surface shadow-[var(--shadow-elevated)]",
};

export function surfaceClass(
  tone: SurfaceTone = "card",
  clickable = false,
): string {
  const lift = clickable
    ? "transition duration-200 hover:-translate-y-px hover:shadow-[var(--shadow-lift)] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    : "";
  return `${SURFACE[tone]} ${lift}`.trim();
}

export const cardClass = surfaceClass("card");

export const cardPadClass = "px-5 py-4";

export const pageWidthClass = "mx-auto w-full max-w-[1600px]";

export const pageTitleClass = "text-[1.75rem] font-semibold tracking-tight text-ink";

export const pageLeadClass = "mt-2 max-w-2xl text-sm leading-7 text-ink-muted";

export const sectionTitleClass = "text-base font-semibold tracking-tight text-ink";

export const sectionMetaClass = "text-xs tabular-nums text-ink-muted";

export const labelClass = "text-xs font-medium text-ink-muted";

export const inputClass =
  "rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition focus:border-pillar-teal focus:ring-2 focus:ring-pillar-teal/20";

export const compactInputClass =
  "rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs text-ink outline-none transition focus:border-pillar-teal focus:ring-2 focus:ring-pillar-teal/20";

export const btnPrimaryClass =
  "inline-flex items-center justify-center rounded-md bg-pillar-navy px-3 py-2 text-sm font-medium text-white transition hover:bg-pillar-navy-soft disabled:cursor-not-allowed disabled:opacity-60";

export const btnSecondaryClass =
  "inline-flex items-center justify-center rounded-md border border-line bg-surface px-3 py-2 text-sm font-medium text-ink transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60";

export const btnCompactClass =
  "inline-flex items-center justify-center rounded-md border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60";

export const btnCompactPrimaryClass =
  "inline-flex items-center justify-center rounded-md bg-pillar-navy px-2.5 py-1 text-xs font-medium text-white transition hover:bg-pillar-navy-soft disabled:cursor-not-allowed disabled:opacity-60";

export const tableHeadClass =
  "text-[11px] font-medium text-ink-muted";

export const tableRowClass = "border-t border-line/80 hover:bg-surface-muted/70";

export const linkClass = "font-medium text-ink transition hover:text-pillar-teal";
