import type { ReactNode } from "react";
import { pageLeadClass, pageTitleClass } from "@/components/ui/styles";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h2 className={pageTitleClass}>{title}</h2>
        {description ? <p className={pageLeadClass}>{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
