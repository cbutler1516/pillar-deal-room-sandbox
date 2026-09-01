import type { DealStatus } from "@/lib/data/types";
import {
  STAFF_TIME_ZONE,
  formatInStaffZone,
  parseStaffInstant,
  staffCalendarDate,
  staffHour,
} from "@/lib/staff-clock";

export {
  STAFF_TIME_ZONE,
  formatInStaffZone,
  parseStaffInstant,
  staffCalendarDate,
  staffHour,
};

export function formatCurrency(amount: number | null): string {
  if (amount == null) {
    return "—";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

const STATUS_LABELS: Record<string, string> = {
  new: "New file",
  collecting_documents: "Collecting documents",
  processor_review: "In processor review",
  ready_for_submission: "Ready to submit",
  submitted: "Submitted",
  waiting: "Waiting",
  replacement_needed: "Replacement needed",
  needs_review: "Needs review",
  in_progress: "In progress",
  application_in_progress: "Application in progress",
  missing_items: "Missing items",
  required_now: "Required now",
  required_later: "Required later",
  ready_review: "Ready to review",
  due_today: "Due today",
};

export function formatStatusLabel(status: string): string {
  if (STATUS_LABELS[status]) {
    return STATUS_LABELS[status];
  }
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatDealStatus(status: DealStatus | string): string {
  return formatStatusLabel(status);
}

export function formatProperty(
  city: string | null,
  state: string | null,
): string {
  return [city, state].filter(Boolean).join(", ") || "—";
}

export function formatTimestamp(value: string | null): string {
  if (!value) {
    return "—";
  }
  return formatInStaffZone(new Date(value), {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatReceivedAt(value: string | null): string {
  if (!value) {
    return "—";
  }
  return formatInStaffZone(new Date(value), {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatFollowUpAt(value: string | null, now = new Date()): string {
  if (!value) {
    return "Not set";
  }
  const date = new Date(value);
  const due = date.getTime() <= now.getTime();
  const label = formatInStaffZone(date, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return due ? `Due ${label}` : label;
}

export function formatCadenceHours(hours: number | null): string {
  if (hours == null || hours <= 0) {
    return "—";
  }
  if (hours % 24 === 0) {
    const days = hours / 24;
    return days === 1 ? "Every 24 hours" : `Every ${days} days`;
  }
  return `Every ${hours} hours`;
}

export function formatAgeDays(days: number): string {
  if (days <= 0) {
    return "Today";
  }
  if (days === 1) {
    return "1 day";
  }
  return `${days} days`;
}

export function formatWaitingAge(hours: number | null): string {
  if (hours == null) {
    return "—";
  }
  const rounded = Math.round(hours);
  if (rounded < 1) {
    return "<1h";
  }
  if (rounded < 24) {
    return `${rounded}h`;
  }
  const days = Math.floor(rounded / 24);
  const remainder = rounded % 24;
  return remainder === 0 ? `${days}d` : `${days}d ${remainder}h`;
}

export function formatPercent(value: number | null): string {
  if (value == null) {
    return "—";
  }
  return `${Math.round(value * 100)}%`;
}
