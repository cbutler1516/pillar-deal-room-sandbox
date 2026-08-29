import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { DEMO_REFERENCE_PREFIX, seedDemoDeals, type SeedClient } from "../src/lib/demo/seed";

function loadEnvLocal() {
  const env: Record<string, string> = {};
  const raw = readFileSync(".env.local", "utf8");
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index < 0) continue;
    env[line.slice(0, index)] = line.slice(index + 1).trim();
  }
  return env;
}

function createSeedClient(url: string, serviceRoleKey: string): SeedClient {
  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return {
    async listDemoDealIds() {
      const { data, error } = await supabase
        .from("deals")
        .select("id")
        .like("deal_reference", `${DEMO_REFERENCE_PREFIX}%`);
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => row.id);
    },
    async deleteByDealIds(table, dealIds) {
      const { error } = await supabase.from(table).delete().in("deal_id", dealIds);
      if (error) throw new Error(error.message);
    },
    async deleteDocumentLinksForDealIds(dealIds) {
      const { data, error: listError } = await supabase
        .from("documents")
        .select("id")
        .in("deal_id", dealIds);
      if (listError) throw new Error(listError.message);
      const documentIds = (data ?? []).map((row) => row.id);
      if (documentIds.length === 0) return;
      const { error } = await supabase
        .from("document_client_needs")
        .delete()
        .in("document_id", documentIds);
      if (error) throw new Error(error.message);
    },
    async deleteDeals(ids) {
      const { error } = await supabase.from("deals").delete().in("id", ids);
      if (error) throw new Error(error.message);
    },
    async upsert(table, rows) {
      if (rows.length === 0) return;
      const { error } = await supabase.from(table).upsert(rows);
      if (error) throw new Error(error.message);
    },
  };
}

async function main() {
  const env = { ...process.env, ...loadEnvLocal() };
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const result = await seedDemoDeals(createSeedClient(url, key), env);
  console.log(
    `Seeded ${result.dealCount} demo deals (replaced ${result.replacedDealIds}).`,
  );
  console.log(result.references.join(", "));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Seed failed");
  process.exit(1);
});
