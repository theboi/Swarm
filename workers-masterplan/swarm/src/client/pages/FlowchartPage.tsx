import { Background, Controls, Handle, MarkerType, Position, ReactFlow, ReactFlowProvider, type Edge, type Node, type NodeProps, type Viewport } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { AccountId, ChatExecutionSettings, CoordinatorSnapshot, ManifestPass, TaskNode, TaskState, WorkerAssignmentRecord } from "../../shared/contracts.js";
import type { CoordinatorApi, LaunchPreview } from "../api.js";
import { LaunchDialog, type ChatTarget } from "./HomePage.js";
import { OverlayCloseButton } from "../components/OverlayCloseButton.js";
import { StatusBadge } from "../components/StatusBadge.js";
import { Toast } from "../components/Toast.js";
import { saveThreadExecutionSettings } from "../turnSettings.js";

type Filter = "all" | "ready" | "blocked" | "running" | "complete";
type TaskFlowNode = Node<{ task: TaskNode; assignment?: WorkerAssignmentRecord; onSelect: (task: TaskNode) => void }, "task">;

function TaskGraphNode({ data }: NodeProps<TaskFlowNode>) {
  const { task, assignment, onSelect } = data;
  const name = `${task.id} ${task.title} ${task.readiness.state}`;
  return <div className={`flow-task flow-task--${task.readiness.state}`}>
    <Handle className="flow-task__handle" type="target" position={Position.Left} />
    <button type="button" className="flow-task__button nodrag" aria-label={name} onKeyDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onSelect(task); }}><StatusBadge state={task.readiness.state} phase={task.readiness.phase} /><strong>{task.id}</strong><span>{task.title}</span>{assignment && assignment.state !== "completed" ? <small className="flow-task__owner">{assignment.accountId}</small> : null}</button>
    <Handle className="flow-task__handle" type="source" position={Position.Right} />
  </div>;
}

const nodeTypes = { task: TaskGraphNode };

export function taskLayoutPositions(tasks: Array<Pick<TaskNode, "id" | "dependsOn" | "pathId" | "pathStep">>): Map<string, { x: number; y: number }> {
  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  const depthById = new Map<string, number>();
  const visiting = new Set<string>();
  const depthFor = (taskId: string): number => {
    const cached = depthById.get(taskId);
    if (cached !== undefined) return cached;
    const task = tasksById.get(taskId);
    if (!task || visiting.has(taskId)) return 0;
    visiting.add(taskId);
    const dependencies = task.dependsOn.filter((dependency) => tasksById.has(dependency) && !visiting.has(dependency));
    const depth = dependencies.length ? Math.max(...dependencies.map(depthFor)) + 1 : 0;
    visiting.delete(taskId);
    depthById.set(taskId, depth);
    return depth;
  };
  const layers = new Map<number, Array<{ task: Pick<TaskNode, "id" | "dependsOn" | "pathId" | "pathStep">; index: number }>>();
  tasks.forEach((task, index) => {
    const depth = depthFor(task.id);
    const layer = layers.get(depth) ?? [];
    layer.push({ task, index });
    layers.set(depth, layer);
  });
  const positions = new Map<string, { x: number; y: number }>();
  for (const [depth, layer] of layers) {
    layer.sort((left, right) => (left.task.pathStep ?? left.index) - (right.task.pathStep ?? right.index) || left.index - right.index);
    layer.forEach(({ task }, index) => positions.set(task.id, { x: depth * 300, y: index * 148 }));
  }
  return positions;
}

function taskNodes(tasks: TaskNode[], onSelect: (task: TaskNode) => void, layoutTasks: TaskNode[] = tasks, assignments: WorkerAssignmentRecord[] = []): TaskFlowNode[] {
  const positions = taskLayoutPositions(layoutTasks);
  return tasks.map((task, index) => ({
    id: task.id,
    type: "task",
    position: positions.get(task.id) ?? { x: (index % 3) * 260, y: Math.floor(index / 3) * 170 },
    data: { task, assignment: assignments.find((candidate) => candidate.taskId === task.id), onSelect },
  }));
}

