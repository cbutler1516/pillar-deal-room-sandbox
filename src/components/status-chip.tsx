import { formatStatusLabel } from "@/lib/format";

function toneFor(status: string): string {
  switch (status) {
    case "new":
      return "text-ink-muted";
    case "collecting_documents":
    case "missing_items":
    case "requested":
    case "missing":
      return "text-warning";
    case "processor_review":
    case "needs_review":
    case "classifying":
    case "received":
      return "text-pillar-teal";
    case "ready_for_submission":
    case "approved":
    case "completed":
    case "waived":
      return "text-success";
    case "rejected":
    case "urgent":
    case "withdrawn":
    case "replacement_needed":
      return "text-danger";
    case "high":
    case "required_now":
    case "primary":
      return "text-warning";
    case "waiting":
    case "required_later":
      return "text-info";
    default:
      return "text-ink-muted";
  }
}

export function StatusChip({
  status,
  label,
}: {
  status: string;
  label?: string;
}) {
  return (
    <span
      className={`inline-flex text-xs font-medium ${toneFor(status)}`}
    >
      {label ?? formatStatusLabel(status)}
    </span>
  );
}
