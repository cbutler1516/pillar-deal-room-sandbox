import { staffCalendarDate } from "@/lib/staff-clock";

export function startOfStaffDay(value: Date): Date {
  const day = staffCalendarDate(value);
  return new Date(`${day}T00:00:00-07:00`);
}

export function staffDaysBetween(earlier: Date, later: Date): number {
  const start = startOfStaffDay(earlier).getTime();
  const end = startOfStaffDay(later).getTime();
  return Math.round((end - start) / 86_400_000);
}

export function formatOperationalAge(
  value: string | null | undefined,
  now = new Date(),
): string | null {
  if (!value) {
    return null;
  }
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) {
    return null;
  }
  const diffMs = now.getTime() - at.getTime();
  if (diffMs < 0) {
    const dueToday =
      staffCalendarDate(at) === staffCalendarDate(now);
    return dueToday ? "Due today" : null;
  }

  const sameDay = staffCalendarDate(at) === staffCalendarDate(now);
  if (sameDay) {
    if (diffMs < 60 * 60 * 1000) {
      const minutes = Math.max(1, Math.round(diffMs / 60_000));
      return `Received ${minutes}m ago`;
    }
    return "New today";
  }

  const days = staffDaysBetween(at, now);
  if (days === 1) {
    return "1 day overdue";
  }
  if (days > 1 && at.getTime() <= now.getTime()) {
    return `${days} days overdue`;
  }
  return null;
}

export function formatWaitingAgeLabel(
  waitingSince: string | null | undefined,
  now = new Date(),
): string | null {
  if (!waitingSince) {
    return null;
  }
  const at = new Date(waitingSince);
  if (Number.isNaN(at.getTime())) {
    return null;
  }
  const days = staffDaysBetween(at, now);
  if (days <= 0) {
    return "Waiting today";
  }
  if (days === 1) {
    return "Waiting 1 day";
  }
  return `Waiting ${days} days`;
}

export function formatDueTodayLabel(
  dueAt: string | null | undefined,
  now = new Date(),
): string | null {
  if (!dueAt) {
    return null;
  }
  const at = new Date(dueAt);
  if (Number.isNaN(at.getTime())) {
    return null;
  }
  if (staffCalendarDate(at) === staffCalendarDate(now)) {
    return "Due today";
  }
  if (at.getTime() < now.getTime()) {
    const days = staffDaysBetween(at, now);
    if (days === 1) {
      return "1 day overdue";
    }
    return `${days} days overdue`;
  }
  return null;
}

export function workItemAgeLabel(input: {
  dueState: string;
  dueAt: string | null;
  waitingSince?: string | null;
  workType: string;
  reason: string;
  now?: Date;
}): string | null {
  const now = input.now ?? new Date();
  if (input.dueState === "overdue") {
    return formatDueTodayLabel(input.dueAt, now) ?? input.reason;
  }
  if (input.dueState === "due_today") {
    return "Due today";
  }
  if (
    input.workType === "waiting_on_response" ||
    input.workType === "waiting_beyond_cadence"
  ) {
    return formatWaitingAgeLabel(input.waitingSince ?? input.dueAt, now);
  }
  if (input.workType === "response_received") {
    return formatOperationalAge(input.dueAt, now);
  }
  return formatOperationalAge(input.dueAt, now);
}
