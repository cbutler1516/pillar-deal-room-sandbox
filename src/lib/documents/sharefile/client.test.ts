import { describe, expect, it } from "vitest";
import { ShareFileApiClient } from "@/lib/documents/sharefile/client";
import { buildShareFileAuthorizeUrl, type ShareFileConfig } from "@/lib/documents/sharefile/config";

const config: ShareFileConfig = {
  clientId: "sf-client",
  clientSecret: "sf-secret",
  refreshToken: "sf-refresh",
  subdomain: "pillar",
  apiControlPlane: "sharefile.com",
  rootFolderId: "root-1",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("ShareFile API client", () => {
  it("uses authorization-code and refresh-token grants, never password", async () => {
    const bodies: string[] = [];
    const client = new ShareFileApiClient(config, async (input, init) => {
      const url = String(input);
      bodies.push(String(init?.body ?? ""));
      if (url.includes("/oauth/token")) {
        return json({
          access_token: "access-1",
          refresh_token: "sf-refresh-2",
          expires_in: 3600,
        });
      }
      if (url.includes("/Children")) {
        return json({ value: [{ Id: "deal-folder", Name: "PDR-SBX-001" }] });
      }
      return json({ Id: "item-1", Name: "PDR-SBX-001" });
    });

    await client.createFolder("root-1", "PDR-SBX-001");
    expect(bodies[0]).toContain("grant_type=refresh_token");
    expect(bodies.join("\n")).not.toContain("grant_type=password");
    expect(bodies.join("\n")).not.toContain("username=");

    const authorize = buildShareFileAuthorizeUrl(
      config,
      "https://localhost:3000/oauth/sharefile",
      "state-1",
    );
    expect(authorize).toContain("response_type=code");
    expect(authorize).not.toContain("password");
  });

  it("does not create a duplicate folder when the name already exists", async () => {
    const methods: string[] = [];
    const client = new ShareFileApiClient(config, async (input, init) => {
      const url = String(input);
      methods.push(`${init?.method ?? "GET"} ${url}`);
      if (url.includes("/oauth/token")) {
        return json({ access_token: "access-1", expires_in: 3600 });
      }
      if (url.includes("/Children")) {
        return json({
          value: [{ Id: "existing-deal", Name: "PDR-SBX-001" }],
        });
      }
      throw new Error("unexpected create");
    });

    const first = await client.createFolder("root-1", "PDR-SBX-001");
    const second = await client.createFolder("root-1", "PDR-SBX-001");
    expect(first.id).toBe("existing-deal");
    expect(second.id).toBe("existing-deal");
    expect(methods.some((row) => row.startsWith("POST") && row.includes("/Folder"))).toBe(
      false,
    );
  });

  it("returns a ChunkUri upload specification and a download URL", async () => {
    const client = new ShareFileApiClient(config, async (input) => {
      const url = String(input);
      if (url.includes("/oauth/token")) {
        return json({ access_token: "access-1", expires_in: 3600 });
      }
      if (url.includes("/Upload2")) {
        return json({ ChunkUri: "https://storage.example/upload?sig=1", Method: "standard" });
      }
      if (url.includes("/Download")) {
        return json({ DownloadUrl: "https://storage.example/view?sig=2" });
      }
      return json({});
    });

    const upload = await client.createUploadSpecification({
      folderId: "folder-1",
      fileName: "sandbox-test-statement.pdf",
      fileSize: 42,
    });
    expect(upload.chunkUri).toBe("https://storage.example/upload?sig=1");

    const download = await client.getDownloadSpecification("file-1");
    expect(download.downloadUrl).toBe("https://storage.example/view?sig=2");
  });

  it("normalizes errors without embedding token responses", async () => {
    const client = new ShareFileApiClient(config, async () =>
      json({ error: "invalid_grant", access_token: "must-not-leak" }, 400),
    );
    await expect(client.getItem("file-1")).rejects.toThrow(/ShareFile request failed \(400\)/);
    await expect(client.getItem("file-1")).rejects.not.toThrow(/must-not-leak/);
  });
});
