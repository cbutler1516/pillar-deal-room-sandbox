import type { ReactNode } from "react";
import {
  cardPadClass,
  sectionMetaClass,
  sectionTitleClass,
  surfaceClass,
  type SurfaceTone,
} from "@/components/ui/styles";
import {
  QUEUE_SECTION_TINT,
  type QueueCardAccent,
} from "@/lib/ui/queue-card";

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

export function CardHeader({
  title,
  description,
  meta,
  actions,
  accent,
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
          {accent ? (
            <span
              className={`h-2 w-2 shrink-0 rounded-full shadow-[inset_0_1px_0_rgb(255_255_255/0.55)] ${QUEUE_SECTION_TINT[accent]}`}
              aria-hidden
            />
          ) : null}
          <h3 className={compact ? "text-sm font-semibold tracking-tight text-ink" : sectionTitleClass}>
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
          <span
            className={
              accent
                ? `inline-flex min-w-6 justify-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${QUEUE_SECTION_TINT[accent]}`
                : sectionMetaClass
            }
          >
            {meta}
          </span>
        ) : null}
        {actions}
      </div>
    </div>
  );
}
