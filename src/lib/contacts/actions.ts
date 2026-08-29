"use server";

import { revalidatePath } from "next/cache";
import { requireInternalUser } from "@/lib/auth/session";
import { canMutateDealContacts } from "@/lib/contacts/authorization";
import { contactActionChannel, isSameDealContact } from "@/lib/contacts/logic";
import { reconcileBlockedTasksForContact } from "@/lib/contacts/reconcile";
import { CONTACT_MISSING, isContactType } from "@/lib/contacts/types";
import { assertSandboxGuard } from "@/lib/sandbox";
import { logAuthorizedActivity } from "@/lib/workflow/activity";

export type ContactActionResult = {
  error: string | null;
  contactId?: string;
};

function asString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function refreshDeal(dealId: string) {
  revalidatePath("/dashboard");
  revalidatePath("/deals");
  revalidatePath("/processor-queue");
  revalidatePath(`/deals/${dealId}`);
}

async function loadMutableDeal(dealId: string) {
  assertSandboxGuard();
  const { supabase, user, profile } = await requireInternalUser();
  const { data: deal } = await supabase
    .from("deals")
    .select("id, assigned_processor_id")
    .eq("id", dealId)
    .maybeSingle();
  if (!deal) {
    return { error: "Deal not found." as const };
  }
  if (
    !canMutateDealContacts({
      role: profile.role,
      userId: user.id,
      dealAssignedProcessorId: deal.assigned_processor_id,
    })
  ) {
    return { error: "Your role cannot update contacts on this deal." as const };
  }
  return { error: null, supabase, user, deal };
}

async function clearOtherPrimaries(
  supabase: Awaited<ReturnType<typeof requireInternalUser>>["supabase"],
  dealId: string,
  contactType: string,
  exceptId?: string,
) {
  let query = supabase
    .from("deal_contacts")
    .update({ is_primary: false })
    .eq("deal_id", dealId)
    .eq("contact_type", contactType)
    .eq("is_primary", true);
  if (exceptId) {
    query = query.neq("id", exceptId);
  }
  await query;
}

async function snapshotLinkedTasks(
  supabase: Awaited<ReturnType<typeof requireInternalUser>>["supabase"],
  contact: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
  },
) {
  await supabase
    .from("tasks")
    .update({
      contact_name: contact.name,
      contact_email: contact.email,
      contact_phone: contact.phone,
      blocked_reason: null,
    })
    .eq("deal_contact_id", contact.id)
    .eq("blocked_reason", CONTACT_MISSING);
  await supabase
    .from("tasks")
    .update({
      contact_name: contact.name,
      contact_email: contact.email,
      contact_phone: contact.phone,
    })
    .eq("deal_contact_id", contact.id);
}

async function reconcileBlockedTasksForDeal(
  supabase: Awaited<ReturnType<typeof requireInternalUser>>["supabase"],
  dealId: string,
  actorId: string,
  contactType: string,
) {
  const [{ data: contacts }, { data: tasks }] = await Promise.all([
    supabase
      .from("deal_contacts")
      .select("id, contact_type, name, email, phone, is_primary, archived_at")
      .eq("deal_id", dealId),
    supabase
      .from("tasks")
      .select("id, status, playbook_key, source_type, deal_contact_id, blocked_reason")
      .eq("deal_id", dealId),
  ]);
  const patches = reconcileBlockedTasksForContact({
    contactType,
    contacts: (contacts ?? []).map((row) => ({
      id: row.id,
      contactType: row.contact_type,
      name: row.name,
      email: row.email,
      phone: row.phone,
      isPrimary: row.is_primary,
      archivedAt: row.archived_at,
    })),
    tasks: (tasks ?? []).map((row) => ({
      id: row.id,
      status: row.status,
      playbookKey: row.playbook_key,
      sourceType: row.source_type,
      dealContactId: row.deal_contact_id,
      blockedReason: row.blocked_reason,
    })),
  });
  for (const patch of patches) {
    const { error } = await supabase
      .from("tasks")
      .update({
        deal_contact_id: patch.dealContactId,
        contact_name: patch.contactName,
        contact_email: patch.contactEmail,
        contact_phone: patch.contactPhone,
        blocked_reason: null,
      })
      .eq("id", patch.taskId)
      .eq("deal_id", dealId)
      .in("status", ["open", "in_progress", "waiting"]);
    if (error) {
      continue;
    }
    await logAuthorizedActivity({
      dealId,
      actorId,
      eventType: "task_contact_linked",
      metadata: {
        contact_type: contactType,
        reason: "reconcile",
        outbound_sent: "false",
      },
    });
  }
}

