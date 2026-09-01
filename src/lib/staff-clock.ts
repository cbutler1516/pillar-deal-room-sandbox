/** Staff clocks stay in one zone so server HTML and the browser hydrate the same text. */
export const STAFF_TIME_ZONE = "America/Los_Angeles";

export function parseStaffInstant(value: unknown): Date | null {
  if (value == null || value === "") {
    return null;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

export function formatInStaffZone(
  value: Date,
  options: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: STAFF_TIME_ZONE,
    ...options,
  })
    .format(value)
    .replace(/[\u00a0\u202f]/g, " ");
}

export function staffCalendarDate(value: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: STAFF_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

export function staffHour(value: Date): number {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: STAFF_TIME_ZONE,
    hour: "numeric",
    hourCycle: "h23",
  })
    .formatToParts(value)
    .find((part) => part.type === "hour")?.value;
  return Number(hour);
}
