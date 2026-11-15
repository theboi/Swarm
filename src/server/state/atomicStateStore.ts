import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { configuredSecretValues, type SwarmConfig } from "../config/config.js";

const SECRET_KEY = /(?:password|secret|token|authorization|cookie|credential)/i;

export function containsSecretLikeValue(value: unknown, secretValues: readonly string[] = [], key = ""): boolean {
  if (SECRET_KEY.test(key)) return true;
  if (typeof value === "string" && secretValues.some((secret) => secret.length > 0 && value.includes(secret))) return true;
  if (Array.isArray(value)) return value.some((item) => containsSecretLikeValue(item, secretValues));
  if (value && typeof value === "object") return Object.entries(value).some(([childKey, childValue]) => containsSecretLikeValue(childValue, secretValues, childKey));
  return false;
}

export class AtomicStateStore<T extends Record<string, unknown>> {
  private mutation = Promise.resolve();
  constructor(
    private readonly path: string,
    private readonly io: { writeTemp?: (path: string, data: string) => Promise<void>; secretValues?: readonly string[] } = {},
  ) {}
  async read(): Promise<T> {
    try { return JSON.parse(await readFile(this.path, "utf8")) as T; }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return {} as T;
      try { await rename(this.path, `${this.path}.corrupt-${Date.now()}`); } catch { /* preserve original read error as a safe empty recovery */ }
      return {} as T;
    }
  }
  async write(value: T): Promise<void> {
    if (containsSecretLikeValue(value, this.io.secretValues ?? [])) throw new Error("Refusing secret-like value in durable state");
    await mkdir(dirname(this.path), { recursive: true });
    const temporary = `${this.path}.${process.pid}.${Date.now()}.tmp`;
    const data = JSON.stringify(value);
    if (this.io.writeTemp) await this.io.writeTemp(temporary, data);
    else await writeFile(temporary, data, { mode: 0o600 });
    await rename(temporary, this.path);
  }
  async update(mutator: (current: T) => T): Promise<T> {
    let result!: T;
    const next = this.mutation.then(async () => {
      result = mutator(await this.read());
      await this.write(result);
    });
    this.mutation = next.catch(() => undefined);
    await next;
    return result;
  }
}

export function createCoordinatorStateStore<T extends Record<string, unknown>>(
  path: string,
  config: SwarmConfig,
  io: { writeTemp?: (path: string, data: string) => Promise<void> } = {},
): AtomicStateStore<T> {
  return new AtomicStateStore<T>(path, { ...io, secretValues: configuredSecretValues(config) });
}
