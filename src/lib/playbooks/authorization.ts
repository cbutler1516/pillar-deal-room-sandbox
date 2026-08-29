import { isAdmin, isLoanOfficer, isProcessor, type UserRole } from "@/lib/auth/roles";

export function canMutateProcessorTask(input: {
  role: UserRole;
  userId: string;
  dealAssignedProcessorId: string | null;
  taskAssignedTo: string | null;
}): boolean {
  if (isAdmin(input.role)) {
    return true;
  }
  if (!isProcessor(input.role)) {
    return false;
  }
  if (
    input.dealAssignedProcessorId != null &&
    input.dealAssignedProcessorId !== input.userId
  ) {
    return false;
  }
  if (input.taskAssignedTo != null && input.taskAssignedTo !== input.userId) {
    return false;
  }
  return true;
}

export function canCreateProcessorTask(input: {
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

export function loanOfficerCanMutateTasks(role: UserRole): boolean {
  return !isLoanOfficer(role) && (isAdmin(role) || isProcessor(role));
}
