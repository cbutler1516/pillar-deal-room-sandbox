"use client";

import { useState } from "react";
import { CopyTextButton } from "@/components/copy-text-button";
import { OverflowMenu } from "@/components/ui/overflow-menu";
import { buttonClass } from "@/components/ui/button";
import {
  archiveDealContactAction,
  createDealContactAction,
  markDealContactPrimaryAction,
  updateDealContactAction,
} from "@/lib/contacts/actions";
import { addContactLabel } from "@/lib/contacts/logic";
import {
  CONTACT_TYPES,
  PEOPLE_DIRECTORY_ORDER,
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

function directoryGroups(contacts: DealContactRow[]) {
  const leftover = contacts.filter(
    (contact) =>
      !(PEOPLE_DIRECTORY_ORDER as readonly string[]).includes(contact.contactType),
  );
  return [
    ...PEOPLE_DIRECTORY_ORDER.map((type) => ({
      key: type,
      label: contactTypeLabel(type),
      type,
      rows: contacts.filter((contact) => contact.contactType === type),
    })),
    {
      key: "other",
      label: "Other",
      type: "other",
      rows: leftover,
    },
  ];
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
  const [openId, setOpenId] = useState<string | null>(null);
  const active = contacts.filter((contact) => !contact.archivedAt);
  const blocked = missingContactTypes.length > 0;
  const groups = directoryGroups(active);

  return (
    <div id="contacts" className="space-y-6">
      {blocked ? (
        <div className="pb-1">
          <p className="text-sm font-semibold text-danger">
            A required contact is missing
          </p>
          <p className="mt-1 text-sm leading-6 text-ink-muted">
            Add the person before related tasks can proceed. No messages are sent.
          </p>
          {canMutate ? (
            <button
              type="button"
              className={`${buttonClass("accent", "md")} mt-3`}
              onClick={() => setShowAdd(true)}
            >
              {addContactLabel(missingContactTypes[0])}
            </button>
          ) : null}
        </div>
      ) : null}

      {canMutate && !blocked ? (
        <button
          type="button"
          onClick={() => setShowAdd((value) => !value)}
          className={buttonClass("ghost", "sm")}
        >
          Add Contact
        </button>
      ) : canMutate && blocked && !showAdd ? (
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className={buttonClass("ghost", "sm")}
        >
          Add another contact
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

      {active.length === 0 && !showAdd ? (
        <p className="text-sm leading-6 text-ink-muted">
          No people are on this file yet.
        </p>
      ) : (
        groups.map((group) => {
          const groupMissing = missingContactTypes.includes(group.type);
          if (group.rows.length === 0 && !groupMissing) {
            return null;
          }
          return (
            <section key={group.key}>
              <h4 className="mb-1 text-xs font-semibold tracking-wide text-ink-muted uppercase">
                {group.label}
              </h4>
              {group.rows.length === 0 ? (
                <p className="py-2 text-sm text-danger">
                  No {group.label.toLowerCase()} on file.
                </p>
              ) : (
                <ul className="divide-y divide-line">
                  {group.rows.map((contact) => {
                    const open = openId === contact.id;
                    const method =
                      contact.email || contact.phone || "No contact method";
                    return (
                      <li key={contact.id} className="py-3.5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <button
                            type="button"
                            className="min-w-0 flex-1 text-left"
                            onClick={() =>
                              setOpenId((current) =>
                                current === contact.id ? null : contact.id,
                              )
                            }
                          >
                            <p className="text-sm font-semibold text-ink">
                              {contact.name}
                              {contact.isPrimary ? (
                                <span className="ml-2 text-xs font-medium text-ink-muted">
                                  Primary
                                </span>
                              ) : null}
                            </p>
                            <p className="mt-0.5 text-sm leading-6 text-ink-muted">
                              {[
                                contactTypeLabel(contact.contactType),
                                contact.company,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                            <p className="text-sm leading-6 text-ink">{method}</p>
                          </button>
                          <div className="flex flex-wrap items-center gap-1">
                            {contact.email ? (
                              <CopyTextButton value={contact.email} label="Copy email" />
                            ) : null}
                            {contact.phone ? (
                              <CopyTextButton value={contact.phone} label="Copy phone" />
                            ) : null}
                            {canMutate ? (
                              <OverflowMenu
                                items={[
                                  {
                                    label: open ? "Hide details" : "View / Edit",
                                    onClick: () => {
                                      setOpenId(contact.id);
                                      setEditId(contact.id);
                                    },
                                  },
                                  ...(!contact.isPrimary
                                    ? [
                                        {
                                          label: "Mark primary",
                                          onClick: () => {
                                            const data = new FormData();
                                            data.set("contactId", contact.id);
                                            void submitPrimary(data);
                                          },
                                        },
                                      ]
                                    : []),
                                  {
                                    label: "Archive",
                                    tone: "danger" as const,
                                    onClick: () => {
                                      const data = new FormData();
                                      data.set("contactId", contact.id);
                                      void submitArchive(data);
                                    },
                                  },
                                ]}
                              />
                            ) : null}
                          </div>
                        </div>
                        {open ? (
                          <div className="mt-3 space-y-3">
                            {contact.notes ? (
                              <p className="text-sm leading-6 text-ink-muted">
                                {contact.notes}
                              </p>
                            ) : null}
                            {canMutate && editId === contact.id ? (
                              <ContactForm
                                dealId={dealId}
                                existing={contact}
                                onClose={() => {
                                  setEditId(null);
                                  setOpenId(null);
                                }}
                              />
                            ) : null}
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })
      )}
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
      className="grid gap-2 rounded-xl bg-workspace p-3 sm:grid-cols-2"
    >
      <input type="hidden" name="dealId" value={dealId} />
      {existing ? <input type="hidden" name="contactId" value={existing.id} /> : null}
      {taskId ? <input type="hidden" name="taskId" value={taskId} /> : null}
      <label className="text-xs text-ink-muted">
        Type
        <select
          name="contactType"
          defaultValue={existing?.contactType ?? defaultType ?? "borrower"}
          className="mt-1 min-h-10 w-full rounded-lg border border-line bg-surface px-2.5 py-2 text-sm"
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
          className="mt-1 min-h-10 w-full rounded-lg border border-line bg-surface px-2.5 py-2 text-sm"
        />
      </label>
      <input
        name="company"
        defaultValue={existing?.company ?? ""}
        placeholder="Company"
        className="min-h-10 rounded-lg border border-line bg-surface px-2.5 py-2 text-sm"
      />
      <input
        name="email"
        defaultValue={existing?.email ?? ""}
        placeholder="Email"
        className="min-h-10 rounded-lg border border-line bg-surface px-2.5 py-2 text-sm"
      />
      <input
        name="phone"
        defaultValue={existing?.phone ?? ""}
        placeholder="Phone"
        className="min-h-10 rounded-lg border border-line bg-surface px-2.5 py-2 text-sm"
      />
      <input
        name="notes"
        defaultValue={existing?.notes ?? ""}
        placeholder="Notes"
        className="min-h-10 rounded-lg border border-line bg-surface px-2.5 py-2 text-sm"
      />
      {!existing ? (
        <label className="flex items-center gap-2 text-sm text-ink-muted">
          <input type="checkbox" name="isPrimary" value="true" defaultChecked />
          Primary for this type
        </label>
      ) : null}
      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" className={buttonClass("accent", "sm")}>
          {existing ? "Save contact" : "Add contact"}
        </button>
        <button type="button" onClick={onClose} className={buttonClass("ghost", "sm")}>
          Cancel
        </button>
      </div>
    </form>
  );
}
