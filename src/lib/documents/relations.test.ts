import { describe, expect, it } from "vitest";
import { canUseDocumentIntake } from "@/lib/documents/authorization";
import {
  activityMetadataForRelationTest,
  assertSameDealLink,
  attachDocumentsToClientNeed,
  backfillDocumentNeedLinks,
  cloneClientNeed,
  detachDocumentFromClientNeed,
  type DocumentRelationStore,
  type RelationDeps,
  type RelationDocument,
  type RelationNeed,
} from "@/lib/documents/relations";

function createStore(input?: {
  assignedProcessorId?: string | null;
}): {
  store: DocumentRelationStore;
  documents: Map<string, RelationDocument>;
  needs: Map<string, RelationNeed>;
  links: { documentId: string; clientNeedId: string }[];
} {
  const documents = new Map<string, RelationDocument>([
    ["doc-july", { id: "doc-july", dealId: "deal-1", fileName: "july-chase.pdf", documentType: "Bank Statements", status: "approved" }],
    ["doc-august", { id: "doc-august", dealId: "deal-1", fileName: "august-chase.pdf", documentType: "Bank Statements", status: "needs_review" }],
    ["doc-sept", { id: "doc-sept", dealId: "deal-1", fileName: "sept-chase.pdf", documentType: "Bank Statements", status: "received" }],
    ["doc-stub-1", { id: "doc-stub-1", dealId: "deal-1", fileName: "paystub-0801.pdf", documentType: "Pay Stubs", status: "received" }],
    ["doc-stub-2", { id: "doc-stub-2", dealId: "deal-1", fileName: "paystub-0815.pdf", documentType: "Pay Stubs", status: "received" }],
    ["doc-stub-3", { id: "doc-stub-3", dealId: "deal-1", fileName: "paystub-0829.pdf", documentType: "Pay Stubs", status: "received" }],
    ["doc-unlinked", { id: "doc-unlinked", dealId: "deal-1", fileName: "appraisal.pdf", documentType: "Appraisal", status: "received" }],
    ["doc-other-deal", { id: "doc-other-deal", dealId: "deal-2", fileName: "other.pdf", documentType: "Other", status: "received" }],
  ]);
  const needs = new Map<string, RelationNeed>([
    ["need-bank", {
      id: "need-bank",
      dealId: "deal-1",
      status: "requested",
      documentType: "Bank Statements",
      category: "Liquidity",
      description: "Most recent 2 months",
      required: true,
      expectedDocumentCount: 2,
      requireAllLinkedApproved: true,
      notes: null,
    }],
    ["need-pof", {
      id: "need-pof",
      dealId: "deal-1",
      status: "requested",
      documentType: "Proof of Funds",
      category: "Liquidity",
      description: null,
      required: true,
      expectedDocumentCount: null,
      requireAllLinkedApproved: true,
      notes: null,
    }],
    ["need-stubs", {
      id: "need-stubs",
      dealId: "deal-1",
      status: "requested",
      documentType: "Pay Stubs",
      category: "Income",
      description: "Most recent 30 days",
      required: true,
      expectedDocumentCount: 3,
      requireAllLinkedApproved: true,
      notes: null,
    }],
    ["need-other-deal", {
      id: "need-other-deal",
      dealId: "deal-2",
      status: "missing",
      documentType: "Other",
      category: "Other",
      description: null,
      required: true,
      expectedDocumentCount: null,
      requireAllLinkedApproved: true,
      notes: null,
    }],
  ]);
  const links: { documentId: string; clientNeedId: string }[] = [];

  const store: DocumentRelationStore = {
    async getDeal(dealId) {
      if (dealId === "deal-1") {
        return { id: "deal-1", assignedProcessorId: input?.assignedProcessorId ?? null };
      }
      if (dealId === "deal-2") {
        return { id: "deal-2", assignedProcessorId: null };
      }
      return null;
    },
    async getNeed(needId) {
      return needs.get(needId) ?? null;
    },
    async getDocument(documentId) {
      return documents.get(documentId) ?? null;
    },
    async listDocumentsForDeal(dealId) {
      return [...documents.values()].filter((doc) => doc.dealId === dealId);
    },
    async listLinksForNeed(needId) {
      return links.filter((link) => link.clientNeedId === needId);
    },
    async listLinksForDocument(documentId) {
      return links.filter((link) => link.documentId === documentId);
    },
    async insertLink(row) {
      if (
        links.some(
          (link) =>
            link.documentId === row.documentId && link.clientNeedId === row.clientNeedId,
        )
      ) {
        return "already_linked";
      }
      const document = documents.get(row.documentId);
      const need = needs.get(row.clientNeedId);
      if (!document || !need || document.dealId !== need.dealId) {
        throw new Error("A document may only link to a Client Need on the same deal.");
      }
      links.push({ documentId: row.documentId, clientNeedId: row.clientNeedId });
      return "created";
    },
    async deleteLink(documentId, clientNeedId) {
      const index = links.findIndex(
        (link) => link.documentId === documentId && link.clientNeedId === clientNeedId,
      );
      if (index < 0) {
        return false;
      }
      links.splice(index, 1);
      return true;
    },
    async updateNeedStatus(needId, status) {
      const need = needs.get(needId);
      if (need) {
        needs.set(needId, { ...need, status });
      }
    },
    async insertNeed(row) {
      const id = `need-clone-${needs.size}`;
      needs.set(id, {
        id,
        dealId: row.dealId,
        status: row.status,
        documentType: row.documentType,
        category: row.category,
        description: row.description,
        required: row.required,
        expectedDocumentCount: row.expectedDocumentCount,
        requireAllLinkedApproved: row.requireAllLinkedApproved,
        notes: null,
      });
      return { id };
    },
  };

  return { store, documents, needs, links };
}

