import { describe, expect, it } from "vitest";
import { getPlaybook } from "@/lib/playbooks/registry";
import {
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

  it("uses a placeholder when a variable is missing", () => {
    const text = renderRequestTemplate(
      "Please provide statements for {{property_address}} to {{contact_name}}.",
      { property_address: "1842 Cypress Ave" },
    );
    expect(text).toBe(
      "Please provide statements for 1842 Cypress Ave to [contact_name].",
    );
  });

  it("does not execute unknown template syntax", () => {
    const text = renderRequestTemplate("Hello {{constructor}} {{unknown_var}}", {});
    expect(text).toBe("Hello [constructor] [unknown_var]");
  });
});
