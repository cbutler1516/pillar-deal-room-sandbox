import { describe, expect, it } from "vitest";
import {
  decideAccess,
  getPostAuthPath,
  getRootRedirectPath,
  isProtectedPath,
  unauthorizedLoginHref,
} from "@/lib/auth/authorization";

const profile = {
  id: "user-1",
  email: "admin@example.com",
  fullName: "Ada Admin",
  role: "admin",
  isActive: true,
};

describe("protected routes", () => {
  it("treats internal app routes as protected", () => {
    expect(isProtectedPath("/dashboard")).toBe(true);
    expect(isProtectedPath("/deals")).toBe(true);
    expect(isProtectedPath("/deals/abc")).toBe(true);
    expect(isProtectedPath("/processor-queue")).toBe(true);
    expect(isProtectedPath("/tasks")).toBe(true);
  });

  it("does not treat login as protected", () => {
    expect(isProtectedPath("/login")).toBe(false);
    expect(isProtectedPath("/")).toBe(false);
  });
});

describe("decideAccess", () => {
  it("requires authentication first", () => {
    expect(decideAccess({ authUserId: null, profile })).toEqual({
      status: "unauthenticated",
    });
  });

  it("authorizes a matching active profile", () => {
    const decision = decideAccess({ authUserId: "user-1", profile });
    expect(decision.status).toBe("authorized");
    if (decision.status === "authorized") {
      expect(decision.profile.role).toBe("admin");
      expect(decision.profile.email).toBe("admin@example.com");
    }
  });

  it("denies an authenticated user without a public profile", () => {
    expect(decideAccess({ authUserId: "user-1", profile: null })).toEqual({
      status: "denied",
      reason: "missing_profile",
    });
  });

  it("denies an inactive profile", () => {
    expect(
      decideAccess({
        authUserId: "user-1",
        profile: { ...profile, isActive: false },
      }),
    ).toEqual({
      status: "denied",
      reason: "inactive",
    });
  });

  it("does not infer a role from email and rejects mismatched ids", () => {
    expect(
      decideAccess({
        authUserId: "other-user",
        profile,
      }),
    ).toEqual({
      status: "denied",
      reason: "missing_profile",
    });
  });
});

describe("redirects", () => {
  it("sends unauthenticated users from root to login", () => {
    expect(getRootRedirectPath({ status: "unauthenticated" })).toBe("/login");
  });

  it("sends authorized users from root to dashboard", () => {
    const decision = decideAccess({ authUserId: "user-1", profile });
    expect(getRootRedirectPath(decision)).toBe("/dashboard");
    expect(getPostAuthPath(decision)).toBe("/dashboard");
  });

  it("sends denied users to login after sign-out", () => {
    expect(unauthorizedLoginHref("denied")).toBe("/login?error=unauthorized");
    expect(getPostAuthPath({ status: "denied", reason: "inactive" })).toBe(
      "/login",
    );
  });

  it("uses login as the post-logout destination", () => {
    expect(getPostAuthPath({ status: "unauthenticated" })).toBe("/login");
  });
});
