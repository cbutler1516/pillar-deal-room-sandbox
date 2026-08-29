import "server-only";

import { buildApplicationPackage } from "@/lib/application/package";
import { createPortalToken } from "@/lib/application/token";
import type { ApplicationDraft } from "@/lib/application/types";
import { validateApplication } from "@/lib/application/validate";
import { sanitizeActivityMetadata } from "@/lib/ops/workflow";
import { assertSandboxGuard } from "@/lib/sandbox";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export type PersistApplicationResult =
  | {
      ok: true;
      dealId: string;
      dealReference: string;
      portalToken: string;
    }
  | { ok: false; error: string };

export async function persistSandboxApplication(
  draft: ApplicationDraft,
): Promise<PersistApplicationResult> {
  assertSandboxGuard();
  const validated = validateApplication(draft);
  if (!validated.ok) {
    return validated;
  }

  const pack = buildApplicationPackage(validated.value);
  const admin = createServiceRoleClient();

  const { error: dealError } = await admin.from("deals").insert(pack.deal);
  if (dealError) {
    return { ok: false, error: "Unable to create the deal from this application." };
  }

  const { error: contactError } = await admin.from("deal_contacts").insert(pack.contact);
  if (contactError) {
    await admin.from("deals").delete().eq("id", pack.dealId);
    return { ok: false, error: "Unable to create the borrower contact." };
  }

  const borrowerTasks = pack.tasks.map((task) =>
    task.source_type === "borrower"
      ? {
          ...task,
          deal_contact_id: pack.contact.id,
          contact_name: pack.contact.name,
          contact_email: pack.contact.email,
          contact_phone: pack.contact.phone,
        }
      : task,
  );

  if (pack.needs.length > 0) {
    const { error: needError } = await admin.from("client_needs").insert(pack.needs);
    if (needError) {
      await admin.from("deals").delete().eq("id", pack.dealId);
      return { ok: false, error: "Unable to create Client Needs." };
    }
  }

  if (borrowerTasks.length > 0) {
    const { error: taskError } = await admin.from("tasks").insert(borrowerTasks);
    if (taskError) {
      await admin.from("deals").delete().eq("id", pack.dealId);
      return { ok: false, error: "Unable to create processor tasks." };
    }
  }

  const { error: activityError } = await admin.from("activity_log").insert({
    ...pack.activity,
    safe_metadata: sanitizeActivityMetadata(
      (pack.activity.safe_metadata as Record<string, unknown>) ?? {},
    ),
  });
  if (activityError) {
    await admin.from("deals").delete().eq("id", pack.dealId);
    return { ok: false, error: "Unable to record application activity." };
  }

  return {
    ok: true,
    dealId: pack.dealId,
    dealReference: pack.dealReference,
    portalToken: createPortalToken(pack.dealId),
  };
}
