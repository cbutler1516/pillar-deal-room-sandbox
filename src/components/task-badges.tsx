import type { DecoratedAction } from "@/lib/playbooks/decorate";

function Badge({
  label,
  tone,
}: {
  label: string;
  tone: "warning" | "danger";
}) {
  const className =
    tone === "danger"
      ? "text-danger"
      : "text-warning";
  return (
    <span className={`text-[11px] font-medium ${className}`}>{label}</span>
  );
}

export function TaskBadges({
  row,
  compact = false,
}: {
  row: Pick<
    DecoratedAction,
    | "timing"
    | "status"
    | "priority"
    | "followUpDue"
    | "escalationDue"
    | "contactMissing"
  >;
  compact?: boolean;
}) {
  const items: { label: string; tone: "warning" | "danger" }[] = [];
  if (row.escalationDue) {
    items.push({ label: "Escalated", tone: "danger" });
  }
  if (row.contactMissing) {
    items.push({ label: "Contact missing", tone: "danger" });
  }
  if (row.priority === "urgent") {
    items.push({ label: "Urgent", tone: "danger" });
  }
  if (!compact && row.followUpDue) {
    items.push({ label: "Follow-up due", tone: "warning" });
  }
  if (items.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-wrap gap-x-2 gap-y-0.5">
      {items.map((item) => (
        <Badge key={item.label} label={item.label} tone={item.tone} />
      ))}
    </div>
  );
}
