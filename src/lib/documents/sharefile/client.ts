import "server-only";

import {
  getShareFileConfig,
  sharefileApiRoot,
  sharefileTokenUrl,
  type ShareFileConfig,
} from "@/lib/documents/sharefile/config";
import {
  redactShareFileError,
  sharefileRequestFailed,
  ShareFileClientError,
} from "@/lib/documents/sharefile/errors";
import type { SandboxEnv } from "@/lib/sandbox";

export type ShareFileItem = {
  id: string;
  name: string;
  fileName?: string;
  fileSize?: number | null;
  createdAt?: string | null;
};

export type ShareFileUploadSpecification = {
  chunkUri: string;
  method?: string;
};

export type ShareFileDownloadSpecification = {
  downloadUrl: string;
};

export type ShareFileFetch = typeof fetch;

type TokenState = {
  accessToken: string;
  expiresAtMs: number;
  refreshToken: string;
};

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function parseItem(value: unknown): ShareFileItem | null {
  const row = asRecord(value);
  const id = readString(row.Id ?? row.id);
  const name = readString(row.Name ?? row.name ?? row.FileName ?? row.fileName);
  if (!id || !name) {
    return null;
  }
  return {
    id,
    name,
    fileName: readString(row.FileName ?? row.fileName) || name,
    fileSize: readNumber(row.FileSizeBytes ?? row.FileSize ?? row.fileSizeBytes),
    createdAt: readString(row.CreationDate ?? row.creationDate) || null,
  };
}

function parseChildren(value: unknown): ShareFileItem[] {
  const row = asRecord(value);
  const children = Array.isArray(row.value)
    ? row.value
    : Array.isArray(row.Children)
      ? row.Children
      : Array.isArray(row.children)
        ? row.children
        : [];
  return children
    .map((child) => parseItem(child))
    .filter((item): item is ShareFileItem => item != null);
}

export class ShareFileApiClient {
  private token: TokenState | null = null;

  constructor(
    private readonly config: ShareFileConfig,
    private readonly fetchImpl: ShareFileFetch = fetch,
  ) {}

  tokenEndpoint(): string {
    return sharefileTokenUrl(this.config);
  }

  apiRoot(): string {
    return sharefileApiRoot(this.config);
  }

  async getItem(itemId: string): Promise<ShareFileItem> {
    const data = await this.api(
      "GET",
      `/Items(${encodeURIComponent(itemId)})?$select=Id,Name,FileName,FileSizeBytes,CreationDate`,
    );
    const item = parseItem(data);
    if (!item) {
      throw new ShareFileClientError("ShareFile item was not found.");
    }
    return item;
  }

  async listChildren(folderId: string): Promise<ShareFileItem[]> {
    const data = await this.api(
      "GET",
      `/Items(${encodeURIComponent(folderId)})/Children?$select=Id,Name,FileName,FileSizeBytes,CreationDate`,
    );
    return parseChildren(data);
  }

  async findChildByName(folderId: string, name: string): Promise<ShareFileItem | null> {
    const children = await this.listChildren(folderId);
    return (
      children.find((child) => child.name === name || child.fileName === name) ??
      null
    );
  }

  async createFolder(parentId: string, name: string): Promise<ShareFileItem> {
    const existing = await this.findChildByName(parentId, name);
    if (existing) {
      return existing;
    }
    const data = await this.api(
      "POST",
      `/Items(${encodeURIComponent(parentId)})/Folder?overwrite=false`,
      { Name: name },
    );
    const created = parseItem(data);
    if (created) {
      return created;
    }
    const retry = await this.findChildByName(parentId, name);
    if (!retry) {
      throw new ShareFileClientError("ShareFile folder could not be resolved.");
    }
    return retry;
  }

  async createUploadSpecification(input: {
    folderId: string;
    fileName: string;
    fileSize: number;
  }): Promise<ShareFileUploadSpecification> {
    const data = await this.api(
      "POST",
      `/Items(${encodeURIComponent(input.folderId)})/Upload2`,
      {
        Method: "standard",
        Raw: true,
        FileName: input.fileName,
        FileSize: input.fileSize,
      },
    );
    const row = asRecord(data);
    const chunkUri = readString(row.ChunkUri ?? row.chunkUri);
    if (!chunkUri) {
      throw new ShareFileClientError("ShareFile upload specification was incomplete.");
    }
    return {
      chunkUri,
      method: readString(row.Method ?? row.method) || "standard",
    };
  }

  async getDownloadSpecification(itemId: string): Promise<ShareFileDownloadSpecification> {
    const data = await this.api(
      "GET",
      `/Items(${encodeURIComponent(itemId)})/Download?redirect=false`,
    );
    const row = asRecord(data);
    const downloadUrl = readString(row.DownloadUrl ?? row.downloadUrl);
    if (!downloadUrl) {
      throw new ShareFileClientError("ShareFile download specification was incomplete.");
    }
    return { downloadUrl };
  }

  async deleteItem(itemId: string): Promise<void> {
    await this.api("DELETE", `/Items(${encodeURIComponent(itemId)})`);
  }

  async exchangeAuthorizationCode(code: string, redirectUri: string): Promise<void> {
    const response = await this.fetchImpl(this.tokenEndpoint(), {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      }),
    });
    await this.storeTokenResponse(response, this.config.refreshToken);
  }

  private async api(
    method: string,
    path: string,
    body?: Record<string, unknown>,
  ): Promise<unknown> {
    const token = await this.getAccessToken();
    const response = await this.fetchImpl(`${this.apiRoot()}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return this.readJson(response);
  }

  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.token && this.token.expiresAtMs - 60_000 > now) {
      return this.token.accessToken;
    }
    await this.refreshAccessToken();
    if (!this.token) {
      throw new ShareFileClientError("ShareFile authentication failed.");
    }
    return this.token.accessToken;
  }

  private async refreshAccessToken(): Promise<void> {
    const refreshToken = this.token?.refreshToken ?? this.config.refreshToken;
    const response = await this.fetchImpl(this.tokenEndpoint(), {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      }),
    });
    await this.storeTokenResponse(response, refreshToken);
  }

  private async storeTokenResponse(
    response: Response,
    fallbackRefreshToken: string,
  ): Promise<void> {
    let data: Record<string, unknown> = {};
    try {
      data = asRecord(await response.json());
    } catch {
      data = {};
    }

    if (!response.ok) {
      throw sharefileRequestFailed(response.status);
    }

    const accessToken = readString(data.access_token);
    const nextRefresh = readString(data.refresh_token) || fallbackRefreshToken;
    const expiresIn = readNumber(data.expires_in) ?? 3600;
    if (!accessToken) {
      throw new ShareFileClientError("ShareFile authentication failed.");
    }

    this.token = {
      accessToken,
      refreshToken: nextRefresh,
      expiresAtMs: Date.now() + expiresIn * 1000,
    };
  }

  private async readJson(response: Response): Promise<unknown> {
    if (response.status === 204) {
      return {};
    }
    let data: unknown = {};
    try {
      const text = await response.text();
      data = text ? JSON.parse(text) : {};
    } catch {
      data = {};
    }
    if (!response.ok) {
      throw sharefileRequestFailed(response.status);
    }
    return data;
  }
}

export function createShareFileApiClient(
  env: SandboxEnv = process.env,
  fetchImpl: ShareFileFetch = fetch,
): ShareFileApiClient {
  try {
    return new ShareFileApiClient(getShareFileConfig(env), fetchImpl);
  } catch (error) {
    throw redactShareFileError(error);
  }
}
