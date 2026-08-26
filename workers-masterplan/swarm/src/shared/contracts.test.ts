import { describe, expect, it } from "vitest";

import { validateTaskManifest } from "./contracts";

const validManifest = {
  blueprintId: "2026-08-14-mvp3",
  title: "MVP3",
  masterplanPath: "docs/mvp3.md",
  coordinationRoot: "docs/workers/2026-08-14-mvp3",
  tasks: [
    {
      id: "T0",
      title: "Taxonomy",
      kind: "planning",
      dependsOn: [],
      promptTemplate: "planning",
    },
    {
      id: "G0",
      title: "Planning gate",
      kind: "gate",
      dependsOn: ["T0"],
      promptTemplate: "planning",
    },
  ],
};

describe("validateTaskManifest", () => {
  it("accepts a gate with known dependencies", () => {
    expect(validateTaskManifest(validManifest)).toEqual({
      ok: true,
      data: validManifest,
    });
  });

  it("rejects a dependency cycle", () => {
    const result = validateTaskManifest({
      blueprintId: "2026-08-14-mvp3",
      title: "MVP3",
      masterplanPath: "docs/mvp3.md",
      coordinationRoot: "docs/workers/2026-08-14-mvp3",
      tasks: [
        {
          id: "T0",
          title: "Taxonomy",
          kind: "planning",
          dependsOn: ["U0"],
          promptTemplate: "planning",
        },
        {
          id: "U0",
          title: "Shell",
          kind: "planning",
          dependsOn: ["T0"],
          promptTemplate: "planning",
        },
      ],
    });

    expect(result).toEqual({
      ok: false,
      error: { code: "MANIFEST_CYCLE", cycle: ["T0", "U0", "T0"] },
    });
  });

  it("rejects an unknown dependency instead of treating it as ready", () => {
    expect(
      validateTaskManifest({
        ...validManifest,
        tasks: [{ ...validManifest.tasks[0], dependsOn: ["MISSING"] }],
      }),
    ).toEqual({
      ok: false,
      error: {
        code: "MANIFEST_UNKNOWN_DEPENDENCY",
        taskId: "T0",
        dependencyId: "MISSING",
      },
    });
  });

  it("rejects duplicate task IDs before constructing a graph", () => {
    expect(
      validateTaskManifest({
        ...validManifest,
        tasks: [validManifest.tasks[0], { ...validManifest.tasks[0] }],
      }),
    ).toEqual({
      ok: false,
      error: { code: "MANIFEST_DUPLICATE_TASK_ID", taskId: "T0" },
    });
  });

  it("rejects required fields that contain only whitespace", () => {
    expect(validateTaskManifest({ ...validManifest, title: "   " })).toEqual({
      ok: false,
      error: { code: "MANIFEST_INVALID", field: "title", reason: "required" },
    });
  });

  it.each([
    [null, "manifest", "type"],
    [{}, "blueprintId", "type"],
    [{ ...validManifest, blueprintId: " mvp3" }, "blueprintId", "value"],
    [{ ...validManifest, tasks: "T0" }, "tasks", "type"],
    [{ ...validManifest, tasks: [null] }, "tasks[0]", "type"],
    [{ ...validManifest, tasks: [{ ...validManifest.tasks[0], id: "" }] }, "tasks[0].id", "required"],
    [{ ...validManifest, tasks: [{ ...validManifest.tasks[0], kind: "build" }] }, "tasks[0].kind", "value"],
    [{ ...validManifest, tasks: [{ ...validManifest.tasks[0], promptTemplate: "build" }] }, "tasks[0].promptTemplate", "value"],
    [{ ...validManifest, tasks: [{ ...validManifest.tasks[0], dependsOn: "G0" }] }, "tasks[0].dependsOn", "type"],
    [{ ...validManifest, tasks: [{ ...validManifest.tasks[0], dependsOn: ["G0", "G0"] }] }, "tasks[0].dependsOn", "duplicate"],
    [{ ...validManifest, tasks: [{ ...validManifest.tasks[0], statusPath: "" }] }, "tasks[0].statusPath", "required"],
    [{ ...validManifest, tasks: [{ ...validManifest.tasks[0], preferredAccount: "bot9" }] }, "tasks[0].preferredAccount", "value"],
  ])("rejects malformed manifests deterministically", (input, field, reason) => {
    expect(validateTaskManifest(input)).toEqual({
      ok: false,
      error: { code: "MANIFEST_INVALID", field, reason },
    });
  });

  it("reports the first cycle in manifest task order", () => {
    const task = (id: string, dependsOn: string[]) => ({
      id,
      title: id,
      kind: "planning",
      dependsOn,
      promptTemplate: "planning",
    });
    expect(
      validateTaskManifest({
        ...validManifest,
        tasks: [task("A", ["B"]), task("B", ["A"]), task("C", ["C"])],
      }),
    ).toEqual({ ok: false, error: { code: "MANIFEST_CYCLE", cycle: ["A", "B", "A"] } });
  });
});
