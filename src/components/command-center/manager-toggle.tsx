import { SegmentedControl } from "@/components/ui/controls";
import { hrefWithQuery } from "@/lib/ops/ops-board";

export function ManagerViewToggle({
  mode,
}: {
  mode: "mine" | "team";
}) {
  return (
    <SegmentedControl
      options={[
        {
          label: "My work",
          href: hrefWithQuery("/dashboard", {}, { view: undefined }),
          active: mode === "mine",
        },
        {
          label: "Team view",
          href: hrefWithQuery("/dashboard", {}, { view: "team" }),
          active: mode === "team",
        },
      ]}
    />
  );
}

export function MobilePriorityHint() {
  return (
    <p className="text-xs text-ink-muted lg:hidden">
      Mobile view prioritizes My next 5, due/overdue, documents, and waiting.
    </p>
  );
}