function taskEdges(tasks: TaskNode[]): Edge[] {
  const ids = new Set(tasks.map((task) => task.id));
  return tasks.flatMap((task) => task.dependsOn.filter((dependency) => ids.has(dependency)).map((dependency) => ({ id: `${dependency}-${task.id}`, source: dependency, target: task.id, type: "smoothstep", animated: task.readiness.state === "running", markerEnd: { type: MarkerType.ArrowClosed, color: "#8ee39a", width: 16, height: 16 }, style: { stroke: "#8ee39a", strokeWidth: 2 } })));
}

function TaskInspector({ task, assignment, onOpenChat, onReviewLaunch, threadId, onClose }: { task: TaskNode; assignment?: WorkerAssignmentRecord; onOpenChat: () => void; onReviewLaunch: () => void; threadId: string | undefined; onClose: () => void }) {
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => closeButton.current?.focus(), [task.id]);
  const body = <>
    <StatusBadge state={task.readiness.state} phase={task.readiness.phase} />
    <h2 id="task-inspector-title">{task.id} {task.title}</h2>
    {assignment ? <p>Assigned to: {assignment.accountId}{assignment.transferHistory.length ? ` · transferred ${assignment.transferHistory.length} time${assignment.transferHistory.length === 1 ? "" : "s"}` : ""}</p> : null}
    {task.pathId !== undefined && task.pathStep !== undefined ? <p>Path: {task.pathId} · Layer: {task.pathStep}</p> : null}
    <p>Dependencies: {task.dependsOn.length ? task.dependsOn.join(", ") : "None reported"}</p>
    <h3>Artifact paths</h3>
    <dl>
      {task.statusPath ? <><dt>Status</dt><dd><code>{task.statusPath}</code></dd></> : null}
      {task.specificationPath ? <><dt>Specification</dt><dd><code>{task.specificationPath}</code></dd></> : null}
      {task.implementationPlanPath ? <><dt>Implementation plan</dt><dd><code>{task.implementationPlanPath}</code></dd></> : null}
      {task.uiRequirementsPath ? <><dt>UI requirements</dt><dd><code>{task.uiRequirementsPath}</code></dd></> : null}
      {task.uiHandoffPath ? <><dt>Presentation handoff</dt><dd><code>{task.uiHandoffPath}</code></dd></> : null}
    </dl>
    <h3>Readiness evidence</h3>
    {task.readiness.evidence.length ? <ul>{task.readiness.evidence.map((evidence) => <li key={evidence.code}>{evidence.code}: {evidence.satisfied ? "satisfied" : "not satisfied"}</li>)}</ul> : <p>No readiness evidence reported.</p>}
    <button type="button" aria-label={`Review launch for ${task.id}`} onClick={onReviewLaunch}>Review launch</button>
    <button className="primary-button" type="button" onClick={onOpenChat} disabled={!threadId}>Open chat</button>
  </>;
  return <div className="dialog-backdrop dialog-backdrop--right" onMouseDown={onClose}>
    <section className="flow-overlay" role="dialog" aria-modal="true" aria-labelledby="task-inspector-title" onMouseDown={(event) => event.stopPropagation()} onKeyDown={(event) => {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab") {
        const focusable = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled])')];
        const first = focusable[0];
        const last = focusable.at(-1);
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }}>
      <OverlayCloseButton ref={closeButton} onClick={onClose} />
      {body}
    </section>
  </div>;
}

type FlowLaunchApi = Pick<CoordinatorApi, "previewLaunch" | "launch"> & Partial<Pick<CoordinatorApi, "listModels">>;

