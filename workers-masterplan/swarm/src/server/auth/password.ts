import { scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

export async function createPasswordHash(password: string, salt: string = crypto.randomUUID()): Promise<string> {
  const digest = await scrypt(password, salt, KEY_LENGTH) as Buffer;
  return `scrypt$16384$8$1$${Buffer.from(salt).toString("base64")}$${digest.toString("base64")}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  try {
    const salt = Buffer.from(parts[4], "base64");
    const expected = Buffer.from(parts[5], "base64");
    if (salt.length === 0 || expected.length !== KEY_LENGTH) return false;
    const actual = await scrypt(password, salt, KEY_LENGTH) as Buffer;
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
