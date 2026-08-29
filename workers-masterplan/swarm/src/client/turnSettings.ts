import type { AccountId, ChatExecutionSettings, ChatModelOption, TaskPhase } from "../shared/contracts.js";

const CHAT_SETTINGS_STORAGE_KEY = "swarm.chat.execution-settings.v1";
const GLOBAL_SETTINGS_STORAGE_KEY = "swarm.chat.execution-settings.global.v1";

function parsedSettings(value: unknown): ChatExecutionSettings | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const settings = value as Record<string, unknown>;
  const permissionMode = settings.permissionMode === "ask_me" || settings.permissionMode === "full_access" ? settings.permissionMode : "ask_for_approval";
  const text = (field: string) => typeof settings[field] === "string" ? settings[field] : undefined;
  return { ...(text("model") ? { model: text("model") } : {}), ...(text("effort") ? { effort: text("effort") } : {}), ...(text("serviceTier") ? { serviceTier: text("serviceTier") } : {}), permissionMode };
}

export function readChatExecutionSettings(): Record<string, ChatExecutionSettings> {
  try {
    const raw = globalThis.localStorage?.getItem(CHAT_SETTINGS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).flatMap(([key, value]) => {
      const settings = parsedSettings(value);
      return settings ? [[key, settings]] : [];
    }));
  } catch { return {}; }
}

export function readGlobalExecutionSettings(): ChatExecutionSettings {
  try { return parsedSettings(JSON.parse(globalThis.localStorage?.getItem(GLOBAL_SETTINGS_STORAGE_KEY) ?? "null")) ?? { permissionMode: "ask_for_approval" }; }
  catch { return { permissionMode: "ask_for_approval" }; }
}

export function writeChatExecutionSettings(settings: Record<string, ChatExecutionSettings>): void {
  try { globalThis.localStorage?.setItem(CHAT_SETTINGS_STORAGE_KEY, JSON.stringify(settings)); } catch { /* Browser storage can be unavailable. */ }
}

export function writeGlobalExecutionSettings(settings: ChatExecutionSettings): void {
  try { globalThis.localStorage?.setItem(GLOBAL_SETTINGS_STORAGE_KEY, JSON.stringify(settings)); } catch { /* Browser storage can be unavailable. */ }
}

export function chatExecutionSettingsKey(accountId: AccountId, threadId: string): string {
  return `${accountId}\u0000${threadId}`;
}

export function defaultExecutionSettings(models: ChatModelOption[]): ChatExecutionSettings {
  const defaultModel = models.find((model) => model.isDefault) ?? models[0];
  return { permissionMode: "ask_for_approval", ...(defaultModel ? { model: defaultModel.model, ...(defaultModel.defaultEffort ? { effort: defaultModel.defaultEffort } : {}), ...(defaultModel.defaultServiceTier ? { serviceTier: defaultModel.defaultServiceTier } : {}) } : {}) };
}

const PHASE_DEFAULTS: Record<Exclude<TaskPhase, "gate">, { model: string; effort: string }> = {
  planning: { model: "gpt-5.6-sol", effort: "high" },
  execution: { model: "gpt-5.6-terra", effort: "xhigh" },
  ui: { model: "gpt-5.6-sol", effort: "xhigh" },
};

/** Product defaults for task launches. Model-catalog normalization still protects older accounts. */
export function phaseDefaultExecutionSettings(models: ChatModelOption[], phase: TaskPhase): ChatExecutionSettings {
  const requested = PHASE_DEFAULTS[phase === "gate" ? "planning" : phase];
  const model = models.find((candidate) => candidate.model === requested.model);
  const normalTier = model?.serviceTiers.find((tier) => tier.id === "standard" || /normal|standard/i.test(tier.name))?.id ?? "standard";
  if (!models.length) return { ...requested, serviceTier: normalTier, permissionMode: "full_access" };
  return normalizeExecutionSettings(models, { ...requested, serviceTier: normalTier, permissionMode: "full_access" });
}

export function normalizeExecutionSettings(models: ChatModelOption[], selected: ChatExecutionSettings): ChatExecutionSettings {
  const permissionMode = selected.permissionMode === "ask_me" || selected.permissionMode === "full_access" ? selected.permissionMode : "ask_for_approval";
  if (models.length === 0) return { ...selected, permissionMode };
  const model = models.find((candidate) => candidate.model === selected.model) ?? models.find((candidate) => candidate.isDefault) ?? models[0];
  return {
    model: model.model,
    effort: selected.effort && model.supportedEfforts.includes(selected.effort) ? selected.effort : model.defaultEffort ?? undefined,
    serviceTier: selected.serviceTier && model.serviceTiers.some((tier) => tier.id === selected.serviceTier) ? selected.serviceTier : model.defaultServiceTier ?? undefined,
    permissionMode,
  };
}

export function saveThreadExecutionSettings(accountId: AccountId, threadId: string, settings: ChatExecutionSettings): void {
  const all = readChatExecutionSettings();
  all[chatExecutionSettingsKey(accountId, threadId)] = settings;
  writeChatExecutionSettings(all);
  writeGlobalExecutionSettings(settings);
}
