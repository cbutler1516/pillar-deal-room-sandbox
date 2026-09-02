import { formatInStaffZone, staffCalendarDate, staffHour } from "@/lib/staff-clock";

export type FollowUpPresetKey = "tomorrow" | "2_days" | "next_week";

export type FollowUpPreset = {
  key: FollowUpPresetKey;
  label: string;
  iso: string;
  displayDate: string;
};

function addDaysToYmd(ymd: string, days: number): string {
  const [year, month, day] = ymd.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  return utc.toISOString().slice(0, 10);
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** Instant for a staff-calendar date and clock time in America/Los_Angeles. */
export function instantAtStaffClock(ymd: string, hour: number, minute = 0): Date {
  const clock = `${pad(hour)}:${pad(minute)}:00`;
  for (const offset of ["-07:00", "-08:00"] as const) {
    const date = new Date(`${ymd}T${clock}${offset}`);
    if (staffCalendarDate(date) === ymd && staffHour(date) === hour) {
      return date;
    }
  }
  return new Date(`${ymd}T${clock}-07:00`);
}

function staffFollowUpAt(now: Date, offsetDays: number, hour = 9): Date {
  return instantAtStaffClock(addDaysToYmd(staffCalendarDate(now), offsetDays), hour);
}

export function followUpPresets(now = new Date()): FollowUpPreset[] {
  const presets: { key: FollowUpPresetKey; label: string; date: Date }[] = [
    { key: "tomorrow", label: "Tomorrow", date: staffFollowUpAt(now, 1) },
    { key: "2_days", label: "2 Days", date: staffFollowUpAt(now, 2) },
    { key: "next_week", label: "Next Week", date: staffFollowUpAt(now, 7) },
  ];
  return presets.map((preset) => ({
    key: preset.key,
    label: preset.label,
    iso: preset.date.toISOString(),
    displayDate: formatFollowUpDisplay(preset.date),
  }));
}

export function formatFollowUpDisplay(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return formatInStaffZone(date, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function parseCustomFollowUpInput(value: string, now = new Date()): string | null {
  const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
  if (!match) {
    return null;
  }
  const date = instantAtStaffClock(match[1], Number(match[2]), Number(match[3]));
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  if (date.getTime() < now.getTime() - 60_000) {
    return null;
  }
  return date.toISOString();
}

export function staffDatetimeLocalValue(iso: string): string {
  const date = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${pick("year")}-${pick("month")}-${pick("day")}T${pick("hour")}:${pick("minute")}`;
}
