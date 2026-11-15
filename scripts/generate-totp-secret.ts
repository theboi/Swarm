import { randomBytes } from "node:crypto";

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const DEFAULT_ISSUER = "EdenMind Swarm";

function encodeBase32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let encoded = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      encoded += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) encoded += BASE32[(value << (5 - bits)) & 31];
  return encoded;
}

export function generateTotpSecret(bytes: Uint8Array = randomBytes(20)): string {
  if (bytes.length === 0) throw new Error("TOTP entropy must not be empty");
  return encodeBase32(bytes);
}

export function createTotpProvisioningUri(options: { secret: string; accountName: string; issuer?: string }): string {
  const issuer = options.issuer ?? DEFAULT_ISSUER;
  if (!/^[A-Z2-7]+$/.test(options.secret)) throw new Error("TOTP secret must be unpadded base32");
  if (!options.accountName.trim()) throw new Error("An account name is required");
  const label = `${issuer}:${options.accountName}`;
  const query = new URLSearchParams({
    secret: options.secret,
    issuer,
    algorithm: "SHA1",
    digits: "6",
    period: "30",
  });
  return `otpauth://totp/${encodeURIComponent(label)}?${query.toString()}`;
}

function main(): void {
  const accountName = process.argv[2] ?? process.env.SWARM_LOGIN_EMAIL;
  if (!accountName) throw new Error("Set SWARM_LOGIN_EMAIL or provide the coordinator email as the first argument");
  const secret = generateTotpSecret();
  process.stdout.write(`SWARM_TOTP_SECRET=${secret}\n`);
  process.stdout.write(`${createTotpProvisioningUri({ secret, accountName })}\n`);
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], "file:").href) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : "Unable to generate TOTP provisioning data"}\n`);
    process.exitCode = 1;
  }
}
