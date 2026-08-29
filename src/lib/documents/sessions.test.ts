import { describe, expect, it } from "vitest";
import { authorizeDocumentIntake, canUseDocumentIntake } from "@/lib/documents/authorization";
import { SandboxMockDocumentProvider } from "@/lib/documents/mock-provider";
import {
  activityMetadataForTest,
  completeDocumentUploadSession,
  createDocumentUploadSession,
  requestTemporaryDocumentAccess,
  type DocumentIntakeStore,
  type SessionServiceDeps,
} from "@/lib/documents/sessions";

const env = {
  SANDBOX_MODE: "true",
  PRODUCTION_INTEGRATIONS_ENABLED: "false",
  DOCUMENT_STORAGE_PROVIDER: "sandbox_mock",
};

function createMemoryStore(input?: {
  assignedProcessorId?: string | null;
  needStatus?: string;
}): {
  store: DocumentIntakeStore;
  inserted: Record<string, unknown>[];
  links: { documentId: string; clientNeedId: string }[];
} {
  const deal = {
    id: "deal-1",
    assignedProcessorId: input?.assignedProcessorId ?? null,
    dealReference: "PDR-SBX-001",
  };
  const need = {
    id: "need-1",
    dealId: "deal-1",
    status: input?.needStatus ?? "requested",
    documentType: "Bank Statements",
  };
  const documents = new Map<
    string,
    {
      id: string;
      dealId: string;
      fileName: string;
      externalFileId: string | null;
      storageProvider: string | null;
    }
  >();
  const inserted: Record<string, unknown>[] = [];
  const links: { documentId: string; clientNeedId: string }[] = [];

  const store: DocumentIntakeStore = {
    async getDeal(dealId) {
      return dealId === deal.id ? deal : null;
    },
    async getNeed(needId) {
      return needId === need.id ? { ...need } : null;
    },
    async insertDocument(row) {
      inserted.push(row);
      const id = `doc-${inserted.length}`;
      documents.set(id, {
        id,
        dealId: row.dealId,
        fileName: row.fileName,
        externalFileId: row.externalFileId,
        storageProvider: row.storageProvider,
      });
      return { id };
    },
    async linkDocument(input) {
      links.push({ documentId: input.documentId, clientNeedId: input.clientNeedId });
    },
    async listNeedDocuments(needId) {
      return links
        .filter((link) => link.clientNeedId === needId)
        .map((link) => ({ id: link.documentId, status: "received" }));
    },
    async updateNeedStatus(needId, status) {
      if (needId === need.id) {
        need.status = status;
      }
    },
    async getDocument(documentId) {
      return documents.get(documentId) ?? null;
    },
  };

  return { store, inserted, links };
}

function deps(options?: {
  userId?: string | null;
  role?: "admin" | "processor" | "loan_officer" | null;
  assignedProcessorId?: string | null;
  needStatus?: string;
  provider?: SandboxMockDocumentProvider;
  evaluation?: boolean;
}): SessionServiceDeps & {
  inserted: Record<string, unknown>[];
  links: { documentId: string; clientNeedId: string }[];
  events: { eventType: string; metadata?: Record<string, unknown> }[];
} {
  const memory = createMemoryStore({
    assignedProcessorId: options?.assignedProcessorId ?? null,
    needStatus: options?.needStatus,
  });
  const events: { eventType: string; metadata?: Record<string, unknown> }[] = [];
  return {
    actor: {
      userId: options?.userId === undefined ? "user-admin" : options.userId,
      role: options?.role === undefined ? "admin" : options.role,
    },
    store: memory.store,
    provider: options?.provider ?? new SandboxMockDocumentProvider(),
    env,
    evaluation: options?.evaluation,
    inserted: memory.inserted,
    links: memory.links,
    events,
    async logActivity(event) {
      events.push(event);
    },
  };
}

