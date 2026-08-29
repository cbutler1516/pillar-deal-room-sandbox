import "server-only";

import { assertSandboxGuard } from "@/lib/sandbox";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  buildActivityEvent,
  type ActivityEvent,
} from "@/lib/ops/workflow";

export async function logAuthorizedActivity(input: {
  dealId: string;
  actorId: string;
  eventType: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  assertSandboxGuard();
  const event: ActivityEvent = buildActivityEvent({
    eventType: input.eventType,
    actorId: input.actorId,
    metadata: input.metadata,
  });

  const admin = createServiceRoleClient();
  const { error } = await admin.from("activity_log").insert({
    deal_id: input.dealId,
    event_type: event.eventType,
    actor_type: event.actorType,
    actor_id: event.actorId,
    safe_metadata: event.safeMetadata,
  });

  if (error) {
    throw new Error(`Activity log insert failed: ${error.message}`);
  }
}
