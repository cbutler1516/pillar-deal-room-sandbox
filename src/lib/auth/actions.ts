"use server";

import { redirect } from "next/navigation";
import { decideAccess } from "@/lib/auth/authorization";
import { isUserRole } from "@/lib/auth/roles";
import { assertSandboxGuard } from "@/lib/sandbox";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type SignInState = {
  error: string | null;
};

function readField(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function signIn(
  _prevState: SignInState,
  formData: FormData,
): Promise<SignInState> {
  assertSandboxGuard();

  const email = readField(formData, "email");
  const password = formData.get("password");

  if (!email || typeof password !== "string" || password.length === 0) {
    return { error: "Enter your email and password." };
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    return { error: "Invalid email or password." };
  }

  const { data: isInternal } = await supabase.rpc("is_internal_user");
  const { data: role } = await supabase.rpc("current_user_role");
  const { data: row } = await supabase
    .from("users")
    .select("id, email, full_name, role, is_active")
    .eq("id", data.user.id)
    .maybeSingle();

  const decision = decideAccess({
    authUserId: data.user.id,
    profile:
      isInternal === true && isUserRole(role)
        ? {
            id: data.user.id,
            email: row?.email ?? data.user.email ?? email,
            fullName: row?.full_name ?? null,
            role: row?.role && isUserRole(row.role) ? row.role : role,
            isActive: row?.is_active ?? true,
          }
        : null,
  });

  if (decision.status !== "authorized") {
    await supabase.auth.signOut();
    return {
      error:
        "This account is not authorized for Pillar Deal Room. Ask an admin to provision an active internal profile.",
    };
  }

  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/login");
}
