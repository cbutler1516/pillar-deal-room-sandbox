import Link from "next/link";
import { SandboxBadge } from "@/components/sandbox-badge";
import { buttonClass } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function ApplicationReceivedPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; portal?: string }>;
}) {
  const params = await searchParams;
  const reference = params.ref ?? "";
  const portal = params.portal ?? "";

  return (
    <div className="flex min-h-full items-center justify-center bg-workspace px-4 py-12">
      <div className="w-full max-w-lg space-y-4 rounded-[10px] border border-line bg-surface p-8">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold text-pillar-navy">
            Application received
          </h1>
          <SandboxBadge />
        </div>
        <p className="text-sm text-ink-muted">
          This is a sandbox evaluation file. No real borrower data should be
          used.
        </p>
        <p className="text-sm text-ink">
          Deal reference: <span className="font-semibold">{reference || "—"}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {portal ? (
            <Link href={portal} className={buttonClass("primary")}>
              Open borrower portal
            </Link>
          ) : null}
          <Link href="/login" className={buttonClass("secondary")}>
            Staff sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
