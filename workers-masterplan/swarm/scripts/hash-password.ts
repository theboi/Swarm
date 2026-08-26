import { createPasswordHash } from "../src/server/auth/password.js";

export async function hashPassword(password: string, salt?: string): Promise<string> {
  if (!password) throw new Error("A password is required");
  return createPasswordHash(password, salt);
}

async function readPassword(): Promise<string> {
  if (process.argv[2]) return process.argv[2];
  if (process.stdin.isTTY) {
    throw new Error("Provide the password on standard input; do not place it in shell history");
  }
  let value = "";
  for await (const chunk of process.stdin) value += String(chunk);
  return value.replace(/[\r\n]+$/, "");
}

async function main(): Promise<void> {
  const password = await readPassword();
  process.stdout.write(`${await hashPassword(password)}\n`);
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], "file:").href) {
  void main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : "Unable to create password hash"}\n`);
    process.exitCode = 1;
  });
}
