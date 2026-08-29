import { describe, expect, it } from "vitest";
import { assertNoFilePayload } from "@/lib/documents/bytes-guard";

describe("bytes guard", () => {
  it("rejects expanded binary and content keys", () => {
    expect(() => assertNoFilePayload({ uint8array: new Uint8Array([1]) })).toThrow(
      /Raw file bytes/,
    );
    expect(() => assertNoFilePayload({ content: "AAAA" })).toThrow(/Raw file bytes/);
    expect(() => assertNoFilePayload({ document: "AAAA" })).toThrow(/Raw file bytes/);
    expect(() => assertNoFilePayload({ filedata: "AAAA" })).toThrow(/Raw file bytes/);
    expect(() => assertNoFilePayload({ binary: "AAAA" })).toThrow(/Raw file bytes/);
    expect(() => assertNoFilePayload({ dataurl: "data:text/plain;base64,QQ==" })).toThrow(
      /Raw file bytes/,
    );
  });

  it("allows metadata-only session fields", () => {
    expect(() =>
      assertNoFilePayload({
        dealId: "deal-1",
        fileName: "sandbox-test-statement.pdf",
        mimeType: "application/pdf",
        fileSize: 42,
      }),
    ).not.toThrow();
  });
});
