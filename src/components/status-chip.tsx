function toneFor(status: string): string {
  switch (status) {
    case "new":
      return "bg-surface-muted text-ink-muted";
    case "collecting_documents":
    case "missing_items":
    case "requested":
    case "missing":
      return "bg-warning-soft text-warning";
    case "processor_review":
    case "needs_review":
    case "classifying":
    case "received":
      return "bg-pillar-teal-soft text-pillar-teal";
    case "ready_for_submission":
    case "approved":
    case "completed":
    case "waived":
      return "bg-success-soft text-success";
    case "rejected":
    case "urgent":
    case "withdrawn":
      return "bg-danger-soft text-danger";
    case "high":
    case "required_now":
    case "primary":
      return "bg-warning-soft text-warning";
    case "waiting":
    case "required_later":
      return "bg-info-soft text-info";
    case "optional":
      return "bg-surface-muted text-ink-muted";
    case "borrower":
    case "title":
    case "insurance":
    case "escrow":
    case "closing_attorney":
    case "appraiser":
    case "contractor":
      return "bg-violet-soft text-violet";
    default:
      return "bg-surface-muted text-ink-muted";
  }
}

export function StatusChip({
  status,
  label,
}: {
  status: string;
  label?: string;
}) {
  const text =
    label ??
    status
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  return (
    <span
      className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium ${toneFor(status)}`}
    >
      {text}
    </span>
  );
}
