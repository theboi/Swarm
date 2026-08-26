import { Background, Controls, ReactFlow, ReactFlowProvider, type Edge, type Node, type NodeProps, type Viewport } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { CoordinatorSnapshot, TaskNode, TaskState } from "../../shared/contracts.js";
import { StatusBadge } from "../components/StatusBadge.js";

type Filter = "all" | "ready" | "blocked" | "running" | "complete";
type TaskFlowNode = Node<{ task: TaskNode; onSelect: (task: TaskNode) => void }, "task">;

function TaskGraphNode({ data }: NodeProps<TaskFlowNode>) {
  const { task, onSelect } = data;
  const name = `${task.id} ${task.title} ${task.readiness.state}`;
  return <button type="button" className={`flow-task flow-task--${task.readiness.state} nodrag`} aria-label={name} onKeyDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onSelect(task); }}><StatusBadge state={task.readiness.state} /><strong>{task.id}</strong><span>{task.title}</span></button>;
}

const nodeTypes = { task: TaskGraphNode };

function useMobile(): boolean {
  const [mobile, setMobile] = useState(() => window.innerWidth <= 767);
  useEffect(() => {
    const update = () => setMobile(window.innerWidth <= 767);
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return mobile;
}

function taskNodes(tasks: TaskNode[], onSelect: (task: TaskNode) => void): TaskFlowNode[] {
  return tasks.map((task, index) => ({
    id: task.id,
    type: "task",
    position: { x: (index % 3) * 260, y: Math.floor(index / 3) * 170 },
    data: { task, onSelect },
  }));
}

function taskEdges(tasks: TaskNode[]): Edge[] {
  const ids = new Set(tasks.map((task) => task.id));
  return tasks.flatMap((task) => task.dependsOn.filter((dependency) => ids.has(dependency)).map((dependency) => ({ id: `${dependency}-${task.id}`, source: dependency, target: task.id, animated: task.readiness.state === "running" })));
}

function TaskInspector({ task, onOpenChat, threadId, mobile, onClose }: { task: TaskNode; onOpenChat: () => void; threadId: string | undefined; mobile: boolean; onClose: () => void }) {
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (mobile) closeButton.current?.focus();
  }, [mobile, task.id]);
  const body = <><StatusBadge state={task.readiness.state} /><h2 id="task-inspector-title">{task.id} {task.title}</h2><p>Dependencies: {task.dependsOn.length ? task.dependsOn.join(", ") : "None reported"}</p><p>Suggested account: {task.readiness.suggestedAccount ?? "Unknown"}</p><h3>Readiness evidence</h3>{task.readiness.evidence.length ? <ul>{task.readiness.evidence.map((evidence) => <li key={evidence.code}>{evidence.code}: {evidence.satisfied ? "satisfied" : "not satisfied"}</li>)}</ul> : <p>No readiness evidence reported.</p>}<button type="button" aria-label={`Launch ${task.id}`} disabled>Launch from Home</button><button className="primary-button" type="button" onClick={onOpenChat} disabled={!threadId}>Open chat</button></>;
  if (!mobile) return <aside className="flow-inspector" aria-labelledby="task-inspector-title">{body}</aside>;
  return <div className="dialog-backdrop"><section className="flow-overlay" role="dialog" aria-modal="true" aria-labelledby="task-inspector-title" onKeyDown={(event) => { if (event.key === "Escape") onClose(); if (event.key === "Tab") { const focusable = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled])')]; const first = focusable[0]; const last = focusable.at(-1); if (!first || !last) return; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } } }}>{body}<button ref={closeButton} type="button" onClick={onClose}>Close</button></section></div>;
}

export function FlowchartPage({ snapshot, onOpenChat, initialViewport = { x: 0, y: 0, zoom: 1 } }: { snapshot: CoordinatorSnapshot; onOpenChat: (threadId: string) => void; initialViewport?: Viewport }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedTask, setSelectedTask] = useState<TaskNode | null>(null);
  const [viewport, setViewport] = useState<Viewport>(initialViewport);
  const selectionTrigger = useRef<HTMLElement | null>(null);
  const mobile = useMobile();
  const selectTask = useCallback((task: TaskNode) => {
    selectionTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSelectedTask(task);
  }, []);
  const closeInspector = useCallback(() => setSelectedTask(null), []);
  useEffect(() => {
    if (!selectedTask) selectionTrigger.current?.focus();
  }, [selectedTask]);
  const visibleTasks = useMemo(() => snapshot.tasks.filter((task) => filter === "all" || task.readiness.state === filter), [filter, snapshot.tasks]);
  const nodes = useMemo(() => taskNodes(visibleTasks, selectTask), [selectTask, visibleTasks]);
  const edges = useMemo(() => taskEdges(visibleTasks), [visibleTasks]);
  const selectedThread = selectedTask ? snapshot.dispatches.find((dispatch) => dispatch.taskId === selectedTask.id)?.threadId : undefined;

  return (
    <section className="flowchart-page" aria-labelledby="flowchart-title">
      <header><p className="eyebrow">Dependency graph</p><h1 id="flowchart-title">Flowchart</h1></header>
      <div className="flow-filters" aria-label="Task state filters">{(["all", "ready", "blocked", "running", "complete"] as Filter[]).map((state) => <button key={state} type="button" aria-pressed={filter === state} onClick={() => setFilter(state)}>Show {state} tasks</button>)}</div>
      <div className="flow-layout">
        <div className="flowchart-surface" data-testid="flowchart-surface" data-viewport={`${viewport.x},${viewport.y},${viewport.zoom}`}>
          <ReactFlowProvider>
            <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} defaultViewport={initialViewport} fitView onMoveEnd={(_, nextViewport) => setViewport(nextViewport)} aria-label="Task dependency graph" minZoom={0.2} maxZoom={2.5}>
              <Background gap={18} size={1} /><Controls showInteractive={false} />
            </ReactFlow>
          </ReactFlowProvider>
        </div>
        {selectedTask && !mobile ? <TaskInspector task={selectedTask} mobile={false} threadId={selectedThread} onClose={closeInspector} onOpenChat={() => selectedThread && onOpenChat(selectedThread)} /> : null}
      </div>
      {selectedTask && mobile ? <TaskInspector task={selectedTask} mobile threadId={selectedThread} onClose={closeInspector} onOpenChat={() => selectedThread && onOpenChat(selectedThread)} /> : null}
    </section>
  );
}
