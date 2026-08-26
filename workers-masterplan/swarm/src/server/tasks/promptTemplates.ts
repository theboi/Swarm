import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { AccountId, PromptTemplate } from "../../shared/contracts.js";

export interface WorkerPromptValues { workerId: string; accountId: AccountId; taskId: string; taskTitle: string; phase: string; blueprintPath: string; masterplanPath: string; coordinationRoot?: string; statusPath: string; specificationPath?: string; implementationPlanPath?: string; planningGatePath?: string; planningGateCommit?: string; hardPrerequisites?: string; implementationModel?: string; chatName?: string; edenmindClonePath: string; ownedSurfaces: string; excludedSurfaces: string; devServerCommand?: string; }
const toToken = (key: string) => key.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase().replace(/^_/, "");

export async function renderWorkerPrompt(template: PromptTemplate, values: WorkerPromptValues, templateRoot = join(process.cwd(), "templates")): Promise<string> {
  let output = await readFile(join(templateRoot, `${template}.md`), "utf8");
  const mapped = { ...values, chatName: values.chatName ?? `${values.workerId} · ${values.taskTitle}`, coordinationRoot: values.coordinationRoot ?? "", specificationPath: values.specificationPath ?? "", implementationPlanPath: values.implementationPlanPath ?? "", planningGatePath: values.planningGatePath ?? "", planningGateCommit: values.planningGateCommit ?? "", hardPrerequisites: values.hardPrerequisites ?? "", implementationModel: values.implementationModel ?? "Terra High", devServerCommand: values.devServerCommand ?? "npm run dev" };
  for (const [key, value] of Object.entries(mapped)) output = output.split(`{{${toToken(key)}}}`).join(String(value));
  if (/{{[A-Z_]+}}/.test(output)) throw new Error("Template contains unresolved placeholder");
  return output;
}
