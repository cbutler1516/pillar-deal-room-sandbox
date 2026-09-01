import { describe, expect, it } from "vitest";
import { DEMO_DEALS } from "@/lib/demo/catalog";
import { isCopySafeSubmissionText } from "@/lib/submission/email";
import {
  buildSubmissionViewModel,
  canMarkFileSubmitted,
} from "@/lib/submission/workspace";

function viewFromDemo(borrowerName: string, status?: string) {
  const deal = DEMO_DEALS.find((row) => row.borrowerName === borrowerName);
  if (!deal) {
    throw new Error(`Missing demo deal ${borrowerName}`);
  }
  return buildSubmissionViewModel({
    dealId: deal.id,
    borrowerName: deal.borrowerName,
    entityName: deal.entityName,
    loanType: deal.loanType,
    loanPurpose: deal.loanPurpose,
    loanAmount: deal.loanAmount,
    propertyAddress: deal.propertyAddress,
    propertyCity: deal.propertyCity,
    propertyState: deal.propertyState,
    propertyType: deal.propertyType,
    experience: deal.experience,
    creditBand: deal.creditBand,
    status: status ?? deal.status,
    processorName: "Chris Butler",
    submittedLabel: null,
    intake: deal.applicationIntake,
    needs: deal.needs,
    documents: deal.documents.map((doc) => ({
      id: doc.id,
      fileName: doc.fileName,
      documentType: doc.documentType,
      status: doc.status,
      uploadedAt: doc.uploadedAt,
      linkedNeedIds: doc.clientNeedIds,
    })),
    tasks: deal.tasks,
  });
}

describe("submission workspace from file truth", () => {
  it("marks Casey Brooks ready with a populated package and copy-safe email", () => {
    const view = viewFromDemo("Casey Brooks");
    expect(view.ready).toBe(true);
    expect(view.blockers).toEqual([]);
    expect(view.manifest.length).toBeGreaterThan(0);
    expect(view.manifest.every((row) => row.status === "Approved")).toBe(true);
    expect(view.metrics.some((row) => row.key === "ltv")).toBe(true);
    expect(view.emailSubject).toContain("Casey Brooks");
    expect(isCopySafeSubmissionText(view.emailBody)).toBe(true);
    expect(view.emailBody).not.toMatch(/password|token|account number|portal/i);
    expect(view.summaryText).not.toMatch(/password|token|secret/i);
    expect(canMarkFileSubmitted({ ready: view.ready, status: "ready_for_submission" })).toBe(
      true,
    );
    expect(view.checklist.every((item) => item.state === "complete")).toBe(true);
  });

  it("makes Casey Nguyen not ready with workspace links", () => {
    const view = viewFromDemo("Casey Nguyen");
    expect(view.ready).toBe(false);
    expect(view.blockerCount).toBeGreaterThan(3);
    expect(view.blockers.some((row) => row.href.endsWith("tab=needs"))).toBe(true);
    expect(view.blockers.some((row) => row.href.endsWith("tab=documents"))).toBe(true);
    expect(view.blockers.some((row) => row.href.endsWith("tab=conditions"))).toBe(true);
    expect(view.blockers.some((row) => row.href.endsWith("tab=people"))).toBe(true);
    expect(view.manifest).toEqual([]);
    expect(canMarkFileSubmitted({ ready: view.ready, status: view.fileStatus })).toBe(
      false,
    );
  });

  it("does not keep Mark submitted available after the file is submitted", () => {
    const view = viewFromDemo("Casey Brooks", "submitted");
    expect(view.submitted).toBe(true);
    expect(view.canMarkSubmitted).toBe(false);
    expect(canMarkFileSubmitted({ ready: true, status: "submitted" })).toBe(false);
  });

  it("never puts provider bytes, access URLs, or AI authority into the workspace", () => {
    const view = viewFromDemo("Casey Brooks");
    const packed = JSON.stringify(view);
    expect(packed).not.toMatch(/externalFileId|temporaryAccess|provider_token|confidence/i);
    expect(view.ready).toBe(true);
    expect(view.emailBody).not.toMatch(/I will send|mailto:/i);
  });
});
