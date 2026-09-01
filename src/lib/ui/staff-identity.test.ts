import { describe, expect, it } from "vitest";
import {
  staffAvatarToneIndex,
  staffInitials,
} from "@/lib/ui/staff-identity";

describe("staff identity", () => {
  it("builds initials from the first and last name", () => {
    expect(staffInitials("Chris Butler")).toBe("CB");
    expect(staffInitials("Alex")).toBe("AL");
    expect(staffInitials("  Sam Rivera Jr  ")).toBe("SJ");
    expect(staffInitials("")).toBe("?");
    expect(staffInitials(null)).toBe("?");
  });

  it("picks a deterministic fallback tone from the same seed", () => {
    const first = staffAvatarToneIndex("Chris Butler");
    expect(staffAvatarToneIndex("Chris Butler")).toBe(first);
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThan(4);
  });
});
