import { createHmac } from "node:crypto";

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function decodeBase32(input: string): Buffer {
  const clean = input.replace(/[\s=]/g, "").toUpperCase();
  let bits = "";
  for (const character of clean) {
    const value = BASE32.indexOf(character);
    if (value < 0) throw new Error("Invalid TOTP secret");
    bits += value.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  return Buffer.from(bytes);
}

export function totpAt(secret: string, epochMs: number): string {
  const counter = Math.floor(epochMs / 30_000);
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", decodeBase32(secret)).update(message).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const value = ((digest[offset] & 0x7f) << 24) | (digest[offset + 1] << 16) | (digest[offset + 2] << 8) | digest[offset + 3];
  return String(value % 1_000_000).padStart(6, "0");
}

interface TotpPersistence { usedTotp?: Record<string, true> }

export function createTotpVerifier(secret: string, options: { persistence?: TotpPersistence; persist?: () => Promise<void> } = {}) {
  const persistence = options.persistence ?? {};
  persistence.usedTotp ??= {};
  let mutations = Promise.resolve();
  return {
    async verify(code: string, now: number, challengeId: string): Promise<boolean> {
      if (!/^\d{6}$/.test(code)) return false;
      const matchingOffset = [-1, 0, 1].find((offset) => totpAt(secret, now + offset * 30_000) === code);
      if (matchingOffset === undefined) return false;
      const replayKey = `${Math.floor((now + matchingOffset * 30_000) / 30_000)}:${code}`;
      let accepted = false;
      const next = mutations.then(async () => {
        if (persistence.usedTotp?.[replayKey]) return;
        persistence.usedTotp![replayKey] = true;
        try { await options.persist?.(); } catch (error) { delete persistence.usedTotp![replayKey]; throw error; }
        accepted = true;
      });
      mutations = next.catch(() => undefined);
      await next;
      return accepted;
    },
  };
}
