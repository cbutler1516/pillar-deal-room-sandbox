import {
  CONTACT_MISSING,
  contactTypeLabel,
  type ContactType,
} from "@/lib/contacts/types";
import { resolveFollowUpRule } from "@/lib/communications/sequence";
import { nextFollowUpAtFrom } from "@/lib/playbooks/logic";
import type { PlaybookDefinition } from "@/lib/playbooks/types";

export function isSameDealContact(
  taskDealId: string,
  contactDealId: string | null,
): boolean {
  return Boolean(contactDealId) && taskDealId === contactDealId;
}

export function pickContactForPlaybook(
  playbook: Pick<PlaybookDefinition, "requiresContact" | "contactType">,
  contacts: {
    id: string;
    contactType: string;
    isPrimary: boolean;
    archivedAt: string | null;
  }[],
): { contactId: string | null; blockedReason: string | null } {
  if (!playbook.requiresContact) {
    return { contactId: null, blockedReason: null };
  }
  const active = contacts.filter(
    (contact) =>
      !contact.archivedAt &&
      (!playbook.contactType || contact.contactType === playbook.contactType),
  );
  const primary = active.find((contact) => contact.isPrimary);
  const chosen = primary ?? active[0];
  if (!chosen) {
    return { contactId: null, blockedReason: CONTACT_MISSING };
  }
  return { contactId: chosen.id, blockedReason: null };
}

export function taskIsContactBlocked(input: {
  requiresContact: boolean;
  dealContactId: string | null;
  blockedReason: string | null;
}): boolean {
  if (input.dealContactId) {
    return false;
  }
  return input.requiresContact || input.blockedReason === CONTACT_MISSING;
}

export function contactsAfterMarkingPrimary<
  T extends { id: string; contactType: string; isPrimary: boolean },
>(contacts: T[], contactId: string): T[] {
  const target = contacts.find((contact) => contact.id === contactId);
  if (!target) {
    return contacts;
  }
  return contacts.map((contact) => {
    if (contact.id === contactId) {
      return { ...contact, isPrimary: true };
    }
    if (contact.contactType === target.contactType) {
      return { ...contact, isPrimary: false };
    }
    return contact;
  });
}

export function addContactLabel(
  contactType: ContactType | string | null | undefined,
): string {
  if (!contactType) {
    return "Add Contact";
  }
  return `Add ${contactTypeLabel(contactType)}`;
}

export function contactActionChannel(): {
  outboundSent: false;
  channel: null;
} {
  return { outboundSent: false, channel: null };
}

export function nextFollowUpFromCadence(
  nowIso: string,
  task: {
    followUpIntervalHours?: number | null;
    sourceType?: string | null;
  },
): string {
  const rule = resolveFollowUpRule(task);
  return (
    nextFollowUpAtFrom(nowIso, rule.followUpHours) ??
    new Date(new Date(nowIso).getTime() + rule.followUpHours * 3_600_000).toISOString()
  );
}

export function markTaskContactedPatch(input: {
  nowIso: string;
  followUpIntervalHours: number | null;
  sourceType?: string | null;
  markWaiting: boolean;
}): {
  last_contacted_at: string;
  next_follow_up_at: string;
  status?: "waiting";
  waiting_since?: string;
} {
  const next = nextFollowUpFromCadence(input.nowIso, {
    followUpIntervalHours: input.followUpIntervalHours,
    sourceType: input.sourceType,
  });
  if (input.markWaiting) {
    return {
      last_contacted_at: input.nowIso,
      next_follow_up_at: next,
      status: "waiting",
      waiting_since: input.nowIso,
    };
  }
  return {
    last_contacted_at: input.nowIso,
    next_follow_up_at: next,
  };
}

export function markTaskWaitingPatch(input: {
  nowIso: string;
  followUpIntervalHours: number | null;
  sourceType?: string | null;
}): {
  status: "waiting";
  waiting_since: string;
  next_follow_up_at: string;
  completed_at: null;
} {
  return {
    status: "waiting",
    waiting_since: input.nowIso,
    next_follow_up_at: nextFollowUpFromCadence(input.nowIso, {
      followUpIntervalHours: input.followUpIntervalHours,
      sourceType: input.sourceType,
    }),
    completed_at: null,
  };
}
