import { CONTACT_MISSING } from "@/lib/contacts/types";
import { ACTIVE_TASK_STATUSES } from "@/lib/playbooks/logic";
import { getPlaybook } from "@/lib/playbooks/registry";

export type ReconcilableTask = {
  id: string;
  status: string;
  playbookKey: string | null;
  sourceType: string | null;
  dealContactId: string | null;
  blockedReason: string | null;
};

export type ReconcilableContact = {
  id: string;
  contactType: string;
  name: string;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
  archivedAt: string | null;
};

export type TaskContactLinkPatch = {
  taskId: string;
  dealContactId: string;
  contactName: string;
  contactEmail: string | null;
  contactPhone: string | null;
};

function isActiveReconcileStatus(status: string): boolean {
  return (ACTIVE_TASK_STATUSES as readonly string[]).includes(status);
}

export function expectedContactRequirement(task: {
  playbookKey: string | null;
  sourceType: string | null;
}): { requiresContact: boolean; expectedContactType: string | null } {
  const playbook = task.playbookKey ? getPlaybook(task.playbookKey) : null;
  if (playbook) {
    return {
      requiresContact: playbook.requiresContact,
      expectedContactType: playbook.contactType ?? null,
    };
  }
  const inferred = task.sourceType != null && task.sourceType !== "internal";
  return {
    requiresContact: inferred,
    expectedContactType: inferred ? task.sourceType : null,
  };
}

export function pickActiveContactForType(
  contactType: string,
  contacts: ReconcilableContact[],
): ReconcilableContact | null {
  const active = contacts.filter(
    (contact) => !contact.archivedAt && contact.contactType === contactType,
  );
  return active.find((contact) => contact.isPrimary) ?? active[0] ?? null;
}

export function reconcileBlockedTasksForContact(input: {
  contactType: string;
  contacts: ReconcilableContact[];
  tasks: ReconcilableTask[];
}): TaskContactLinkPatch[] {
  const chosen = pickActiveContactForType(input.contactType, input.contacts);
  if (!chosen) {
    return [];
  }

  return input.tasks.flatMap((task) => {
    if (!isActiveReconcileStatus(task.status)) {
      return [];
    }
    if (task.dealContactId) {
      return [];
    }
    if (task.blockedReason !== CONTACT_MISSING) {
      return [];
    }
    const requirement = expectedContactRequirement(task);
    if (!requirement.requiresContact) {
      return [];
    }
    if (requirement.expectedContactType !== input.contactType) {
      return [];
    }
    return [
      {
        taskId: task.id,
        dealContactId: chosen.id,
        contactName: chosen.name,
        contactEmail: chosen.email,
        contactPhone: chosen.phone,
      },
    ];
  });
}
