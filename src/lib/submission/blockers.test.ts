import { describe, expect, it } from "vitest";
import {
  buildSubmissionBlockers,
  buildSubmissionReadyItems,
} from "@/lib/submission/blockers";

describe("submission blockers", () => {
  it("links each blocker to the owning workspace", () => {
    const blockers = buildSubmissionBlockers({
      dealId: "deal-7",
      needs: [
        {
          id: "n-id",
          documentType: "Government-issued ID",
          required: true,
          status: "rejected",
          timing: "required_now",
        },
        {
          id: "n-bank",
          documentType: "Bank Statements",
          required: true,
          status: "needs_review",
          timing: "required_now",
        },
        {
          id: "n-ins",
          documentType: "Insurance Binder",
          required: true,
          status: "missing",
          timing: "required_now",
        },
      ],
      tasks: [
        {
          id: "t-ins",
          title: "Request insurance binder",
          status: "open",
          blockedReason: "contact_missing",
          sourceType: "insurance",
        },
        {
          id: "t-cond",
          title: "Updated bank statement",
          status: "open",
          sourceType: "lender",
          playbookKey: "lender_condition",
          timing: "required_now",
        },
      ],
    });
    expect(blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Government-issued ID",
          reason: "Replacement still needed",
          href: "/deals/deal-7?tab=needs",
        }),
        expect.objectContaining({
          title: "Bank Statements",
          reason: "Document awaiting review",
          href: "/deals/deal-7?tab=documents",
        }),
        expect.objectContaining({
          title: "Insurance Binder",
          reason: "Required document missing",
          href: "/deals/deal-7?tab=needs",
        }),
        expect.objectContaining({
          reason: "Contact information missing",
          href: "/deals/deal-7?tab=people",
        }),
        expect.objectContaining({
          title: "Updated bank statement",
          reason: "Open lender condition",
          href: "/deals/deal-7?tab=conditions",
        }),
      ]),
    );
  });

  it("lists approved and waived items as ready", () => {
    const ready = buildSubmissionReadyItems({
      hasApplication: true,
      needs: [
        { id: "1", documentType: "Entity documents", required: true, status: "approved" },
        { id: "2", documentType: "Operating statements", required: false, status: "waived" },
        { id: "3", documentType: "ID", required: true, status: "rejected" },
      ],
    });
    expect(ready.map((row) => row.title)).toEqual([
      "Borrower application",
      "Entity documents",
      "Operating statements",
    ]);
  });
});
