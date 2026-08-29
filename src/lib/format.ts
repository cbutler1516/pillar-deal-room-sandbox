import type { DealStatus } from "@/lib/data/types";

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

export function formatDealStatus(status: DealStatus | string): string {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
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
