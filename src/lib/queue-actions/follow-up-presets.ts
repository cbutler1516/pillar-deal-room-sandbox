import { formatInStaffZone, staffCalendarDate } from "@/lib/staff-clock";

export type FollowUpPresetKey = "tomorrow" | "2_days" | "3_days" | "1_week" | "custom";

export type FollowUpPreset = {
  key: FollowUpPresetKey;
  label: string;
  iso: string;
  displayDate: string;
};

function staffFollowUpAt(now: Date, offsetDays: number, hour = 10): Date {
  const today = staffCalendarDate(now);
  const start = new Date(`${today}T00:00:00-07:00`);
  return new Date(start.getTime() + offsetDays * 86_400_000 + hour * 3_600_000);
}

export function followUpPresets(now = new Date()): FollowUpPreset[] {
  const presets: { key: FollowUpPresetKey; label: string; date: Date }[] = [
    { key: "tomorrow", label: "Tomorrow", date: staffFollowUpAt(now, 1) },
    { key: "2_days", label: "2 days", date: staffFollowUpAt(now, 2) },
    { key: "3_days", label: "3 days", date: staffFollowUpAt(now, 3) },
    { key: "1_week", label: "1 week", date: staffFollowUpAt(now, 7) },
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
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  if (parsed.getTime() < now.getTime() - 60_000) {
    return null;
  }
  return parsed.toISOString();
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
