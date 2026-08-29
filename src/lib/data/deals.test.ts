import { describe, expect, it } from "vitest";
import { DEMO_DEALS } from "@/lib/demo/catalog";

describe("deal detail queries", () => {
  it("exposes overview, needs, documents, tasks, and activity without storage ids in UI fields", () => {
    const deal = DEMO_DEALS[2];
    expect(deal.dealReference).toMatch(/^PDR-SBX-/);
    expect(deal.needs.length).toBeGreaterThan(0);
    expect(deal.documents.every((doc) => doc.externalFileId.startsWith("sandbox-demo-"))).toBe(true);
    expect(deal.documents[0]).toHaveProperty("fileName");
    expect(deal.documents[0]).toHaveProperty("aiClassification");
    expect(deal.activity.every((event) => !("ssn" in event.safeMetadata))).toBe(true);
    const multiLinked = deal.documents.find((doc) => doc.clientNeedIds.length > 1);
    const unlinked = deal.documents.find((doc) => doc.clientNeedIds.length === 0);
    const bankNeed = deal.needs.find((need) => need.documentType.includes("Bank Statements"));
    const bankDocs = deal.documents.filter((doc) => doc.clientNeedIds.includes(bankNeed!.id));
    expect(multiLinked).toBeDefined();
    expect(unlinked?.fileName).toMatch(/appraisal/);
    expect(bankDocs.length).toBeGreaterThanOrEqual(2);
  });
});
