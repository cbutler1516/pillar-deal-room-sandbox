import { describe, expect, it } from "vitest";
import { DEMO_DEALS } from "@/lib/demo/catalog";
import { assertCanSeed, buildSeedRows, seedDemoDeals, type SeedClient } from "@/lib/demo/seed";

function createMemoryClient(): SeedClient & {
  deals: Record<string, unknown>[];
  tables: Record<string, Record<string, unknown>[]>;
} {
  const tables: Record<string, Record<string, unknown>[]> = {
    deals: [],
    client_needs: [],
    documents: [],
    document_client_needs: [],
    deal_contacts: [],
    tasks: [],
    activity_log: [],
  };

  return {
    deals: tables.deals,
    tables,
    async listDemoDealIds() {
      return tables.deals
        .filter((row) => String(row.deal_reference).startsWith("PDR-SBX-"))
        .map((row) => String(row.id));
    },
    async deleteByDealIds(table, dealIds) {
      tables[table] = (tables[table] ?? []).filter(
        (row) => !dealIds.includes(String(row.deal_id)),
      );
    },
    async deleteDocumentLinksForDealIds(dealIds) {
      const documentIds = new Set(
        (tables.documents ?? [])
          .filter((row) => dealIds.includes(String(row.deal_id)))
          .map((row) => String(row.id)),
      );
      tables.document_client_needs = (tables.document_client_needs ?? []).filter(
        (row) => !documentIds.has(String(row.document_id)),
      );
    },
    async deleteDeals(ids) {
      tables.deals = tables.deals.filter((row) => !ids.includes(String(row.id)));
    },
    async upsert(table, rows) {
      const current = tables[table] ?? [];
      for (const row of rows) {
        const index = current.findIndex((item) => item.id === row.id);
        if (index >= 0) current[index] = row;
        else current.push(row);
      }
      tables[table] = current;
    },
  };
}

describe("seed guard", () => {
  it("refuses to seed outside sandbox", () => {
    expect(() =>
      assertCanSeed({
        SANDBOX_MODE: "false",
        PRODUCTION_INTEGRATIONS_ENABLED: "false",
      }),
    ).toThrow(/SANDBOX_MODE/);
  });

  it("refuses when production integrations are enabled", () => {
    expect(() =>
      assertCanSeed({
        SANDBOX_MODE: "true",
        PRODUCTION_INTEGRATIONS_ENABLED: "true",
      }),
    ).toThrow(/PRODUCTION_INTEGRATIONS_ENABLED/);
  });
});

describe("idempotent demo seed", () => {
  it("creates six fictitious deals and replaces them on rerun", async () => {
    const client = createMemoryClient();
    const env = {
      SANDBOX_MODE: "true",
      PRODUCTION_INTEGRATIONS_ENABLED: "false",
    };
    const first = await seedDemoDeals(client, env);
    const second = await seedDemoDeals(client, env);
    expect(first.dealCount).toBe(6);
    expect(second.replacedDealIds).toBe(6);
    expect(client.deals).toHaveLength(6);
    expect(buildSeedRows()[0].deal.assigned_processor_id).toBeNull();
    expect(DEMO_DEALS.every((deal) => deal.borrowerEmail.endsWith("@sandbox.example"))).toBe(true);
    const seeded = buildSeedRows();
    const linkCounts = seeded.flatMap((row) =>
      row.documents.map(
        (doc) =>
          row.documentLinks.filter((link) => link.document_id === doc.id).length,
      ),
    );
    expect(linkCounts.some((count) => count > 1)).toBe(true);
    expect(linkCounts.some((count) => count === 0)).toBe(true);
    expect(
      seeded.every((row) =>
        row.documents.every((doc) => !("client_need_id" in doc)),
      ),
    ).toBe(true);
    expect(
      seeded.flatMap((row) => row.documentLinks).every(
        (link) =>
          typeof link.id === "string" &&
          link.link_source === "system" &&
          link.linked_by === null &&
          typeof link.linked_at === "string",
      ),
    ).toBe(true);
    const linkIds = client.tables.document_client_needs.map((row) =>
      String(row.id),
    );
    expect(linkIds).toHaveLength(new Set(linkIds).size);
    expect(client.tables.document_client_needs).toHaveLength(
      seeded.flatMap((row) => row.documentLinks).length,
    );
    const avery = seeded.find((row) => row.deal.borrower_name === "Avery Quinn");
    const riley = seeded.find((row) => row.deal.borrower_name === "Riley Chen");
    const sam = seeded.find((row) => row.deal.borrower_name === "Sam Rivera");
    expect(avery?.tasks.map((task) => task.playbook_key)).toEqual(
      expect.arrayContaining([
        "request_insurance_binder",
        "review_bank_statements",
        "follow_up_lease",
        "prepare_submission",
      ]),
    );
    expect(riley?.tasks.map((task) => task.playbook_key)).toEqual(
      expect.arrayContaining([
        "request_rehab_budget",
        "request_scope_of_work",
        "follow_up_borrower",
      ]),
    );
    expect(sam?.tasks.some((task) => task.playbook_key === "resolve_exception")).toBe(
      true,
    );
    expect(sam?.tasks.some((task) => task.source_type === "title")).toBe(true);
    expect(avery?.tasks.some((task) => task.contact_email?.includes("sandbox"))).toBe(
      true,
    );
    expect(avery?.contacts.map((item) => item.contact_type)).toEqual(
      expect.arrayContaining(["borrower", "insurance", "title"]),
    );
    expect(riley?.contacts.some((item) => item.name === "Morgan Price")).toBe(true);
    expect(sam?.contacts.some((item) => item.name === "Dana Clark")).toBe(true);
    expect(avery?.tasks.some((task) => task.deal_contact_id)).toBe(true);
    expect(
      seeded
        .flatMap((row) => row.tasks)
        .some((task) => task.blocked_reason === "contact_missing"),
    ).toBe(true);
  });
});
