import { redirect } from "next/navigation";
import { LoginForm } from "@/app/login/login-form";
import { PillarWordmark } from "@/components/brand/pillar-logo";
import { SandboxBadge } from "@/components/sandbox-badge";
import { getAuthorizedProfileOrNull } from "@/lib/auth/session";
import { isSupabaseUrlConfigured } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

const ERROR_MESSAGES: Record<string, string> = {
  unauthorized:
    "This account is not authorized for Pillar Deal Room. Ask an admin to provision an active internal profile.",
  config:
    "Sandbox Supabase URL is missing or invalid. Set NEXT_PUBLIC_SUPABASE_URL to https://<project-ref>.supabase.co in .env.local, then restart the app.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (isSupabaseUrlConfigured()) {
    const profile = await getAuthorizedProfileOrNull();
    if (profile) {
      redirect("/dashboard");
    }
  }

  const params = await searchParams;
  const initialError = !isSupabaseUrlConfigured()
    ? ERROR_MESSAGES.config
    : params.error
      ? (ERROR_MESSAGES[params.error] ?? "Unable to sign in.")
      : undefined;

  return (
    <div className="flex min-h-full items-center justify-center bg-paper px-4 py-12">
      <div className="w-full max-w-md overflow-hidden rounded-[14px] border border-line bg-surface">
        <div className="bg-pillar-ink px-6 py-6">
          <PillarWordmark height={56} priority />
        </div>
        <div className="p-8">
          <div className="flex items-start justify-between gap-3">
            <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
              Deal Room
            </h1>
            <SandboxBadge />
          </div>
          <p className="mt-2 text-sm leading-6 text-ink-muted">
            Internal operations workspace. Access is limited to provisioned staff
            accounts. Evaluation applications are at{" "}
            <a href="/apply" className="text-pillar-navy underline">
              /apply
            </a>
            .
          </p>
          <h2 className="mt-6 text-sm font-semibold text-ink">Sign in</h2>
          <LoginForm initialError={initialError} />
          <p className="mt-6 text-center text-xs text-ink-muted">
            No public registration. Accounts are created by an administrator.
          </p>
        </div>
      </div>
    </div>
  );
}
