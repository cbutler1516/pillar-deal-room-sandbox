import type { ActivityRow } from "@/lib/data/deals";
import type { CommunicationAttempt } from "@/lib/communications/types";
import { startOfStaffDay } from "@/lib/command-center/aging";
import { staffCalendarDate } from "@/lib/staff-clock";

export type SinceYesterdayCounts = {
  newApplications: number;
  documentsReceived: number;
  borrowerReplies: number;
  conditionsAdded: number;
  conditionsCleared: number;
  filesReady: number;
  submissionsMarked: number;
  lines: { label: string; count: number; href?: string }[];
};

function isSinceYesterday(value: string, now: Date): boolean {
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) {
    return false;
  }
  const today = staffCalendarDate(now);
  const yesterday = staffCalendarDate(
    new Date(startOfStaffDay(now).getTime() - 86_400_000),
  );
  const day = staffCalendarDate(at);
  return day === today || day === yesterday;
}

export function deriveSinceYesterday(input: {
  activity: ActivityRow[];
  communications: CommunicationAttempt[];
  now?: Date;
}): SinceYesterdayCounts {
  const now = input.now ?? new Date();
  const recentActivity = input.activity.filter((row) =>
    isSinceYesterday(row.createdAt, now),
  );
  const recentComms = input.communications.filter((row) =>
    isSinceYesterday(row.attemptedAt, now),
  );

  const newApplications = recentActivity.filter(
    (row) => row.eventType === "application_received",
  ).length;
  const documentsReceived = recentActivity.filter(
    (row) =>
      row.eventType === "document_metadata_recorded" ||
      row.eventType === "document_linked" ||
      (row.eventType === "document_status_changed" &&
        row.safeMetadata.to === "received"),
  ).length;
  const borrowerReplies =
    recentActivity.filter((row) => row.eventType === "response_received").length +
    recentComms.filter(
      (row) => row.direction === "inbound" && row.status === "responded",
    ).length;
  const conditionsAdded = recentActivity.filter(
    (row) =>
      row.eventType === "task_created" &&
      row.safeMetadata.task_type === "lender_condition",
  ).length;
  const conditionsCleared = recentActivity.filter(
    (row) =>
      row.eventType === "task_completed" &&
      row.safeMetadata.task_type === "lender_condition",
  ).length;
  const filesReady = recentActivity.filter(
    (row) =>
      row.eventType === "deal_status_changed" &&
      row.safeMetadata.to === "ready_for_submission",
  ).length;
  const submissionsMarked = recentActivity.filter(
    (row) =>
      row.eventType === "deal_status_changed" &&
      row.safeMetadata.to === "submitted",
  ).length;

  const lines = [
    {
      label: "new application",
      count: newApplications,
      href: "/processor-queue?bucket=new",
    },
    {
      label: "document received",
      count: documentsReceived,
      href: "/processor-queue?bucket=review",
    },
    {
      label: "borrower reply",
      count: borrowerReplies,
      href: "/processor-queue?work=review",
    },
    {
      label: "condition added",
      count: conditionsAdded,
    },
    {
      label: "condition cleared",
      count: conditionsCleared,
    },
    {
      label: "file became ready to submit",
      count: filesReady,
      href: "/processor-queue?bucket=ready",
    },
    {
      label: "submission marked",
      count: submissionsMarked,
    },
  ].filter((row) => row.count > 0);

  return {
    newApplications,
    documentsReceived,
    borrowerReplies,
    conditionsAdded,
    conditionsCleared,
    filesReady,
    submissionsMarked,
    lines,
  };
}

export function formatSinceYesterdaySummary(counts: SinceYesterdayCounts): string {
  if (counts.lines.length === 0) {
    return "No notable changes since yesterday.";
  }
  return counts.lines
    .map((row) => {
      const noun = row.count === 1 ? row.label : `${row.label}s`;
      return `${row.count} ${noun}`;
    })
    .join(" · ");
}
