import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const SRC_ROOT = join(process.cwd(), "src");

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, files);
    } else if (/\.(ts|tsx|js|mjs)$/.test(entry) && !entry.endsWith(".test.ts")) {
      files.push(full);
    }
  }
  return files;
}

describe("source security guards", () => {
  const files = walk(SRC_ROOT).map((file) => ({
    file,
    rel: relative(SRC_ROOT, file).replaceAll("\\", "/"),
    source: readFileSync(file, "utf8"),
  }));

  it("keeps the service role key in the narrow admin helper only", () => {
    const hits = files.filter(({ source }) =>
      source.includes("SUPABASE_SERVICE_ROLE_KEY"),
    );
    expect(hits.map((hit) => hit.rel)).toEqual(["lib/supabase/admin.ts"]);
    const admin = hits[0];
    expect(admin.source).toContain("import \"server-only\"");
  });

  it("does not create a browser client with a service-role key", () => {
    const client = files.find((file) => file.rel === "lib/supabase/client.ts");
    expect(client).toBeDefined();
    expect(client?.source).toContain("createBrowserClient");
    expect(client?.source).toContain("getSupabaseAnonKey");
    expect(client?.source).not.toMatch(/service/i);
  });

  it("does not include public sign-up", () => {
    const signup = files.filter(
      ({ source }) =>
        source.includes("signUp") || source.includes("/register"),
    );
    expect(signup.map((hit) => hit.rel)).toEqual([]);
  });

  it("does not hardcode production integration hosts", () => {
    const blocked = [
      "api.hubapi.com",
      "app.hubspot.com",
      "arive.com",
      "api.sendgrid.com",
    ];
    const hits = files.filter(({ source }) =>
      blocked.some((host) => source.includes(host)),
    );
    expect(hits.map((hit) => hit.rel)).toEqual([]);
  });

  it("does not use Supabase Storage", () => {
    const hits = files.filter(
      ({ source }) =>
        source.includes("supabase.storage") ||
        source.includes(".storage.from(") ||
        source.includes("@supabase/storage-js"),
    );
    expect(hits.map((hit) => hit.rel)).toEqual([]);
  });

  it("does not expose a browser file input that can send bytes", () => {
    const hits = files.filter(({ source }) =>
      /type\s*=\s*["']file["']/.test(source),
    );
    expect(hits.map((hit) => hit.rel)).toEqual([]);
  });
});
