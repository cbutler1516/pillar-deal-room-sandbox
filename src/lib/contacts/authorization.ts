import { isAdmin, isLoanOfficer, isProcessor, type UserRole } from "@/lib/auth/roles";

export function canMutateDealContacts(input: {
  role: UserRole;
  userId: string;
  dealAssignedProcessorId: string | null;
}): boolean {
  if (isAdmin(input.role)) {
    return true;
  }
  if (!isProcessor(input.role)) {
    return false;
  }
  return (
    input.dealAssignedProcessorId == null ||
    input.dealAssignedProcessorId === input.userId
  );
}

export function loanOfficerCanMutateContacts(role: UserRole): boolean {
  return !isLoanOfficer(role) && (isAdmin(role) || isProcessor(role));
}
