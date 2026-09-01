import type { ReactNode } from "react";
import {
  cardPadClass,
  sectionMetaClass,
  sectionTitleClass,
  surfaceClass,
  type SurfaceTone,
} from "@/components/ui/styles";

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
}: {
  title: string;
  description?: string;
  meta?: ReactNode;
  actions?: ReactNode;
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
        {meta ? <span className={sectionMetaClass}>{meta}</span> : null}
        {actions}
      </div>
    </div>
  );
}
