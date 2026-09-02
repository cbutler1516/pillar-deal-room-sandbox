import { isUserRole, type UserRole } from "@/lib/auth/roles";

export type InternalProfile = {
  id: string;
  email: string;
  fullName: string | null;
  role: UserRole;
  isActive: boolean;
};

export type AuthDecision =
  | { status: "unauthenticated" }
  | { status: "denied"; reason: "missing_profile" | "inactive" }
  | { status: "authorized"; profile: InternalProfile };

export type ProfileRecord = {
  id: string;
  email: string;
  fullName: string | null;
  role: unknown;
  isActive: boolean;
};

export const PROTECTED_PREFIXES = [
  "/dashboard",
  "/deals",
  "/processor-queue",
  "/tasks",
  "/team",
] as const;

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function decideAccess(input: {
  authUserId: string | null;
  profile: ProfileRecord | null;
}): AuthDecision {
  if (!input.authUserId) {
    return { status: "unauthenticated" };
  }

  if (!input.profile) {
    return { status: "denied", reason: "missing_profile" };
  }

  if (input.profile.id !== input.authUserId) {
    return { status: "denied", reason: "missing_profile" };
  }

  if (!input.profile.isActive) {
    return { status: "denied", reason: "inactive" };
  }

  if (!isUserRole(input.profile.role)) {
    return { status: "denied", reason: "missing_profile" };
  }

  return {
    status: "authorized",
    profile: {
      id: input.profile.id,
      email: input.profile.email,
      fullName: input.profile.fullName,
      role: input.profile.role,
      isActive: true,
    },
  };
}

export function getPostAuthPath(decision: AuthDecision): string {
  if (decision.status === "authorized") {
    return "/dashboard";
  }
  return "/login";
}

export function getRootRedirectPath(decision: AuthDecision): string {
  return getPostAuthPath(decision);
}

export function unauthorizedLoginHref(reason: AuthDecision["status"] | "denied"): string {
  if (reason === "denied") {
    return "/login?error=unauthorized";
  }
  return "/login";
}

export function displayName(profile: Pick<InternalProfile, "fullName" | "email">): string {
  const name = profile.fullName?.trim();
  if (name) {
    return name;
  }
  return profile.email;
}
