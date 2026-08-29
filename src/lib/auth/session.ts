import "server-only";

import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  decideAccess,
  type InternalProfile,
  type ProfileRecord,
} from "@/lib/auth/authorization";
import { isUserRole } from "@/lib/auth/roles";
import { assertSandboxGuard } from "@/lib/sandbox";
import { createServerSupabaseClient } from "@/lib/supabase/server";

async function loadProfileRecord(
  supabase: SupabaseClient,
  user: User,
): Promise<ProfileRecord | null> {
  const { data: isInternal, error: internalError } = await supabase.rpc(
    "is_internal_user",
  );

  if (internalError || isInternal !== true) {
    return null;
  }

  const { data: role, error: roleError } = await supabase.rpc(
    "current_user_role",
  );

  if (roleError || !isUserRole(role)) {
    return null;
  }

  const { data: row } = await supabase
    .from("users")
    .select("id, email, full_name, role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  return {
    id: user.id,
    email: row?.email ?? user.email ?? "",
    fullName: row?.full_name ?? null,
    role: row?.role && isUserRole(row.role) ? row.role : role,
    isActive: row?.is_active ?? true,
  };
}

export async function readAuthState() {
  assertSandboxGuard();

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      supabase,
      decision: decideAccess({ authUserId: null, profile: null }),
    };
  }

  const profile = await loadProfileRecord(supabase, user);
  return {
    supabase,
    user,
    decision: decideAccess({ authUserId: user.id, profile }),
  };
}

export async function requireInternalUser(): Promise<{
  supabase: SupabaseClient;
  user: User;
  profile: InternalProfile;
}> {
  const { supabase, user, decision } = await readAuthState();

  if (decision.status === "unauthenticated") {
    redirect("/login");
  }

  if (decision.status === "denied") {
    await supabase.auth.signOut();
    redirect("/login?error=unauthorized");
  }

  if (!user) {
    redirect("/login");
  }

  return { supabase, user, profile: decision.profile };
}

export async function getAuthorizedProfileOrNull(): Promise<InternalProfile | null> {
  const { supabase, decision } = await readAuthState();

  if (decision.status === "denied") {
    await supabase.auth.signOut();
    return null;
  }

  if (decision.status !== "authorized") {
    return null;
  }

  return decision.profile;
}
