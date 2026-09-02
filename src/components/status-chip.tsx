import { formatStatusLabel } from "@/lib/format";

export type StatusTone =
  | "neutral"
  | "info"
  | "waiting"
  | "warning"
  | "danger"
  | "success";

/** Single status vocabulary for every surface. Text always carries meaning. */
export function statusTone(status: string): StatusTone {
  switch (status) {
    case "new":
      return "neutral";
    case "collecting_documents":
    case "missing_items":
    case "requested":
    case "missing":
    case "high":
    case "required_now":
    case "primary":
      return "warning";
    case "processor_review":
    case "needs_review":
    case "classifying":
    case "received":
      return "info";
    case "ready_for_submission":
    case "approved":
    case "completed":
    case "waived":
      return "success";
    case "rejected":
    case "urgent":
    case "withdrawn":
    case "replacement_needed":
      return "danger";
    case "waiting":
    case "required_later":
      return "waiting";
    default:
      return "neutral";
  }
}

const TEXT: Record<StatusTone, string> = {
  neutral: "text-ink-muted",
  info: "text-info",
  waiting: "text-amber",
  warning: "text-warning",
  danger: "text-danger",
  success: "text-success",
};

const DOT: Record<StatusTone, string> = {
  neutral: "bg-ink-muted/45",
  info: "bg-info",
  waiting: "bg-amber",
  warning: "bg-warning",
  danger: "bg-danger",
  success: "bg-success",
};

export function StatusChip({
  status,
  label,
  dot = true,
}: {
  status: string;
  label?: string;
  dot?: boolean;
}) {
  const tone = statusTone(status);
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${TEXT[tone]}`}
    >
      {dot ? (
        <span
          aria-hidden
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT[tone]}`}
        />
      ) : null}
      {label ?? formatStatusLabel(status)}
    </span>
  );
}
