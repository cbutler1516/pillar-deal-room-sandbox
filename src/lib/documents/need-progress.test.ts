import { describe, expect, it } from "vitest";
import {
  filterDocumentsForInbox,
  filterDocumentsForWorkspace,
  nextNeedStatusAfterDetach,
  nextNeedStatusAfterDocumentsAdded,
  summarizeNeedDocuments,
} from "@/lib/documents/need-progress";

describe("Client Need document progress", () => {
  it("describes a bank-statement-style 2-document need", () => {
    const progress = summarizeNeedDocuments(
      [
        { id: "july", status: "approved" },
        { id: "august", status: "needs_review" },
      ],
      2,
    );
    expect(progress.receivedLabel).toBe("2 of 2 received");
    expect(progress.reviewLabel).toBe("1 approved, 1 needs review");
    expect(progress.remainingCount).toBe(0);
  });

  it("describes a pay-stub-style 3-document need without treating it as approved", () => {
    const progress = summarizeNeedDocuments(
      [
        { id: "s1", status: "received" },
        { id: "s2", status: "received" },
        { id: "s3", status: "received" },
      ],
      3,
    );
    expect(progress.receivedLabel).toBe("3 of 3 received");
    expect(progress.approvedCount).toBe(0);
  });

  it("works when expected count is unknown", () => {
    expect(
      summarizeNeedDocuments([
        { id: "a", status: "received" },
        { id: "b", status: "received" },
        { id: "c", status: "received" },
      ]).receivedLabel,
    ).toBe("3 documents received");
  });

  it("does not auto-approve a need when the first document arrives", () => {
    expect(
      nextNeedStatusAfterDocumentsAdded("missing", [{ id: "d1", status: "received" }]),
    ).toBe("received");
    expect(
      nextNeedStatusAfterDocumentsAdded("requested", [{ id: "d1", status: "received" }]),
    ).toBe("received");
    expect(
      nextNeedStatusAfterDocumentsAdded("approved", [{ id: "d1", status: "received" }]),
    ).toBeNull();
    expect(
      nextNeedStatusAfterDocumentsAdded("rejected", [{ id: "d1", status: "received" }]),
    ).toBeNull();
    expect(
      nextNeedStatusAfterDocumentsAdded("waived", [{ id: "d1", status: "received" }]),
    ).toBeNull();
  });

  it("moves a received need to needs_review when a linked document still needs review", () => {
    expect(
      nextNeedStatusAfterDocumentsAdded("received", [
        { id: "july", status: "approved" },
        { id: "august", status: "needs_review" },
      ]),
    ).toBe("needs_review");
  });

  it("does not mark a need missing after detach", () => {
    expect(nextNeedStatusAfterDetach("received")).toBe("needs_review");
    expect(nextNeedStatusAfterDetach("approved")).toBe("needs_review");
    expect(nextNeedStatusAfterDetach("missing")).toBeNull();
    expect(nextNeedStatusAfterDetach("waived")).toBeNull();
  });

  it("filters unlinked documents in the workspace", () => {
    const docs = [
      { id: "1", status: "received", linkedNeedIds: [] },
      { id: "2", status: "approved", linkedNeedIds: ["need-1"] },
      { id: "3", status: "needs_review", linkedNeedIds: ["need-1"] },
      { id: "4", status: "rejected", linkedNeedIds: ["need-2"] },
    ];
    expect(filterDocumentsForWorkspace(docs, "unlinked").map((doc) => doc.id)).toEqual(["1"]);
    expect(filterDocumentsForWorkspace(docs, "approved").map((doc) => doc.id)).toEqual(["2"]);
    expect(filterDocumentsForWorkspace(docs, "needs_review").map((doc) => doc.id)).toEqual(["3"]);
    expect(filterDocumentsForWorkspace(docs, "rejected").map((doc) => doc.id)).toEqual(["4"]);
  });

  it("filters the documents inbox without dropping unlinked or rejected work", () => {
    const docs = [
      { id: "1", status: "received", linkedNeedIds: [] },
      { id: "2", status: "approved", linkedNeedIds: ["need-1"] },
      { id: "3", status: "needs_review", linkedNeedIds: ["need-1"] },
      { id: "4", status: "rejected", linkedNeedIds: ["need-2"] },
    ];
    expect(filterDocumentsForInbox(docs, "needs_review").map((doc) => doc.id)).toEqual([
      "1",
      "3",
    ]);
    expect(filterDocumentsForInbox(docs, "complete").map((doc) => doc.id)).toEqual(["2"]);
    expect(
      filterDocumentsForInbox(docs, "issues", new Set(["1"])).map((doc) => doc.id),
    ).toEqual(["1", "4"]);
    expect(filterDocumentsForInbox(docs, "all").map((doc) => doc.id)).toEqual([
      "1",
      "2",
      "3",
      "4",
    ]);
  });
});
