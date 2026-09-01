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
}: {
  title: string;
  description?: string;
  meta?: ReactNode;
  actions?: ReactNode;
  accent?: QueueCardAccent;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className={sectionTitleClass}>{title}</h3>
        {description ? (
          <p className="mt-0.5 text-xs leading-5 text-ink-muted">{description}</p>
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
