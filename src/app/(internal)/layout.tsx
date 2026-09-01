import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { createPortalToken } from "@/lib/application/token";
import { requireInternalUser } from "@/lib/auth/session";
import { canShowDemoGuide } from "@/lib/demo/guide";
import { demoUuid } from "@/lib/demo/ids";

export const dynamic = "force-dynamic";

export default async function InternalLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { profile } = await requireInternalUser();
  const demoGuide = canShowDemoGuide()
    ? {
        caseyHref: `/deals/${demoUuid(7)}`,
        readyHref: `/deals/${demoUuid(5)}?tab=submission`,
        portalHref: `/portal/${createPortalToken(demoUuid(7))}`,
      }
    : null;

  return (
    <AppShell profile={profile} demoGuide={demoGuide}>
      {children}
    </AppShell>
  );
}
