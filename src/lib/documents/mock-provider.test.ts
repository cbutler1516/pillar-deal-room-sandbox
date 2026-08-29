import { describe, expect, it } from "vitest";
import { assertNoFilePayload } from "@/lib/documents/bytes-guard";
import { SandboxMockDocumentProvider } from "@/lib/documents/mock-provider";

describe("sandbox mock provider", () => {
  it("simulates session create, complete, metadata, list, access, and delete", async () => {
    const provider = new SandboxMockDocumentProvider();
    const session = await provider.createUploadSession({
      dealId: "deal-1",
      clientNeedId: "need-1",
      fileName: "w2-test.pdf",
      mimeType: "application/pdf",
    });

    expect(session.provider).toBe("sandbox_mock");
    expect(session.uploadUrl).toMatch(/^https:\/\/sandbox\.invalid\/upload\//);

    const completed = await provider.completeUploadSession({
      sessionId: session.sessionId,
    });
    expect(completed.externalFileId).toMatch(/^sandbox-mock-/);
    expect(completed.fileName).toBe("w2-test.pdf");

    const metadata = await provider.getDocumentMetadata(completed.externalFileId);
    expect(metadata.provider).toBe("sandbox_mock");
    expect(metadata.mimeType).toBe("application/pdf");

    const listed = await provider.listDealDocuments("deal-1");
    expect(listed).toHaveLength(1);

    const access = await provider.getTemporaryAccessUrl(completed.externalFileId);
    expect(access.url).toMatch(/^https:\/\/sandbox\.invalid\/view\//);
    expect(access.simulated).toBe(true);
    expect(access.label).toMatch(/sandbox only/i);

    await provider.deleteDocument(completed.externalFileId);
    expect(await provider.listDealDocuments("deal-1")).toHaveLength(0);
  });

  it("rejects raw file bytes", async () => {
    const provider = new SandboxMockDocumentProvider();
    await expect(
      provider.createUploadSession({
        dealId: "deal-1",
        clientNeedId: "need-1",
        fileName: "w2-test.pdf",
        mimeType: "application/pdf",
        base64: "AAAA",
      } as never),
    ).rejects.toThrow(/Raw file bytes/);

    expect(() =>
      assertNoFilePayload({ file: Buffer.from("not-a-real-file") }),
    ).toThrow(/Raw file bytes/);
  });

  it("treats a fake access URL as expired after TTL", async () => {
    let now = new Date("2026-08-28T18:00:00.000Z");
    const provider = new SandboxMockDocumentProvider(
      () => now,
      15 * 60 * 1000,
      1000,
    );
    const session = await provider.createUploadSession({
      dealId: "deal-1",
      clientNeedId: "need-1",
      fileName: "w2-test.pdf",
      mimeType: "application/pdf",
    });
    const completed = await provider.completeUploadSession({
      sessionId: session.sessionId,
    });
    const access = await provider.getTemporaryAccessUrl(completed.externalFileId);
    expect(provider.isAccessUrlExpired(access.url, now)).toBe(false);

    now = new Date(now.getTime() + 1001);
    expect(provider.isAccessUrlExpired(access.url, now)).toBe(true);
    expect(provider.resolveTemporaryAccess(access.url, now)).toBeNull();
  });
});
