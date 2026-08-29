"use client";

import { useState } from "react";
import { CopyTextButton } from "@/components/copy-text-button";
import { StatusChip } from "@/components/status-chip";
import { buttonClass } from "@/components/ui/button";
import {
  archiveDealContactAction,
  createDealContactAction,
  markDealContactPrimaryAction,
  updateDealContactAction,
} from "@/lib/contacts/actions";
import { addContactLabel } from "@/lib/contacts/logic";
import {
  CONTACT_GROUPS,
  CONTACT_TYPES,
  contactTypeLabel,
} from "@/lib/contacts/types";
import type { DealContactRow } from "@/lib/data/deals";

async function submitCreate(formData: FormData) {
  await createDealContactAction(formData);
}
async function submitUpdate(formData: FormData) {
  await updateDealContactAction(formData);
}
async function submitPrimary(formData: FormData) {
  await markDealContactPrimaryAction(formData);
}
async function submitArchive(formData: FormData) {
  await archiveDealContactAction(formData);
}

export function ContactsWorkspace({
  dealId,
  contacts,
  canMutate,
  defaultType,
  taskId,
  missingContactTypes = [],
}: {
  dealId: string;
  contacts: DealContactRow[];
  canMutate: boolean;
  defaultType?: string;
  taskId?: string;
  missingContactTypes?: string[];
}) {
  const [showAdd, setShowAdd] = useState(Boolean(taskId));
  const [editId, setEditId] = useState<string | null>(null);
  const active = contacts.filter((contact) => !contact.archivedAt);
  const missingLabels = missingContactTypes.map(contactTypeLabel);

  return (
    <div id="contacts" className="space-y-4">
      {missingContactTypes.length > 0 ? (
        <div className="border-b border-danger/20 pb-3">
          <p className="text-sm font-semibold text-danger">
            Required contact missing
          </p>
          <p className="mt-1 text-xs leading-5 text-danger/90">
            {missingLabels.length === 1
              ? `A ${missingLabels[0]} contact is required before related tasks can proceed.`
              : `These required contacts are missing: ${missingLabels.join(", ")}.`}{" "}
            Add the contact here. No messages are sent.
          </p>
          {canMutate ? (
            <button
              type="button"
              className={`${buttonClass("danger", "sm")} mt-3`}
              onClick={() => {
                setShowAdd(true);
              }}
            >
              {addContactLabel(missingContactTypes[0])}
            </button>
          ) : null}
        </div>
      ) : null}

      {canMutate ? (
        <button
          type="button"
          onClick={() => setShowAdd((value) => !value)}
          className={buttonClass("primary", "sm")}
        >
          Add Contact
        </button>
      ) : null}
      {showAdd && canMutate ? (
        <ContactForm
          dealId={dealId}
          taskId={taskId}
          defaultType={defaultType ?? missingContactTypes[0]}
          onClose={() => setShowAdd(false)}
        />
      ) : null}

      {CONTACT_GROUPS.map((group) => {
        const rows = active.filter((contact) =>
          (group.types as readonly string[]).includes(contact.contactType),
        );
        const groupMissing = group.types.some((type) =>
          missingContactTypes.includes(type),
        );
        if (rows.length === 0 && taskId && !groupMissing) {
          return null;
        }
        return (
          <section key={group.key}>
            <h4 className="mb-1 text-sm font-semibold text-ink">{group.label}</h4>
            {rows.length === 0 ? (
              <p
                className={`py-2 text-xs ${
                  groupMissing ? "text-danger" : "text-ink-muted"
                }`}
              >
                {groupMissing
                  ? `No ${group.label.toLowerCase()} contact on file.`
                  : "No contacts in this group."}
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {rows.map((contact) => (
                  <li key={contact.id} className="py-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink">{contact.name}</p>
                        <p className="mt-0.5 text-xs text-ink-muted">
                          {contact.company || "No company"}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <StatusChip status={contact.contactType} />
                          {contact.isPrimary ? (
                            <StatusChip status="primary" label="Primary" />
                          ) : null}
                        </div>
                        <p className="mt-2 text-xs text-ink">
                          {contact.email || "No email"}
                          <span className="text-ink-muted"> · </span>
                          {contact.phone || "No phone"}
                        </p>
                        {contact.notes ? (
                          <p className="mt-1 text-xs text-ink-muted">{contact.notes}</p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {contact.email ? (
                          <CopyTextButton value={contact.email} label="Copy Email" />
                        ) : null}
                        {contact.phone ? (
                          <CopyTextButton value={contact.phone} label="Copy Phone" />
                        ) : null}
                      </div>
                    </div>
                    {canMutate ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className={buttonClass("secondary", "sm")}
                          onClick={() =>
                            setEditId((current) =>
                              current === contact.id ? null : contact.id,
                            )
                          }
                        >
                          Edit
                        </button>
                        {!contact.isPrimary ? (
                          <form action={submitPrimary}>
                            <input type="hidden" name="contactId" value={contact.id} />
                            <button
                              type="submit"
                              className={buttonClass("secondary", "sm")}
                            >
                              Mark Primary
                            </button>
                          </form>
                        ) : null}
                        <form action={submitArchive}>
                          <input type="hidden" name="contactId" value={contact.id} />
                          <button type="submit" className={buttonClass("ghost", "sm")}>
                            Archive
                          </button>
                        </form>
                      </div>
                    ) : null}
                    {editId === contact.id && canMutate ? (
                      <div className="mt-3">
                        <ContactForm
                          dealId={dealId}
                          existing={contact}
                          onClose={() => setEditId(null)}
                        />
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

function ContactForm({
  dealId,
  existing,
  defaultType,
  taskId,
  onClose,
}: {
  dealId: string;
  existing?: DealContactRow;
  defaultType?: string;
  taskId?: string;
  onClose: () => void;
}) {
  return (
    <form
      action={async (formData) => {
        if (existing) {
          await submitUpdate(formData);
        } else {
          await submitCreate(formData);
        }
        onClose();
      }}
      className="grid gap-2 rounded-xl border border-line bg-workspace p-3 sm:grid-cols-2"
    >
      <input type="hidden" name="dealId" value={dealId} />
      {existing ? <input type="hidden" name="contactId" value={existing.id} /> : null}
      {taskId ? <input type="hidden" name="taskId" value={taskId} /> : null}
      <label className="text-xs text-ink-muted">
        Type
        <select
          name="contactType"
          defaultValue={existing?.contactType ?? defaultType ?? "borrower"}
          className="mt-1 w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs"
        >
          {CONTACT_TYPES.map((type) => (
            <option key={type} value={type}>
              {contactTypeLabel(type)}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs text-ink-muted">
        Name
        <input
          name="name"
          required
          defaultValue={existing?.name ?? ""}
          className="mt-1 w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs"
        />
      </label>
      <input
        name="company"
        defaultValue={existing?.company ?? ""}
        placeholder="Company"
        className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs"
      />
      <input
        name="email"
        defaultValue={existing?.email ?? ""}
        placeholder="Email"
        className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs"
      />
      <input
        name="phone"
        defaultValue={existing?.phone ?? ""}
        placeholder="Phone"
        className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs"
      />
      <input
        name="notes"
        defaultValue={existing?.notes ?? ""}
        placeholder="Notes"
        className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs"
      />
      {!existing ? (
        <label className="flex items-center gap-2 text-xs text-ink-muted">
          <input type="checkbox" name="isPrimary" value="true" defaultChecked />
          Primary for this type
        </label>
      ) : null}
      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" className={buttonClass("primary", "sm")}>
          {existing ? "Save contact" : "Add contact"}
        </button>
        <button type="button" onClick={onClose} className={buttonClass("secondary", "sm")}>
          Cancel
        </button>
      </div>
    </form>
  );
}
