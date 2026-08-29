import { PortalWorkspace } from "@/components/portal-workspace";
import { loadPortalDeal } from "@/lib/application/portal-data";

export const dynamic = "force-dynamic";

export default async function PortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const decoded = decodeURIComponent(token);
  const deal = await loadPortalDeal(decoded);

  if (!deal) {
    return (
      <div className="flex min-h-full items-center justify-center bg-workspace px-4">
        <p className="text-sm text-ink-muted">
          This sandbox portal link is invalid or expired.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-workspace">
      <PortalWorkspace token={decoded} deal={deal} />
    </div>
  );
}
