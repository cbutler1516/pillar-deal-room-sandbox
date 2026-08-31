import { isAdmin, isLoanOfficer, isProcessor, type UserRole } from "@/lib/auth/roles";

export function canViewDocumentIntelligence(
  role: UserRole | null | undefined,
): boolean {
  return isAdmin(role) || isProcessor(role) || isLoanOfficer(role);
}

export function canApplyDocumentIntelligenceSuggestion(
  role: UserRole | null | undefined,
): boolean {
  return isAdmin(role) || isProcessor(role);
}
