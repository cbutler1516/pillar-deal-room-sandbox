import { describe, expect, it } from "vitest";
import {
  canMutateDealContacts,
  loanOfficerCanMutateContacts,
} from "@/lib/contacts/authorization";

describe("processor contact RLS", () => {
  it("lets a processor mutate contacts only on unassigned or own deals", () => {
    expect(
      canMutateDealContacts({
        role: "processor",
        userId: "proc-a",
        dealAssignedProcessorId: null,
      }),
    ).toBe(true);
    expect(
      canMutateDealContacts({
        role: "processor",
        userId: "proc-a",
        dealAssignedProcessorId: "proc-a",
      }),
    ).toBe(true);
    expect(
      canMutateDealContacts({
        role: "processor",
        userId: "proc-a",
        dealAssignedProcessorId: "proc-b",
      }),
    ).toBe(false);
    expect(
      canMutateDealContacts({
        role: "admin",
        userId: "admin-1",
        dealAssignedProcessorId: "proc-b",
      }),
    ).toBe(true);
  });
});

describe("loan officer contact access", () => {
  it("is read-only", () => {
    expect(loanOfficerCanMutateContacts("loan_officer")).toBe(false);
    expect(
      canMutateDealContacts({
        role: "loan_officer",
        userId: "lo-1",
        dealAssignedProcessorId: null,
      }),
    ).toBe(false);
  });
});
