import { describe, expect, it } from "vitest";
import { ShareFileDocumentProvider } from "@/lib/documents/sharefile-provider";
import type { ShareFileApiClient, ShareFileItem } from "@/lib/documents/sharefile/client";

function item(id: string, name: string): ShareFileItem {
  return { id, name, fileName: name, fileSize: 42, createdAt: "2026-08-29T00:00:00.000Z" };
}

function fakeClient(input?: {
  children?: Record<string, ShareFileItem[]>;
  created?: string[];
}): ShareFileApiClient {
  const children = input?.children ?? {};
  const created = input?.created ?? [];
  return {
    async createFolder(parentId: string, name: string) {
      const existing = (children[parentId] ?? []).find((row) => row.name === name);
      if (existing) {
        return existing;
      }
      created.push(`${parentId}:${name}`);
      const next = item(`${parentId}-${name}`, name);
      children[parentId] = [...(children[parentId] ?? []), next];
      return next;
    },
    async createUploadSpecification({
      folderId,
      fileName,
    }: {
      folderId: string;
      fileName: string;
    }) {
      return {
        chunkUri: `https://storage.example/upload/${folderId}/${fileName}`,
        method: "standard",
      };
    },
    async findChildByName(folderId: string, name: string) {
      return (children[folderId] ?? []).find((row) => row.name === name) ?? null;
    },
    async getItem(itemId: string) {
      return item(itemId, "sandbox-test-statement.pdf");
    },
    async getDownloadSpecification(itemId: string) {
      return { downloadUrl: `https://storage.example/view/${itemId}` };
    },
    async deleteItem() {},
    async listChildren(folderId: string) {
      return children[folderId] ?? [];
    },
    async exchangeAuthorizationCode() {},
    tokenEndpoint() {
      return "https://pillar.sharefile.com/oauth/token";
    },
    apiRoot() {
      return "https://pillar.sf-api.com/sf/v3";
    },
  } as unknown as ShareFileApiClient;
}

describe("ShareFile document provider", () => {
  it("creates an upload session against an idempotent deal folder", async () => {
    const created: string[] = [];
    const client = fakeClient({
      children: {
        "root-1": [item("deal-1", "PDR-SBX-001")],
        "deal-1": [item("needs-1", "Client Needs")],
      },
      created,
    });
    const provider = new ShareFileDocumentProvider(client, "root-1");

    const first = await provider.createUploadSession({
      dealId: "deal-uuid",
      dealReference: "PDR-SBX-001",
      clientNeedId: "need-1",
      fileName: "sandbox-test-statement.pdf",
      mimeType: "application/pdf",
      fileSize: 42,
    });
    const second = await provider.createUploadSession({
      dealId: "deal-uuid",
      dealReference: "PDR-SBX-001",
      clientNeedId: "need-1",
      fileName: "sandbox-test-statement-2.pdf",
      mimeType: "application/pdf",
      fileSize: 42,
    });

    expect(first.provider).toBe("sharefile");
    expect(first.uploadUrl).toContain("/needs-1/");
    expect(first.rawBody).toBe(true);
    expect(second.uploadUrl).toContain("/needs-1/");
    expect(created).toEqual([]);
  });

  it("completes with the ShareFile item id as the external reference", async () => {
    const client = fakeClient({
      children: {
        "root-1": [item("deal-1", "PDR-SBX-001")],
        "deal-1": [item("misc-1", "Miscellaneous")],
        "misc-1": [item("sf-file-99", "sandbox-test-statement.pdf")],
      },
    });
    const provider = new ShareFileDocumentProvider(client, "root-1");
    const session = await provider.createUploadSession({
      dealId: "deal-uuid",
      dealReference: "PDR-SBX-001",
      fileName: "sandbox-test-statement.pdf",
      mimeType: "application/pdf",
      fileSize: 42,
    });
    const completed = await provider.completeUploadSession({
      sessionId: session.sessionId,
    });
    expect(completed.externalFileId).toBe("sf-file-99");
    expect(completed.provider).toBe("sharefile");
    expect(completed.dealId).toBe("deal-uuid");
  });

  it("rejects raw file payloads", async () => {
    const provider = new ShareFileDocumentProvider(fakeClient(), "root-1");
    await expect(
      provider.createUploadSession({
        dealId: "deal-uuid",
        dealReference: "PDR-SBX-001",
        fileName: "sandbox-test-statement.pdf",
        mimeType: "application/pdf",
        fileSize: 42,
        content: "AAAA",
      } as never),
    ).rejects.toThrow(/Raw file bytes/);
  });

  it("issues a non-simulated temporary access URL", async () => {
    const provider = new ShareFileDocumentProvider(fakeClient(), "root-1");
    const access = await provider.getTemporaryAccessUrl("sf-file-99");
    expect(access.simulated).toBe(false);
    expect(access.url).toContain("/view/sf-file-99");
  });
});
