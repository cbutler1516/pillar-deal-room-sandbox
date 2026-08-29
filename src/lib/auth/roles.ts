export const USER_ROLES = ["admin", "loan_officer", "processor"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && USER_ROLES.includes(value as UserRole);
}

export function isAdmin(role: UserRole | null | undefined): boolean {
  return role === "admin";
}

export function isProcessor(role: UserRole | null | undefined): boolean {
  return role === "processor";
}

export function isLoanOfficer(role: UserRole | null | undefined): boolean {
  return role === "loan_officer";
}

export function hasRole(
  role: UserRole | null | undefined,
  allowed: readonly UserRole[],
): boolean {
  return role != null && allowed.includes(role);
}

export function formatRoleLabel(role: UserRole): string {
  switch (role) {
    case "admin":
      return "Admin";
    case "loan_officer":
      return "Loan Officer";
    case "processor":
      return "Processor";
  }
}
