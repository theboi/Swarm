import type { BotProfileAccountId, CodexAccountSlot, MacosBotId, PrimaryProfileState } from "../../shared/contracts.js";

type PrimaryProfileInspector = {
  inspect(bot: MacosBotId): Promise<PrimaryProfileState>;
};

/** Reconstructs the UI's primary-profile state from managed links after a coordinator restart. */
export async function restorePrimaryProfileState(inspector: PrimaryProfileInspector, slots: readonly CodexAccountSlot[]): Promise<Map<MacosBotId, BotProfileAccountId>> {
  const bots = [...new Set(slots.map((slot) => slot.macosUser))];
  const states = await Promise.all(bots.map((bot) => inspector.inspect(bot)));
  return new Map(states.flatMap((state) => state.primaryAccountId ? [[state.macosUser, state.primaryAccountId] as const] : []));
}
