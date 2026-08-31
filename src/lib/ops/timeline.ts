import { historyItemsFromAttempts } from "@/lib/communications/history";
import type { CommunicationAttempt } from "@/lib/communications/types";
import type { ActivityRow, DealContactRow } from "@/lib/data/deals";
import { formatInStaffZone, staffCalendarDate } from "@/lib/format";
import { formatActivityDisplay } from "@/lib/ops/activity-display";

export const TIMELINE_FILTERS = [
  "all",
  "documents",
  "communications",
  "workflow",
] as const;

export type TimelineFilter = (typeof TIMELINE_FILTERS)[number];

export type TimelineKind = Exclude<TimelineFilter, "all">;

export type TimelineEntry = {
  id: string;
  at: string;
  actor: string;
  action: string;
  target: string | null;
  context: string | null;
  kind: TimelineKind;
  detail: string | null;
  simulated: boolean;
};

const DOCUMENT_EVENTS = new Set([
  "document_upload_session_created",
  "document_metadata_recorded",
  "document_status_changed",
  "document_access_requested",
  "document_linked",
]);

const COMMUNICATION_EVENTS = new Set([
  "task_contacted",
  "response_received",
  "communication_draft_copied",
  "portal_message_created",
  "contact_marked",
]);

export function timelineKindForEvent(eventType: string): TimelineKind {
  if (DOCUMENT_EVENTS.has(eventType) || eventType.startsWith("document_")) {
    return "documents";
  }
  if (COMMUNICATION_EVENTS.has(eventType)) {
    return "communications";
  }
  return "workflow";
}

export function buildDealTimeline(input: {
  activity: ActivityRow[];
  attempts: CommunicationAttempt[];
  contacts?: DealContactRow[];
  staffNames?: Record<string, string>;
  now?: Date;
}): TimelineEntry[] {
  const names = input.staffNames ?? {};
  const now = input.now ?? new Date();
  const contacts = new Map(
    (input.contacts ?? []).map((contact) => [contact.id, contact]),
  );
  const activityEntries: TimelineEntry[] = input.activity.map((event) => {
    const display = formatActivityDisplay(event, names, now);
    return {
      id: `activity-${event.id}`,
      at: event.createdAt,
      actor: display.who,
      action: display.didWhat,
      target: display.toWhat,
      context: null,
      kind: timelineKindForEvent(event.eventType),
      detail: null,
      simulated: event.safeMetadata.sandbox_simulated === "true",
    };
  });
  const communicationEntries: TimelineEntry[] = historyItemsFromAttempts(
    input.attempts,
  ).map((item) => {
    const attempt = input.attempts.find((row) => row.id === item.id);
    const contact = attempt?.dealContactId
      ? contacts.get(attempt.dealContactId)
      : null;
    const actor = attempt?.createdBy
      ? (names[attempt.createdBy] ?? "Staff")
      : item.direction === "inbound"
        ? (contact?.name ?? "Contact")
        : "Staff";
    const channel = item.channel.replaceAll("_", " ");
    const channelLabel = channel.charAt(0).toUpperCase() + channel.slice(1);
    return {
      id: `comm-${item.id}`,
      at: item.when,
      actor: contact && item.direction === "outbound" ? `${actor} → ${contact.name}` : actor,
      action: item.title,
      target: contact && item.direction !== "outbound" ? contact.name : null,
      context: [attempt?.subject, channelLabel].filter(Boolean).join(" · ") || channelLabel,
      kind: "communications",
      detail: item.detail,
      simulated: item.simulated,
    };
  });

  return [...activityEntries, ...communicationEntries].sort((a, b) =>
    a.at < b.at ? 1 : -1,
  );
}

export function filterTimelineEntries(
  entries: TimelineEntry[],
  filter: TimelineFilter,
): TimelineEntry[] {
  if (filter === "all") {
    return entries;
  }
  return entries.filter((entry) => entry.kind === filter);
}

export type TimelineDayGroup = {
  key: string;
  label: string;
  entries: TimelineEntry[];
};

export function groupTimelineByDay(
  entries: TimelineEntry[],
  now = new Date(),
): TimelineDayGroup[] {
  const groups = new Map<string, TimelineEntry[]>();
  for (const entry of entries) {
    const key = staffCalendarDate(new Date(entry.at));
    const list = groups.get(key) ?? [];
    list.push(entry);
    groups.set(key, list);
  }
  return [...groups.entries()].map(([key, dayEntries]) => ({
    key,
    label: formatTimelineDay(dayEntries[0].at, now),
    entries: dayEntries,
  }));
}

export function formatTimelineDay(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const today = staffCalendarDate(now);
  const entryDay = staffCalendarDate(date);
  if (entryDay === today) {
    return "Today";
  }
  if (entryDay === shiftCalendarDate(today, -1)) {
    return "Yesterday";
  }
  return formatInStaffZone(date, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function shiftCalendarDate(yyyyMmDd: string, days: number): string {
  const [year, month, day] = yyyyMmDd.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return [
    next.getUTCFullYear(),
    String(next.getUTCMonth() + 1).padStart(2, "0"),
    String(next.getUTCDate()).padStart(2, "0"),
  ].join("-");
}