export async function createDealContactAction(
  formData: FormData,
): Promise<ContactActionResult> {
  const dealId = asString(formData.get("dealId"));
  const loaded = await loadMutableDeal(dealId);
  if (loaded.error) {
    return { error: loaded.error };
  }
  const { supabase, user, deal } = loaded;
  const contactType = asString(formData.get("contactType"));
  const name = asString(formData.get("name"));
  if (!isContactType(contactType) || !name) {
    return { error: "Name and a valid contact type are required." };
  }
  const isPrimary = asString(formData.get("isPrimary")) === "true";
  if (isPrimary) {
    await clearOtherPrimaries(supabase, deal.id, contactType);
  }
  const channel = contactActionChannel();
  const { data, error } = await supabase
    .from("deal_contacts")
    .insert({
      deal_id: deal.id,
      contact_type: contactType,
      name,
      company: asString(formData.get("company")) || null,
      email: asString(formData.get("email")) || null,
      phone: asString(formData.get("phone")) || null,
      notes: asString(formData.get("notes")) || null,
      is_primary: isPrimary,
    })
    .select("id")
    .maybeSingle();
  if (error || !data) {
    return { error: "Unable to add this contact." };
  }

  const taskId = asString(formData.get("taskId"));
  if (taskId) {
    const { data: task } = await supabase
      .from("tasks")
      .select("id, deal_id")
      .eq("id", taskId)
      .maybeSingle();
    if (task && isSameDealContact(task.deal_id, deal.id)) {
      await supabase
        .from("tasks")
        .update({
          deal_contact_id: data.id,
          contact_name: name,
          contact_email: asString(formData.get("email")) || null,
          contact_phone: asString(formData.get("phone")) || null,
          blocked_reason: null,
        })
        .eq("id", taskId);
      await logAuthorizedActivity({
        dealId: deal.id,
        actorId: user.id,
        eventType: "task_contact_linked",
        metadata: { contact_type: contactType },
      });
    }
  }

  await logAuthorizedActivity({
    dealId: deal.id,
    actorId: user.id,
    eventType: "contact_created",
    metadata: {
      contact_type: contactType,
      outbound_sent: String(channel.outboundSent),
    },
  });
  await reconcileBlockedTasksForDeal(supabase, deal.id, user.id, contactType);
  refreshDeal(deal.id);
  return { error: null, contactId: data.id };
}

export async function updateDealContactAction(
  formData: FormData,
): Promise<ContactActionResult> {
  const contactId = asString(formData.get("contactId"));
  assertSandboxGuard();
  const { supabase, user, profile } = await requireInternalUser();
  const { data: contact } = await supabase
    .from("deal_contacts")
    .select("id, deal_id, contact_type")
    .eq("id", contactId)
    .maybeSingle();
  if (!contact) {
    return { error: "Contact not found." };
  }
  const loaded = await loadMutableDeal(contact.deal_id);
  if (loaded.error) {
    return { error: loaded.error };
  }
  if (profile.role === "loan_officer") {
    return { error: "Your role cannot update contacts." };
  }
  const name = asString(formData.get("name"));
  const contactType = asString(formData.get("contactType")) || contact.contact_type;
  if (!name || !isContactType(contactType)) {
    return { error: "Name and a valid contact type are required." };
  }
  const { error } = await supabase
    .from("deal_contacts")
    .update({
      name,
      contact_type: contactType,
      company: asString(formData.get("company")) || null,
      email: asString(formData.get("email")) || null,
      phone: asString(formData.get("phone")) || null,
      notes: asString(formData.get("notes")) || null,
    })
    .eq("id", contactId);
  if (error) {
    return { error: "Unable to update this contact." };
  }
  await snapshotLinkedTasks(supabase, {
    id: contactId,
    name,
    email: asString(formData.get("email")) || null,
    phone: asString(formData.get("phone")) || null,
  });
  await logAuthorizedActivity({
    dealId: contact.deal_id,
    actorId: user.id,
    eventType: "contact_updated",
    metadata: { contact_type: contactType },
  });
  await reconcileBlockedTasksForDeal(
    supabase,
    contact.deal_id,
    user.id,
    contactType,
  );
  refreshDeal(contact.deal_id);
  return { error: null, contactId };
}

