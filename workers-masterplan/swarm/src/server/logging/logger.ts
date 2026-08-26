const SENSITIVE_KEY = /(?:authorization|password|secret|token|cookie|transcript|content|output)/i;

function redact(value: unknown, secrets: string[], key = ""): unknown {
  if (SENSITIVE_KEY.test(key)) return "[REDACTED]";
  if (typeof value === "string") return secrets.reduce((result, secret) => secret ? result.split(secret).join("[REDACTED]") : result, value);
  if (Array.isArray(value)) return value.map((item) => redact(item, secrets));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([childKey, childValue]) => [childKey, redact(childValue, secrets, childKey)]));
  return value;
}

export function createLogger(options: { secrets?: string[]; write?: (entry: Record<string, unknown>) => void } = {}) {
  const write = options.write ?? ((entry: Record<string, unknown>) => process.stdout.write(`${JSON.stringify(entry)}\n`));
  const emit = (level: "info" | "warn" | "error", component: string, fields: Record<string, unknown> = {}) => write({ level, component, ...redact(fields, options.secrets ?? []) as Record<string, unknown> });
  return { info: (component: string, fields?: Record<string, unknown>) => emit("info", component, fields), warn: (component: string, fields?: Record<string, unknown>) => emit("warn", component, fields), error: (component: string, fields?: Record<string, unknown>) => emit("error", component, fields), redact: (value: unknown) => redact(value, options.secrets ?? []) };
}
