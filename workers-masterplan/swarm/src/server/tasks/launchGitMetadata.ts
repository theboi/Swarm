import type { AccountId, CodexAccountSlot } from "../../shared/contracts.js";
import { workspaceRoot } from "../codex/protocol.js";

/** Separate macOS accounts work from isolated normal clones, not one shared checkout. */
export function launchGitMetadata(accountId: AccountId | CodexAccountSlot, localWorkspaceRoot?: string) {
  return {
    checkoutMode: "independent_main_clone" as const,
    mainMutationLock: "not-applicable-for-independent-clones",
    mainPushQueue: "swarm-main-push-queue",
    edenmindClonePath: workspaceRoot(accountId, localWorkspaceRoot),
  };
}
