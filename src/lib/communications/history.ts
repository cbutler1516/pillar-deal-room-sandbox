import {
  isSimulatedAttempt,
  SANDBOX_SIMULATED_LABEL,
} from "@/lib/communications/records";
import type { CommunicationAttempt } from "@/lib/communications/types";

export type CommunicationHistoryItem = {
  id: string;
  title: string;
  detail: string;
  when: string;
  channel: string;
  direction: string;
  simulated: boolean;
  simulatedLabel: string | null;
  outboundSent: false;
};

function titleFor(attempt: CommunicationAttempt): string {
  if (isSimulatedAttempt(attempt)) {
    return SANDBOX_SIMULATED_LABEL;
  }
  if (attempt.status === "contacted") {
    return "Contacted";
  }
  if (attempt.status === "copied") {
    return attempt.channel === "portal"
      ? "Portal message copied"
      : `Copied ${attempt.channel} draft`;
  }
  if (attempt.status === "responded") {
    return "Reply received";
  }
  if (attempt.status === "waiting") {
    return "Waiting on a reply";
  }
  return attempt.subject ?? "Communication recorded";
}

export function historyItemsFromAttempts(
  attempts: CommunicationAttempt[],
): CommunicationHistoryItem[] {
  return [...attempts]
    .sort((a, b) => (a.attemptedAt < b.attemptedAt ? 1 : -1))
    .map((attempt) => {
      const simulated = isSimulatedAttempt(attempt);
      return {
        id: attempt.id,
        title: titleFor(attempt),
        detail: attempt.bodySnapshot,
        when: attempt.attemptedAt,
        channel: attempt.channel,
        direction: attempt.direction,
        simulated,
        simulatedLabel: simulated ? SANDBOX_SIMULATED_LABEL : null,
        outboundSent: false,
      };
    });
}
