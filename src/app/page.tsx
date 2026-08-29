import { redirect } from "next/navigation";
import { getRootRedirectPath } from "@/lib/auth/authorization";
import { readAuthState } from "@/lib/auth/session";
import { isSupabaseUrlConfigured } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  if (!isSupabaseUrlConfigured()) {
    redirect("/login?error=config");
  }

  const { supabase, decision } = await readAuthState();

  if (decision.status === "denied") {
    await supabase.auth.signOut();
    redirect("/login?error=unauthorized");
  }

  redirect(getRootRedirectPath(decision));
}
