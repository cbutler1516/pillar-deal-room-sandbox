import { describe, expect, it } from "vitest";
import { isSupabaseUrlConfigured } from "@/lib/supabase/env";

describe("supabase env", () => {
  it("rejects a non-URL supabase project value", () => {
    const previous = process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";
    expect(isSupabaseUrlConfigured()).toBe(false);
    process.env.NEXT_PUBLIC_SUPABASE_URL = previous;
  });

  it("accepts an https project URL", () => {
    const previous = process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    expect(isSupabaseUrlConfigured()).toBe(true);
    process.env.NEXT_PUBLIC_SUPABASE_URL = previous;
  });
});