export async function markDealContactPrimaryAction(
  formData: FormData,
): Promise<ContactActionResult> {
  const contactId = asString(formData.get("contactId"));
  assertSandboxGuard();
  const { supabase, user } = await requireInternalUser();
  const { data: contact } = await supabase
    .from("deal_contacts")
    .select("id, deal_id, contact_type")
    .eq("id", contactId)
    .maybeSingle();
  if (!contact) {
    return { error: "Contact not found." };
  }
  const loaded = await loadMutableDeal(contact.deal_id);
  if (loaded.error) {
    return { error: loaded.error };
  }
  await clearOtherPrimaries(
    supabase,
    contact.deal_id,
    contact.contact_type,
    contactId,
  );
  const { error } = await supabase
    .from("deal_contacts")
    .update({ is_primary: true, archived_at: null })
    .eq("id", contactId);
  if (error) {
    return { error: "Unable to mark this contact primary." };
  }
  await logAuthorizedActivity({
    dealId: contact.deal_id,
    actorId: user.id,
    eventType: "contact_marked_primary",
    metadata: { contact_type: contact.contact_type },
  });
  await reconcileBlockedTasksForDeal(
    supabase,
    contact.deal_id,
    user.id,
    contact.contact_type,
  );
  refreshDeal(contact.deal_id);
  return { error: null, contactId };
}

export async function archiveDealContactAction(
  formData: FormData,
): Promise<ContactActionResult> {
  const contactId = asString(formData.get("contactId"));
  assertSandboxGuard();
  const { supabase, user } = await requireInternalUser();
  const { data: contact } = await supabase
    .from("deal_contacts")
    .select("id, deal_id")
    .eq("id", contactId)
    .maybeSingle();
  if (!contact) {
    return { error: "Contact not found." };
  }
  const loaded = await loadMutableDeal(contact.deal_id);
  if (loaded.error) {
    return { error: loaded.error };
  }
  const { error } = await supabase
    .from("deal_contacts")
    .update({ archived_at: new Date().toISOString(), is_primary: false })
    .eq("id", contactId);
  if (error) {
    return { error: "Unable to archive this contact." };
  }
  await logAuthorizedActivity({
    dealId: contact.deal_id,
    actorId: user.id,
    eventType: "contact_updated",
    metadata: { action: "archived" },
  });
  refreshDeal(contact.deal_id);
  return { error: null, contactId };
}

export async function linkTaskDealContactAction(
  formData: FormData,
): Promise<ContactActionResult> {
  const taskId = asString(formData.get("taskId"));
  const contactId = asString(formData.get("contactId"));
  assertSandboxGuard();
  const { supabase, user, profile } = await requireInternalUser();
  const { data: task } = await supabase
    .from("tasks")
    .select("id, deal_id, assigned_to")
    .eq("id", taskId)
    .maybeSingle();
  const { data: contact } = await supabase
    .from("deal_contacts")
    .select("id, deal_id, name, email, phone, contact_type")
    .eq("id", contactId)
    .maybeSingle();
  if (!task || !contact) {
    return { error: "Task or contact not found." };
  }
  if (!isSameDealContact(task.deal_id, contact.deal_id)) {
    return { error: "Contact must belong to the same deal." };
  }
  const loaded = await loadMutableDeal(task.deal_id);
  if (loaded.error) {
    return { error: loaded.error };
  }
  if (profile.role === "loan_officer") {
    return { error: "Your role cannot link task contacts." };
  }
  const { error } = await supabase
    .from("tasks")
    .update({
      deal_contact_id: contact.id,
      contact_name: contact.name,
      contact_email: contact.email,
      contact_phone: contact.phone,
      blocked_reason: null,
    })
    .eq("id", taskId);
  if (error) {
    return { error: "Unable to link this contact." };
  }
  await logAuthorizedActivity({
    dealId: task.deal_id,
    actorId: user.id,
    eventType: "task_contact_linked",
    metadata: { contact_type: contact.contact_type },
  });
  refreshDeal(task.deal_id);
  return { error: null, contactId };
}
