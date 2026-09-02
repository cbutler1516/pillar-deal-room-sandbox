export type SurfaceTone = "flat" | "card" | "elevated" | "floating";

const SURFACE: Record<SurfaceTone, string> = {
  flat: "rounded-none border-0 bg-transparent shadow-none",
  card:
    "rounded-[10px] border border-line bg-surface shadow-none",
  elevated:
    "rounded-[12px] border border-line bg-surface shadow-[var(--shadow-elevated)]",
  floating:
    "rounded-[12px] border border-line bg-surface shadow-[var(--shadow-float)]",
};

export function surfaceClass(
  tone: SurfaceTone = "card",
  clickable = false,
): string {
  const lift = clickable
    ? "transition hover:border-mineral/30 hover:bg-stone motion-reduce:transition-none"
    : "";
  return `${SURFACE[tone]} ${lift}`.trim();
}

export const cardClass = surfaceClass("card");

export const cardPadClass = "px-5 py-4";

export const pageWidthClass = "mx-auto w-full max-w-[1600px]";

export const pageTitleClass =
  "font-display text-[1.5rem] font-semibold tracking-tight text-ink";

export const pageLeadClass = "mt-2 max-w-2xl text-sm leading-6 text-ink-muted";

export const sectionTitleClass =
  "text-[15px] font-semibold tracking-tight text-ink";

export const sectionMetaClass = "text-xs tabular-nums text-ink-muted";

export const labelClass =
  "text-[11px] font-medium uppercase tracking-[0.08em] text-ink-muted";

export const inputClass =
  "rounded-[8px] border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition focus:border-pillar-teal focus:ring-2 focus:ring-pillar-teal/20";

export const compactInputClass =
  "rounded-[8px] border border-line bg-surface px-2.5 py-1.5 text-xs text-ink outline-none transition focus:border-pillar-teal focus:ring-2 focus:ring-pillar-teal/20";

export const btnPrimaryClass =
  "inline-flex items-center justify-center rounded-[8px] bg-mineral px-3 py-2 text-[13px] font-medium text-white transition hover:bg-pillar-teal disabled:cursor-not-allowed disabled:opacity-60";

export const btnSecondaryClass =
  "inline-flex items-center justify-center rounded-[8px] border border-line bg-surface px-3 py-2 text-[13px] font-medium text-ink transition hover:bg-stone disabled:cursor-not-allowed disabled:opacity-60";

export const btnCompactClass =
  "inline-flex items-center justify-center rounded-[8px] border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink transition hover:bg-stone disabled:cursor-not-allowed disabled:opacity-60";

export const btnCompactPrimaryClass =
  "inline-flex items-center justify-center rounded-[8px] bg-mineral px-2.5 py-1 text-xs font-medium text-white transition hover:bg-pillar-teal disabled:cursor-not-allowed disabled:opacity-60";

export const tableHeadClass =
  "text-[11px] font-medium uppercase tracking-[0.06em] text-ink-muted";

export const tableRowClass =
  "border-t border-line/80 hover:bg-stone/80 focus-within:bg-stone";

export const linkClass = "font-medium text-ink transition hover:text-pillar-teal";
