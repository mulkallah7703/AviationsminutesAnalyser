import { describe, expect, it } from "vitest";
import {
  adminPasswordIsSet,
  loginUser,
  registerUser,
  setAdminPassword,
  verifyAdminPassword,
} from "@/lib/auth/accounts";
import { useTempDataDir } from "@/test/temp-data";

describe("local accounts", () => {
  useTempDataDir();

  it("sets the admin password once and checks it", () => {
    expect(adminPasswordIsSet()).toBe(false);
    expect(setAdminPassword("short").ok).toBe(false);
    expect(setAdminPassword("correct-horse").ok).toBe(true);
    expect(adminPasswordIsSet()).toBe(true);
    expect(setAdminPassword("another-password").ok).toBe(false);
    expect(verifyAdminPassword("correct-horse")).toBe(true);
    expect(verifyAdminPassword("wrong-password")).toBe(false);
  });

  it("keeps two end users separate", () => {
    expect(registerUser("ليان", "password-1").ok).toBe(true);
    expect(registerUser("ليان", "password-2").ok).toBe(false);
    const second = registerUser("سامي", "password-2");
    expect(second.ok).toBe(true);
    expect(loginUser("سامي", "password-2").ok).toBe(true);
    expect(loginUser("سامي", "password-1").ok).toBe(false);
  });
});