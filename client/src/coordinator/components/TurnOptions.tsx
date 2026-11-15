import { EdenDropdown } from "@/components/primitives/EdenDropdown";
import { EdenButton } from "@/components/primitives/EdenButton/EdenButton";
import type { ChatExecutionSettings, ChatModelOption } from "../../shared/contracts.js";

export function TurnOptions({ models, settings, onChange }: { models: ChatModelOption[]; settings: ChatExecutionSettings; onChange: (settings: ChatExecutionSettings) => void }) {
  const selectedModel = models.find((model) => model.model === settings.model) ?? null;
  return <details className="chat-compose__options" onKeyDown={(event) => {
    if (event.key !== "Escape" || event.defaultPrevented || !event.currentTarget.open) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.open = false;
    event.currentTarget.querySelector("summary")?.focus();
  }}>
    <EdenButton asChild density="compact" appearance="secondary" isFloating={false}><summary>Turn options</summary></EdenButton>
    <fieldset className="chat-compose__settings"><legend>Turn settings</legend>
      <div className="chat-compose__settings-grid">
        <EdenDropdown label="Model" density="compact" portalled clearable={false} values={[settings.model ?? ""]} disabled={!models.length}
          options={[{ items: [{ value: "", label: "Current default" }, ...models.map((model) => ({ value: model.model, label: model.displayName }))] }]}
          onChange={([value]) => {
            const model = models.find((option) => option.model === value);
            onChange({ ...settings, model: model?.model, effort: model?.defaultEffort ?? undefined, serviceTier: model?.defaultServiceTier ?? undefined });
          }} />
        <EdenDropdown label="Effort" density="compact" portalled clearable={false} values={[settings.effort ?? ""]} disabled={!selectedModel?.supportedEfforts.length}
          options={[{ items: [{ value: "", label: "Model default" }, ...(selectedModel?.supportedEfforts ?? []).map((effort) => ({ value: effort, label: effort }))] }]}
          onChange={([value]) => onChange({ ...settings, effort: value || undefined })} />
        <EdenDropdown label="Speed" density="compact" portalled clearable={false} values={[settings.serviceTier ?? ""]} disabled={!selectedModel?.serviceTiers.length}
          options={[{ items: [{ value: "", label: "Model default" }, ...(selectedModel?.serviceTiers ?? []).map((tier) => ({ value: tier.id, label: tier.name }))] }]}
          onChange={([value]) => onChange({ ...settings, serviceTier: value || undefined })} />
        <EdenDropdown label="Permissions" density="compact" portalled clearable={false} values={[settings.permissionMode ?? "ask_for_approval"]}
          options={[{ items: [{ value: "ask_for_approval", label: "Ask for approval" }, { value: "ask_me", label: "Ask me" }, { value: "full_access", label: "Full access" }] }]}
          onChange={([value]) => {
            if (value === "ask_for_approval" || value === "ask_me" || value === "full_access") onChange({ ...settings, permissionMode: value });
          }} />
      </div>
      {settings.permissionMode === "full_access" ? <p className="chat-compose__access-note">Full access runs the next turn without a workspace sandbox.</p> : <p className="chat-compose__settings-note">Changes apply when you send the next message.</p>}
    </fieldset>
  </details>;
}