describe("document intake authorization", () => {
  it("blocks unauthenticated users from creating a session", async () => {
    expect(
      authorizeDocumentIntake({
        userId: null,
        role: null,
        assignedProcessorId: null,
      }),
    ).toBe("unauthenticated");

    const service = deps({ userId: null, role: null });
    const result = await createDocumentUploadSession(service, {
      dealId: "deal-1",
      clientNeedId: "need-1",
      fileName: "w2-test.pdf",
      mimeType: "application/pdf",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/Sign in/i);
    }
  });

  it("does not let a loan officer use document intake", async () => {
    expect(canUseDocumentIntake(null, "lo-1", "loan_officer")).toBe(false);
    const service = deps({ userId: "lo-1", role: "loan_officer" });
    const result = await createDocumentUploadSession(service, {
      dealId: "deal-1",
      clientNeedId: "need-1",
      fileName: "w2-test.pdf",
      mimeType: "application/pdf",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/Loan officers/i);
    }
  });

  it("lets a processor use intake only on an eligible deal", async () => {
    expect(canUseDocumentIntake(null, "proc-a", "processor")).toBe(true);
    expect(canUseDocumentIntake("proc-a", "proc-a", "processor")).toBe(true);
    expect(canUseDocumentIntake("proc-b", "proc-a", "processor")).toBe(false);

    const eligible = deps({
      userId: "proc-a",
      role: "processor",
      assignedProcessorId: null,
    });
    const allowed = await createDocumentUploadSession(eligible, {
      dealId: "deal-1",
      clientNeedId: "need-1",
      fileName: "w2-test.pdf",
      mimeType: "application/pdf",
    });
    expect(allowed.ok).toBe(true);

    const ineligible = deps({
      userId: "proc-a",
      role: "processor",
      assignedProcessorId: "proc-b",
    });
    const denied = await createDocumentUploadSession(ineligible, {
      dealId: "deal-1",
      clientNeedId: "need-1",
      fileName: "w2-test.pdf",
      mimeType: "application/pdf",
    });
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.error).toMatch(/assigned to them/i);
    }
  });

  it("lets an evaluation portal upload after the deal exists", async () => {
    const service = deps({ userId: null, role: null, evaluation: true });
    const created = await createDocumentUploadSession(service, {
      dealId: "deal-1",
      clientNeedId: "need-1",
      fileName: "sandbox-test-lease.pdf",
      mimeType: "application/pdf",
      fileSize: 42,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const completed = await completeDocumentUploadSession(service, {
      sessionId: created.data.sessionId,
      dealId: "deal-1",
    });
    expect(completed.ok).toBe(true);
    if (!completed.ok) {
      return;
    }
    expect(completed.data.document.storageProvider).toBe("sandbox_mock");
    expect(completed.data.document).not.toHaveProperty("bytes");
    expect(service.inserted[0]).not.toHaveProperty("bytes");
    expect(service.inserted[0]).not.toHaveProperty("base64");
  });
});

