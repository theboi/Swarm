import { describe, expect, it } from "vitest";

import { verifyPassword } from "../../src/server/auth/password.js";
import { hashPassword } from "../../scripts/hash-password.js";

describe("operator tools", () => {
  it("creates a scrypt value that the coordinator can verify", async () => {
    const storedHash = await hashPassword("correct horse battery staple", "fixed-test-salt");

    expect(storedHash).toMatch(/^scrypt\$16384\$8\$1\$[^$]+\$[^$]+$/);
    await expect(verifyPassword("correct horse battery staple", storedHash)).resolves.toBe(true);
    await expect(verifyPassword("wrong password", storedHash)).resolves.toBe(false);
  });
});
