import { describe, expect, it } from "vitest";
import { getPlaybook, listPlaybooks } from "@/lib/playbooks/registry";
import {
  hasUnresolvedPlaybookPlaceholder,
  renderRequestTemplate,
  requestSummaryFromTemplate,
  templateContextFromDeal,
} from "@/lib/playbooks/templates";

describe("suggested request text", () => {
  it("renders insurance binder text with a property address", () => {
    const playbook = getPlaybook("request_insurance_binder")!;
    const text = renderRequestTemplate(
      playbook.requestTemplate,
      templateContextFromDeal({
        propertyAddress: "901 Maple Ridge",
        propertyCity: "Austin",
        propertyState: "TX",
      }),
    );
    expect(text).toMatch(/901 Maple Ridge, Austin, TX/);
    expect(text).not.toMatch(/\{\{/);
    expect(requestSummaryFromTemplate(playbook.requestSummary ?? "")).toMatch(
      /Request the current hazard insurance binder/,
    );
  });

  it("renders expected months as finished copy", () => {
    const playbook = getPlaybook("request_bank_statements")!;
    const text = renderRequestTemplate(
      playbook.requestTemplate,
      templateContextFromDeal({ expectedDocumentCount: 2 }),
    );
    expect(text).toBe(
      "Please provide your most recent 2 months of complete bank statements, including all pages.",
    );
    expect(hasUnresolvedPlaybookPlaceholder(text)).toBe(false);
  });

  it("uses a safe default when expected months are unavailable", () => {
    const text = renderRequestTemplate(
      "Please provide your most recent {{expected_months}} months of complete bank statements.",
      {},
    );
    expect(text).toBe(
      "Please provide your most recent 2 months of complete bank statements.",
    );
    expect(text).not.toMatch(/\[expected_months\]/);
    expect(text).not.toMatch(/\{\{/);
  });

  it("omits a missing contact clause instead of showing a token", () => {
    const text = renderRequestTemplate(
      "Please provide statements for {{property_address}} to {{contact_name}}.",
      { property_address: "1842 Cypress Ave" },
    );
    expect(text).toBe("Please provide statements for 1842 Cypress Ave");
    expect(hasUnresolvedPlaybookPlaceholder(text)).toBe(false);
  });

  it("does not leave unresolved playbook placeholders on any playbook", () => {
    const context = templateContextFromDeal({
      borrowerName: "Alex Rivera",
      propertyAddress: "100 Evaluation Ave",
      propertyCity: "Austin",
      propertyState: "TX",
      loanType: "Fix & Flip",
      dealReference: "PDR-APP-1A606C84",
      contactName: "Jordan Lee",
      expectedDocumentCount: 2,
    });
    for (const playbook of listPlaybooks()) {
      const text = renderRequestTemplate(playbook.requestTemplate, context);
      expect(hasUnresolvedPlaybookPlaceholder(text)).toBe(false);
      expect(text).not.toMatch(/\[expected_months\]|\{\{|\$\{/);
    }
  });

  it("does not execute unknown template syntax", () => {
    const text = renderRequestTemplate("Hello {{constructor}} {{unknown_var}}", {});
    expect(text).toBe("Hello");
    expect(hasUnresolvedPlaybookPlaceholder(text)).toBe(false);
  });
});
