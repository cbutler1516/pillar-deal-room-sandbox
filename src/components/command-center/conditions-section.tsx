import Link from "next/link";
import { FactLedger } from "@/components/ui/fact-ledger";
import { SectionHeader } from "@/components/ui/surface-card";
import { linkClass } from "@/components/ui/styles";
import type { ConditionsSnapshot } from "@/lib/command-center/conditions";

export function ConditionsSection({ snapshot }: { snapshot: ConditionsSnapshot }) {
  const total =
    snapshot.open +
    snapshot.waiting +
    snapshot.received +
    snapshot.needsReview;
  if (total === 0) {
    return null;
  }
  return (
    <section>
      <SectionHeader
        title="Conditions"
        actions={
          <Link href={snapshot.href} className={`text-[11px] ${linkClass}`}>
            View →
          </Link>
        }
      />
      <FactLedger
        rows={[
          { label: "Open", value: snapshot.open },
          { label: "Waiting", value: snapshot.waiting },
          { label: "Received", value: snapshot.received },
          { label: "Needs review", value: snapshot.needsReview },
        ]}
        columns={2}
      />
    </section>
  );
}
