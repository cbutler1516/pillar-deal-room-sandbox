import type { ReactNode } from "react";
import {
  cardPadClass,
  sectionMetaClass,
  sectionTitleClass,
  surfaceClass,
  type SurfaceTone,
} from "@/components/ui/styles";
import type { QueueCardAccent } from "@/lib/ui/queue-card";

export function SurfaceCard({
  children,
  className = "",
  padded = true,
  elevated = false,
  tone,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
  elevated?: boolean;
  tone?: SurfaceTone;
}) {
  return (
    <section
      className={`${surfaceClass(tone ?? (elevated ? "elevated" : "card"))} ${padded ? cardPadClass : ""} ${className}`.trim()}
    >
      {children}
    </section>
  );
}

/**
 * Editorial section header for unboxed composition.
 * Use instead of SurfaceCard when a region should read as part of the page
 * rather than a floating card.
 */
export function SectionHeader({
  title,
  meta,
  actions,
}: {
  title: string;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line pb-2">
      <div className="flex items-baseline gap-2.5">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
          {title}
        </h3>
        {meta != null ? (
          <span className="text-[11px] tabular-nums text-ink-muted">{meta}</span>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  meta,
  actions,
  compact = false,
}: {
  title: string;
  description?: string;
  meta?: ReactNode;
  actions?: ReactNode;
  accent?: QueueCardAccent;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex flex-wrap items-start justify-between gap-2 ${
        compact ? "mb-2" : "mb-4 border-b border-line/70 pb-2"
      }`}
    >
      <div>
        <div className="flex items-center gap-2">
          <h3 className={compact ? "text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted" : sectionTitleClass}>
            {title}
          </h3>
        </div>
        {description ? (
          <p className={`text-xs text-ink-muted ${compact ? "mt-0 leading-4" : "mt-0.5 leading-5"}`}>
            {description}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {meta != null ? (
          <span className={sectionMetaClass}>{meta}</span>
        ) : null}
        {actions}
      </div>
    </div>
  );
}
