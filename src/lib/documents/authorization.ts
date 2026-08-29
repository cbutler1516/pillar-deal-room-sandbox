import { isAdmin, isLoanOfficer, isProcessor, type UserRole } from "@/lib/auth/roles";

/**
 * Document intake and temporary access require:
 * - an authenticated internal user
 * - admin or processor role (loan officers cannot use intake)
 * - processor deal eligibility: unassigned or assigned to that processor
 *
 * Temporary access URLs are issued only after this check succeeds.
 * Processor permissions are based on deal access, not a global document role.
 */
export type DocumentIntakeDecision =
  | "ok"
  | "unauthenticated"
  | "forbidden_role"
  | "forbidden_deal";

export function canUseDocumentIntake(
  assignedProcessorId: string | null,
  userId: string,
  role: UserRole,
): boolean {
  return authorizeDocumentIntake({
    userId,
    role,
    assignedProcessorId,
  }) === "ok";
}

export function authorizeDocumentIntake(input: {
  userId: string | null;
  role: UserRole | null;
  assignedProcessorId: string | null;
}): DocumentIntakeDecision {
  if (!input.userId || !input.role) {
    return "unauthenticated";
  }
  if (isLoanOfficer(input.role)) {
    return "forbidden_role";
  }
  if (!isAdmin(input.role) && !isProcessor(input.role)) {
    return "forbidden_role";
  }
  if (isAdmin(input.role)) {
    return "ok";
  }
  if (
    input.assignedProcessorId != null &&
    input.assignedProcessorId !== input.userId
  ) {
    return "forbidden_deal";
  }
  return "ok";
}

export function documentIntakeErrorMessage(
  decision: DocumentIntakeDecision,
): string {
  switch (decision) {
    case "unauthenticated":
      return "Sign in is required to start a document upload session.";
    case "forbidden_role":
      return "Loan officers cannot use document intake.";
    case "forbidden_deal":
      return "Processors can use document intake only on unassigned deals or deals assigned to them.";
    case "ok":
      return "";
  }
}

export function shouldMarkNeedReceived(status: string): boolean {
  return status === "missing" || status === "requested";
}
