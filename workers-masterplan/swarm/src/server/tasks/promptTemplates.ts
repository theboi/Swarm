import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { AccountId, PromptTemplate } from "../../shared/contracts.js";

export interface WorkerPromptValues { workerId: string; accountId: AccountId; taskId: string; taskTitle: string; phase: string; phaseTerminalCondition: string; blueprintPath: string; masterplanPath: string; coordinationRoot?: string; statusPath: string; specificationPath?: string; implementationPlanPath?: string; plannedPrerequisites?: string; uiRequirementsPath?: string; uiHandoffPath?: string; planningGatePath?: string; planningGateCommit?: string; hardPrerequisites?: string; implementationModel?: string; chatName?: string; checkoutMode: "coordinator_managed_same_mac_clones" | "independent_main_clone"; mainMutationLock: string; mainPushQueue: string; edenmindClonePath: string; ownedSurfaces: string; excludedSurfaces: string; devServerCommand?: string; }
const toToken = (key: string) => key.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase().replace(/^_/, "");

export async function renderWorkerPrompt(template: PromptTemplate, values: WorkerPromptValues, templateRoot = join(process.cwd(), "templates")): Promise<string> {
  let output = await readFile(join(templateRoot, `${template}.md`), "utf8");
  const mapped = { ...values, chatName: values.chatName ?? `${values.workerId} · ${values.taskTitle}`, coordinationRoot: values.coordinationRoot ?? "", specificationPath: values.specificationPath ?? "not applicable", implementationPlanPath: values.implementationPlanPath ?? "not applicable", plannedPrerequisites: values.plannedPrerequisites ?? "none", uiRequirementsPath: values.uiRequirementsPath ?? "not applicable", uiHandoffPath: values.uiHandoffPath ?? "not applicable", planningGatePath: values.planningGatePath ?? "not applicable", planningGateCommit: values.planningGateCommit ?? "not applicable", hardPrerequisites: values.hardPrerequisites ?? "none", implementationModel: values.implementationModel ?? "Terra High", devServerCommand: values.devServerCommand ?? "npm run dev" };
  for (const [key, value] of Object.entries(mapped)) output = output.split(`{{${toToken(key)}}}`).join(String(value));
  if (/{{[A-Z_]+}}/.test(output)) throw new Error("Template contains unresolved placeholder");
  return output;
}