function deps(options?: {
  role?: "admin" | "processor" | "loan_officer" | null;
  userId?: string | null;
  assignedProcessorId?: string | null;
}): RelationDeps & ReturnType<typeof createStore> & { events: { eventType: string; metadata?: Record<string, unknown> }[] } {
  const memory = createStore({
    assignedProcessorId: options?.assignedProcessorId ?? null,
  });
  const events: { eventType: string; metadata?: Record<string, unknown> }[] = [];
  return {
    ...memory,
    actor: {
      userId: options?.userId === undefined ? "admin-1" : options.userId,
      role: options?.role === undefined ? "admin" : options.role,
    },
    events,
    async logActivity(event) {
      events.push(event);
    },
  };
}

describe("many-to-many document linkage", () => {
  it("lets one Client Need have multiple documents of the same type", async () => {
    const service = deps();
    const result = await attachDocumentsToClientNeed(service, {
      dealId: "deal-1",
      clientNeedId: "need-bank",
      documentIds: ["doc-july", "doc-august", "doc-sept"],
    });
    expect(result.ok).toBe(true);
    expect(service.links.filter((link) => link.clientNeedId === "need-bank")).toHaveLength(3);
  });

  it("lets one document satisfy multiple Client Needs without duplicating the file", async () => {
    const service = deps();
    await attachDocumentsToClientNeed(service, {
      dealId: "deal-1",
      clientNeedId: "need-bank",
      documentIds: ["doc-july"],
    });
    await attachDocumentsToClientNeed(service, {
      dealId: "deal-1",
      clientNeedId: "need-pof",
      documentIds: ["doc-july"],
    });
    expect(service.documents.size).toBeGreaterThan(0);
    expect(service.links.filter((link) => link.documentId === "doc-july")).toHaveLength(2);
    expect(service.documents.get("doc-july")?.fileName).toBe("july-chase.pdf");
  });

  it("keeps unlinked documents valid", () => {
    const service = deps();
    expect(
      service.links.filter((link) => link.documentId === "doc-unlinked"),
    ).toHaveLength(0);
  });

  it("attaches multiple existing documents to one need in one workflow", async () => {
    const service = deps();
    const result = await attachDocumentsToClientNeed(service, {
      dealId: "deal-1",
      clientNeedId: "need-stubs",
      documentIds: ["doc-stub-1", "doc-stub-2", "doc-stub-3"],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.linked).toHaveLength(3);
      expect(result.data.needStatus).toBe("received");
      expect(result.data.needStatus).not.toBe("approved");
    }
  });

  it("does not accept raw file bytes when attaching", async () => {
    const service = deps();
    await expect(
      attachDocumentsToClientNeed(service, {
        dealId: "deal-1",
        clientNeedId: "need-bank",
        documentIds: ["doc-july"],
        base64: "AAAA",
      } as never),
    ).rejects.toThrow(/Raw file bytes/);
  });

  it("rejects a cross-deal link", async () => {
    expect(() => assertSameDealLink("deal-1", "deal-2")).toThrow(/same deal/);
    const service = deps();
    const result = await attachDocumentsToClientNeed(service, {
      dealId: "deal-1",
      clientNeedId: "need-bank",
      documentIds: ["doc-other-deal"],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/not found on this deal|same deal/);
    }
  });

  it("handles a duplicate link cleanly", async () => {
    const service = deps();
    await attachDocumentsToClientNeed(service, {
      dealId: "deal-1",
      clientNeedId: "need-bank",
      documentIds: ["doc-july"],
    });
    const again = await attachDocumentsToClientNeed(service, {
      dealId: "deal-1",
      clientNeedId: "need-bank",
      documentIds: ["doc-july"],
    });
    expect(again.ok).toBe(true);
    if (again.ok) {
      expect(again.data.alreadyLinked).toContain("july-chase.pdf");
    }
    expect(service.links.filter((link) => link.documentId === "doc-july")).toHaveLength(1);
  });

  it("detaches a link without deleting the document", async () => {
    const service = deps();
    await attachDocumentsToClientNeed(service, {
      dealId: "deal-1",
      clientNeedId: "need-bank",
      documentIds: ["doc-july"],
    });
    const detached = await detachDocumentFromClientNeed(service, {
      dealId: "deal-1",
      documentId: "doc-july",
      clientNeedId: "need-bank",
    });
    expect(detached.ok).toBe(true);
    if (detached.ok) {
      expect(detached.data.documentKept).toBe(true);
    }
    expect(service.documents.get("doc-july")).toBeDefined();
    expect(service.links).toHaveLength(0);
  });

  it("does not auto-approve a Client Need on the first document", async () => {
    const service = deps();
    const result = await attachDocumentsToClientNeed(service, {
      dealId: "deal-1",
      clientNeedId: "need-bank",
      documentIds: ["doc-july"],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.needStatus).toBe("received");
    }
    expect(service.needs.get("need-bank")?.status).toBe("received");
  });

  it("supports a 2-document bank-statement workflow and a 3-document pay-stub workflow", async () => {
    const service = deps();
    const banks = await attachDocumentsToClientNeed(service, {
      dealId: "deal-1",
      clientNeedId: "need-bank",
      documentIds: ["doc-july", "doc-august"],
    });
    const stubs = await attachDocumentsToClientNeed(service, {
      dealId: "deal-1",
      clientNeedId: "need-stubs",
      documentIds: ["doc-stub-1", "doc-stub-2", "doc-stub-3"],
    });
    expect(banks.ok && stubs.ok).toBe(true);
    expect(service.links.filter((link) => link.clientNeedId === "need-bank")).toHaveLength(2);
    expect(service.links.filter((link) => link.clientNeedId === "need-stubs")).toHaveLength(3);
    expect(service.needs.get("need-bank")?.status).not.toBe("approved");
    expect(service.needs.get("need-stubs")?.status).toBe("received");
  });

  it("denies loan officers and ineligible processors", async () => {
    const lo = deps({ userId: "lo-1", role: "loan_officer" });
    const denied = await attachDocumentsToClientNeed(lo, {
      dealId: "deal-1",
      clientNeedId: "need-bank",
      documentIds: ["doc-july"],
    });
    expect(denied.ok).toBe(false);
    expect(canUseDocumentIntake("proc-b", "proc-a", "processor")).toBe(false);

    const processor = deps({
      userId: "proc-a",
      role: "processor",
      assignedProcessorId: "proc-b",
    });
    const blocked = await attachDocumentsToClientNeed(processor, {
      dealId: "deal-1",
      clientNeedId: "need-bank",
      documentIds: ["doc-july"],
    });
    expect(blocked.ok).toBe(false);
  });

  it("lets an eligible processor attach", async () => {
    const processor = deps({
      userId: "proc-a",
      role: "processor",
      assignedProcessorId: "proc-a",
    });
    const result = await attachDocumentsToClientNeed(processor, {
      dealId: "deal-1",
      clientNeedId: "need-bank",
      documentIds: ["doc-july"],
    });
    expect(result.ok).toBe(true);
  });

  it("backfills legacy documents.client_need_id values", () => {
    expect(
      backfillDocumentNeedLinks([
        { id: "d1", clientNeedId: "n1" },
        { id: "d2", clientNeedId: null },
        { id: "d3", clientNeedId: "n2" },
      ]),
    ).toEqual([
      { documentId: "d1", clientNeedId: "n1", linkSource: "system" },
      { documentId: "d3", clientNeedId: "n2", linkSource: "system" },
    ]);
  });

  it("clones a Client Need without its documents", async () => {
    const service = deps();
    await attachDocumentsToClientNeed(service, {
      dealId: "deal-1",
      clientNeedId: "need-bank",
      documentIds: ["doc-july"],
    });
    const cloned = await cloneClientNeed(service, {
      dealId: "deal-1",
      clientNeedId: "need-bank",
    });
    expect(cloned.ok).toBe(true);
    if (cloned.ok) {
      expect(cloned.data.status).toBe("missing");
      expect(service.links.filter((link) => link.clientNeedId === cloned.data.id)).toHaveLength(0);
    }
  });

  it("strips provider secrets from link activity metadata", () => {
    expect(
      activityMetadataForRelationTest({
        filename: "july-chase.pdf",
        client_need: "Bank Statements",
        external_file_id: "secret",
        access_url: "https://sandbox.invalid/view/secret",
        token: "tok",
      }),
    ).toEqual({ filename: "july-chase.pdf", client_need: "Bank Statements" });
  });
});