describe("upload-session flow", () => {
  it("creates a safe session and completes metadata-only document creation", async () => {
    const provider = new SandboxMockDocumentProvider();
    const service = deps({ provider });
    const created = await createDocumentUploadSession(service, {
      dealId: "deal-1",
      clientNeedId: "need-1",
      fileName: "bank-statements-sandbox.pdf",
      mimeType: "application/pdf",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    expect(created.data.simulated).toBe(true);
    expect(created.data.uploadUrl).toMatch(/^https:\/\/sandbox\.invalid\/upload\//);
    expect(created.data).not.toHaveProperty("externalFileId");

    const completed = await completeDocumentUploadSession(service, {
      sessionId: created.data.sessionId,
      dealId: "deal-1",
    });
    expect(completed.ok).toBe(true);
    if (!completed.ok) {
      return;
    }
    expect(completed.data.needUpdated).toBe(true);
    expect(completed.data.document.status).toBe("received");
    expect(completed.data.document.storageProvider).toBe("sandbox_mock");
    expect(completed.data.document).not.toHaveProperty("base64");
    expect(completed.data.document).not.toHaveProperty("bytes");
    expect(completed.data.document).not.toHaveProperty("content");

    expect(service.inserted).toHaveLength(1);
    expect(service.inserted[0]).toMatchObject({
      dealId: "deal-1",
      fileName: "bank-statements-sandbox.pdf",
      documentType: "Bank Statements",
      storageProvider: "sandbox_mock",
      mimeType: "application/pdf",
      status: "received",
    });
    expect(service.inserted[0]).not.toHaveProperty("clientNeedId");
    expect(service.inserted[0]).toHaveProperty("externalFileId");
    expect(service.inserted[0]).not.toHaveProperty("bytes");
    expect(service.inserted[0]).not.toHaveProperty("base64");
    expect(service.inserted[0]).not.toHaveProperty("content");
    expect(service.links).toEqual([
      { documentId: completed.data.document.id, clientNeedId: "need-1" },
    ]);
    expect(service.inserted[0]).not.toHaveProperty("client_need_id");
  });

  it("does not accept raw file bytes on create or complete", async () => {
    const service = deps();
    await expect(
      createDocumentUploadSession(service, {
        dealId: "deal-1",
        clientNeedId: "need-1",
        fileName: "w2-test.pdf",
        mimeType: "application/pdf",
        file: "pretend-bytes",
      } as never),
    ).rejects.toThrow(/Raw file bytes/);

    await expect(
      completeDocumentUploadSession(service, {
        sessionId: "sess_x",
        dealId: "deal-1",
        base64: "AAAA",
      } as never),
    ).rejects.toThrow(/Raw file bytes/);
  });

  it("does not downgrade a reviewed client need to received", async () => {
    const provider = new SandboxMockDocumentProvider();
    const service = deps({ provider, needStatus: "approved" });
    const created = await createDocumentUploadSession(service, {
      dealId: "deal-1",
      clientNeedId: "need-1",
      fileName: "entity-docs.pdf",
      mimeType: "application/pdf",
    });
    if (!created.ok) {
      throw new Error(created.error);
    }
    const completed = await completeDocumentUploadSession(service, {
      sessionId: created.data.sessionId,
      dealId: "deal-1",
    });
    if (!completed.ok) {
      throw new Error(completed.error);
    }
    expect(completed.data.needUpdated).toBe(false);
  });

  it("issues simulated temporary access after authorization", async () => {
    const provider = new SandboxMockDocumentProvider(
      () => new Date("2026-08-28T18:00:00.000Z"),
      15 * 60 * 1000,
      60_000,
    );
    const service = deps({ provider });
    const created = await createDocumentUploadSession(service, {
      dealId: "deal-1",
      clientNeedId: "need-1",
      fileName: "w2-test.pdf",
      mimeType: "application/pdf",
    });
    if (!created.ok) {
      throw new Error(created.error);
    }
    const completed = await completeDocumentUploadSession(service, {
      sessionId: created.data.sessionId,
      dealId: "deal-1",
    });
    if (!completed.ok) {
      throw new Error(completed.error);
    }
    const access = await requestTemporaryDocumentAccess(service, {
      documentId: completed.data.document.id,
      dealId: "deal-1",
    });
    expect(access.ok).toBe(true);
    if (!access.ok) {
      return;
    }
    expect(access.data.simulated).toBe(true);
    expect(access.data.url).toMatch(/^https:\/\/sandbox\.invalid\/view\//);
    expect(access.data.expiresAt).toBe("2026-08-28T18:01:00.000Z");
  });
});

describe("activity metadata exclusions", () => {
  it("strips provider secrets, tokens, and access URLs", () => {
    const safe = activityMetadataForTest({
      filename: "w2-test.pdf",
      simulated: "true",
      token: "sess_secret",
      upload_token: "upload-secret",
      access_url: "https://sandbox.invalid/view/secret",
      upload_url: "https://sandbox.invalid/upload/secret",
      external_file_id: "sandbox-mock-1",
      storage_provider: "sandbox_mock",
      provider_secret: "key",
    });
    expect(safe).toEqual({ filename: "w2-test.pdf", simulated: "true" });
  });

  it("does not persist secrets from intake activity events", async () => {
    const service = deps();
    const created = await createDocumentUploadSession(service, {
      dealId: "deal-1",
      clientNeedId: "need-1",
      fileName: "w2-test.pdf",
      mimeType: "application/pdf",
    });
    expect(created.ok).toBe(true);
    const sanitized = activityMetadataForTest(service.events[0]?.metadata ?? {});
    expect(sanitized).not.toHaveProperty("token");
    expect(sanitized).not.toHaveProperty("upload_url");
    expect(sanitized).not.toHaveProperty("external_file_id");
    expect(sanitized.filename).toBe("w2-test.pdf");
  });
});
