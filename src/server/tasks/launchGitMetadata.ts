import type { AccountId, CodexAccountSlot } from "../../shared/contracts.js";
import { workspaceRoot } from "../codex/protocol.js";

/** Credential profiles on one macOS account share that bot's normal main checkout. */
export function launchGitMetadata(accountId: AccountId | CodexAccountSlot, localWorkspaceRoot?: string) {
  return {
    checkoutMode: "independent_main_clone" as const,
    mainMutationLock: "not-applicable-for-independent-clones",
    edenmindClonePath: workspaceRoot(accountId, localWorkspaceRoot),
  };
}
