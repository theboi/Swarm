import type { AccountId } from "../../shared/contracts.js";

/** Separate macOS accounts work from isolated normal clones, not one shared checkout. */
export function launchGitMetadata(accountId: AccountId) {
  return {
    checkoutMode: "independent_main_clone" as const,
    mainMutationLock: "not-applicable-for-independent-clones",
    mainPushQueue: "swarm-main-push-queue",
    edenmindClonePath: `/Users/${accountId}/Dev/EdenMind`,
  };
}
