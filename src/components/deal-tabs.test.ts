import { describe, expect, it } from "vitest";
import { parseDealTab } from "@/components/deal-workspace";

describe("deal tab aliases", () => {
  it("keeps existing tabs", () => {
    expect(parseDealTab("overview")).toBe("overview");
    expect(parseDealTab("tasks")).toBe("tasks");
    expect(parseDealTab("needs")).toBe("needs");
    expect(parseDealTab("documents")).toBe("documents");
    expect(parseDealTab("conditions")).toBe("conditions");
    expect(parseDealTab("submission")).toBe("submission");
    expect(parseDealTab("contacts")).toBe("contacts");
    expect(parseDealTab("activity")).toBe("activity");
  });

  it("maps people and timeline aliases without dropping old links", () => {
    expect(parseDealTab("people")).toBe("contacts");
    expect(parseDealTab("timeline")).toBe("activity");
  });

  it("falls back to overview", () => {
    expect(parseDealTab(undefined)).toBe("overview");
    expect(parseDealTab("unknown")).toBe("overview");
  });
});