export function FlowchartPage({ snapshot, api, onOpenChat, onOpenLaunchedChat, initialViewport = { x: 0, y: 0, zoom: 1 } }: { snapshot: CoordinatorSnapshot; api?: FlowLaunchApi; onOpenChat: (threadId: string) => void; onOpenLaunchedChat?: (target: ChatTarget) => void; initialViewport?: Viewport }) {
  const [pass, setPass] = useState<ManifestPass>("planning");
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedTask, setSelectedTask] = useState<TaskNode | null>(null);
  const [preview, setPreview] = useState<LaunchPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewport, setViewport] = useState<Viewport>(initialViewport);
  const selectionTrigger = useRef<HTMLElement | null>(null);
  const selectTask = useCallback((task: TaskNode) => {
    selectionTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSelectedTask(task);
  }, []);
  const closeInspector = useCallback(() => setSelectedTask(null), []);
  useEffect(() => {
    if (!selectedTask) selectionTrigger.current?.focus();
  }, [selectedTask]);
  const passTasks = snapshot.taskPasses?.[pass] ?? (pass === "planning" ? snapshot.tasks : []);
  const visibleTasks = useMemo(() => passTasks.filter((task) => filter === "all" || task.readiness.state === filter), [filter, passTasks]);
  useEffect(() => { if (filter !== "all" && passTasks.length > 0 && visibleTasks.length === 0) setFilter("all"); }, [filter, passTasks.length, visibleTasks.length]);
  const passAssignments = snapshot.workerAssignments?.filter((assignment) => (assignment.pass ?? "planning") === pass);
  const nodes = useMemo(() => taskNodes(visibleTasks, selectTask, passTasks, passAssignments), [passAssignments, passTasks, selectTask, visibleTasks]);
  const edges = useMemo(() => taskEdges(visibleTasks), [visibleTasks]);
  const selectedAssignment = selectedTask ? passAssignments?.find((assignment) => assignment.taskId === selectedTask.id) : undefined;
  const selectedThread = selectedAssignment?.threadId ?? (selectedTask ? snapshot.dispatches.find((dispatch) => dispatch.taskId === selectedTask.id)?.threadId : undefined);
  const reviewLaunch = async (task: TaskNode, accountId?: AccountId) => {
    if (!api) return;
    setError(null);
    try {
      const result = await api.previewLaunch(task.id, accountId, pass);
      if ("error" in result && result.error) return setError(result.error.message);
      setPreview(result.data);
    } catch {
      setError("Unable to review this launch.");
    }
  };
  const sendLaunch = async (prompt: string, settings: ChatExecutionSettings) => {
    if (!api || !preview) return;
    try {
      const result = await api.launch(preview.task.id, preview.accountId, prompt, settings, pass);
      if ("error" in result && result.error) { setError(result.error.message); return; }
      setPreview(null);
      saveThreadExecutionSettings(result.data.accountId, result.data.threadId, settings);
      onOpenLaunchedChat?.({ accountId: result.data.accountId, threadId: result.data.threadId });
    } catch {
      setError("Unable to send this work.");
    }
  };

  return (
    <section className="flowchart-page" aria-labelledby="flowchart-title">
      <header><p className="eyebrow">Dependency graph</p><h1 id="flowchart-title">Flowchart</h1></header>
      {error ? <Toast tone="error" onDismiss={() => setError(null)}>{error}</Toast> : null}
      <div className="flow-pass-tabs" role="tablist" aria-label="Worker pass"><button role="tab" aria-selected={pass === "planning"} onClick={() => { setPass("planning"); setFilter("all"); setSelectedTask(null); }}>Pass 1 · Planning</button><button role="tab" aria-selected={pass === "execution"} onClick={() => { setPass("execution"); setFilter("all"); setSelectedTask(null); }}>Pass 2 · Execution</button></div>
      <div className="flow-filters" aria-label="Task state filters">{(["all", "ready", "blocked", "running", "complete"] as Filter[]).map((state) => <button key={state} type="button" aria-pressed={filter === state} onClick={() => setFilter(state)}>Show {state} tasks</button>)}</div>
      <div className="flow-layout">
        <div className="flowchart-surface" data-testid="flowchart-surface" data-viewport={`${viewport.x},${viewport.y},${viewport.zoom}`}>
          <ReactFlowProvider>
            <ReactFlow key={pass} nodes={nodes} edges={edges} nodeTypes={nodeTypes} defaultViewport={initialViewport} fitView onMoveEnd={(_, nextViewport) => setViewport(nextViewport)} aria-label="Task dependency graph" minZoom={0.2} maxZoom={2.5}>
              <Background gap={18} size={1} /><Controls showInteractive={false} />
            </ReactFlow>
          </ReactFlowProvider>
        </div>
      </div>
      {selectedTask ? <TaskInspector task={selectedTask} assignment={selectedAssignment} threadId={selectedThread} onClose={closeInspector} onReviewLaunch={() => void reviewLaunch(selectedTask)} onOpenChat={() => selectedThread && onOpenChat(selectedThread)} /> : null}
      {preview ? <LaunchDialog preview={preview} onClose={() => setPreview(null)} onSend={sendLaunch} onSelectAccount={(accountId) => reviewLaunch(preview.task, accountId)} listModels={api?.listModels} /> : null}
    </section>
  );
}
