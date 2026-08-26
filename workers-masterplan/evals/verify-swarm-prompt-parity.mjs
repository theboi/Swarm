import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(workspaceRoot, "..");
const skillPath = resolve(workspaceRoot, "blueprint-masterplan/SKILL.md");
const referencePath = resolve(
  workspaceRoot,
  "blueprint-masterplan/references/worker-prompt-templates.md",
);
const coordinatorTemplateDirectory = resolve(workspaceRoot, "swarm/templates");
const coordinatorRendererPath = resolve(
  workspaceRoot,
  "swarm/src/server/tasks/promptTemplates.ts",
);

const templateIds = ["planning", "execution", "ui"];
const coordinatorLaunchValues = {
  accountId: "bot3",
  blueprintPath: "docs/plans/edenmind_Implementation_Masterplan.md",
  chatName: "EdenMind W3 execution",
  coordinationRoot: "docs/workers/2026-08-26-edenmind",
  devServerCommand: "npm run dev -- --host 127.0.0.1",
  edenmindClonePath: "/Users/bot3/Dev/EdenMind",
  excludedSurfaces: "workers-masterplan/swarm/src/server/**",
  hardPrerequisites: "W1, W2",
  implementationModel: "Terra High",
  implementationPlanPath:
    "docs/superpowers/plans/2026-08-26-edenmind/2026-08-26-W3.md",
  masterplanPath: "docs/plans/edenmind_Implementation_Masterplan.md",
  ownedSurfaces: "workers-masterplan/swarm/src/client/**",
  phase: "execution",
  planningGateCommit: "0123456789abcdef0123456789abcdef01234567",
  planningGatePath: "docs/workers/2026-08-26-edenmind/PLANNING_GATE.md",
  specificationPath:
    "docs/superpowers/specs/2026-08-26-edenmind/2026-08-26-W3-design.md",
  statusPath: "docs/workers/2026-08-26-edenmind/status/W3.md",
  taskId: "W3",
  taskTitle: "Coordinator launch contract",
  workerId: "W3",
};
const blueprintLaunchValues = Object.fromEntries(
  Object.entries(coordinatorLaunchValues).map(([key, value]) => [
    key.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase(),
    value,
  ]),
);

function normalize(text) {
  return `${text.replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").trimEnd()}\n`;
}

function renderBlueprintMasterplanPacket(source, sourceName) {
  return source.replace(/{{([A-Z_]+)}}/g, (match, field) => {
    const value = blueprintLaunchValues[field];
    if (!value) {
      throw new Error(`${sourceName} uses unresolved placeholder ${match}`);
    }
    return value;
  });
}

function resolveBlueprintEntryPoint(reference, templateId) {
  const escapedId = templateId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = reference.match(
    new RegExp("\\| " + escapedId + " \\| `([^`]+)` \\|"),
  );

  if (!match) {
    throw new Error(
      `Blueprint Masterplan has no canonical ${templateId} template entry point`,
    );
  }

  return resolve(repositoryRoot, match[1]);
}

const [skill, reference] = await Promise.all([
  readFile(skillPath, "utf8"),
  readFile(referencePath, "utf8"),
]);

if (!skill.includes("EdenMind swarm coordinator launch packets")) {
  throw new Error("Blueprint Masterplan skill does not expose the coordinator adapter");
}

if (!skill.includes("references/worker-prompt-templates.md#edenmind-swarm-coordinator-launch-packets")) {
  throw new Error("Blueprint Masterplan skill does not link its coordinator adapter");
}

if (!reference.includes("## EdenMind swarm coordinator launch packets")) {
  throw new Error("Worker prompt reference does not define the coordinator adapter");
}

const { renderWorkerPrompt } = await import(pathToFileURL(coordinatorRendererPath).href);

for (const templateId of templateIds) {
  const coordinatorPath = resolve(coordinatorTemplateDirectory, `${templateId}.md`);
  const blueprintPath = resolveBlueprintEntryPoint(reference, templateId);
  if (blueprintPath !== coordinatorPath) {
    throw new Error(
      `Blueprint Masterplan ${templateId} entry point does not resolve the canonical coordinator template`,
    );
  }
  const blueprintSource = await readFile(blueprintPath, "utf8");
  const coordinatorRender = Buffer.from(
    normalize(
      await renderWorkerPrompt(
        templateId,
        coordinatorLaunchValues,
        coordinatorTemplateDirectory,
      ),
    ),
    "utf8",
  );
  const blueprintRender = Buffer.from(
    normalize(
      renderBlueprintMasterplanPacket(
        blueprintSource,
        `Blueprint Masterplan ${templateId} template`,
      ),
    ),
    "utf8",
  );

  if (Buffer.compare(coordinatorRender, blueprintRender) !== 0) {
    throw new Error(
      `${templateId} render differs between coordinator and Blueprint Masterplan entry points`,
    );
  }

  process.stdout.write(
    `PASS ${templateId}: normalized renders match byte-for-byte (${coordinatorRender.length} bytes)\n`,
  );
}

process.stdout.write("PASS swarm prompt parity: 3 canonical packets verified\n");
