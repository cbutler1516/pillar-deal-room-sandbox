import { isAdmin, isLoanOfficer, isProcessor, type UserRole } from "@/lib/auth/roles";
import type { AICapability } from "./types";

/** Admin and processor can request AI assist. Loan officers can view generated summaries. */
export function canRequestAIAssist(role: UserRole | null | undefined): boolean {
  return isAdmin(role) || isProcessor(role);
}

export function canViewAIAssist(role: UserRole | null | undefined): boolean {
  return canRequestAIAssist(role) || isLoanOfficer(role);
}

export function canUseAICapability(
  role: UserRole | null | undefined,
  capability: AICapability,
): boolean {
  if (capability === "summarize_deal" || capability === "summarize_communications") {
    return canViewAIAssist(role);
  }
  return canRequestAIAssist(role);
}
