import { describe, expect, it } from "vitest";
import {
  hasRole,
  isAdmin,
  isLoanOfficer,
  isProcessor,
  isUserRole,
} from "@/lib/auth/roles";

describe("role guards", () => {
  it("recognizes the three internal roles only", () => {
    expect(isUserRole("admin")).toBe(true);
    expect(isUserRole("loan_officer")).toBe(true);
    expect(isUserRole("processor")).toBe(true);
    expect(isUserRole("borrower")).toBe(false);
    expect(isUserRole("admin@example.com")).toBe(false);
  });

  it("exposes reusable role checks", () => {
    expect(isAdmin("admin")).toBe(true);
    expect(isProcessor("processor")).toBe(true);
    expect(isLoanOfficer("loan_officer")).toBe(true);
    expect(hasRole("admin", ["admin", "processor"])).toBe(true);
    expect(hasRole("loan_officer", ["admin", "processor"])).toBe(false);
  });
});
