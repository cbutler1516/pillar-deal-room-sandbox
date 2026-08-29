import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { requireInternalUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function InternalLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { profile } = await requireInternalUser();

  return <AppShell profile={profile}>{children}</AppShell>;
}
