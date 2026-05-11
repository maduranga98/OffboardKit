import { useMemo, useRef, useEffect, useState } from "react";
import { format } from "date-fns";
import clsx from "clsx";
import { AlertTriangle, Clock, CheckCircle, Circle, Ban } from "lucide-react";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { EmptyState } from "../shared/EmptyState";
import type { FlowTask, TaskStatus } from "../../types/offboarding.types";

interface Props {
  tasks: FlowTask[];
}

interface LayoutNode {
  task: FlowTask;
  level: number;
  indexInLevel: number;
  x: number;
  y: number;
  onCriticalPath: boolean;
}

const NODE_WIDTH = 220;
const NODE_HEIGHT = 96;
const COLUMN_GAP = 80;
const ROW_GAP = 24;
const PADDING_X = 24;
const PADDING_Y = 24;

// Kahn-style topological sort that:
//   - assigns each task a "level" = 1 + max(level of its prerequisites)
//   - returns any task IDs that participate in a cycle (and so could not
//     be levelled). Tasks pointing at a nonexistent dependency are
//     treated as having no dependency.
function topoLevels(tasks: FlowTask[]): {
  levels: Map<string, number>;
  cycleNodes: Set<string>;
} {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();
  for (const t of tasks) {
    incoming.set(t.id, []);
    outgoing.set(t.id, []);
  }
  for (const t of tasks) {
    const dep = t.dependsOnTaskId;
    if (dep && byId.has(dep) && dep !== t.id) {
      incoming.get(t.id)!.push(dep);
      outgoing.get(dep)!.push(t.id);
    }
  }
  const levels = new Map<string, number>();
  const remaining = new Map<string, number>();
  for (const t of tasks) remaining.set(t.id, incoming.get(t.id)!.length);
  const queue: string[] = [];
  for (const [id, count] of remaining) {
    if (count === 0) {
      levels.set(id, 0);
      queue.push(id);
    }
  }
  while (queue.length > 0) {
    const id = queue.shift()!;
    const here = levels.get(id)!;
    for (const next of outgoing.get(id)!) {
      const prevLevel = levels.get(next) ?? -1;
      levels.set(next, Math.max(prevLevel, here + 1));
      const rem = (remaining.get(next) ?? 0) - 1;
      remaining.set(next, rem);
      if (rem === 0) queue.push(next);
    }
  }
  const cycleNodes = new Set<string>();
  for (const t of tasks) {
    if (!levels.has(t.id)) cycleNodes.add(t.id);
  }
  return { levels, cycleNodes };
}

// Longest path (by edge count) through tasks ignoring cycle-stuck nodes.
// Returns the set of task IDs on that path so we can highlight them.
function criticalPath(
  tasks: FlowTask[],
  levels: Map<string, number>
): Set<string> {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const memoLen = new Map<string, number>();
  const memoNext = new Map<string, string | null>();
  const outgoing = new Map<string, string[]>();
  for (const t of tasks) outgoing.set(t.id, []);
  for (const t of tasks) {
    const dep = t.dependsOnTaskId;
    if (dep && byId.has(dep) && levels.has(t.id) && levels.has(dep)) {
      outgoing.get(dep)!.push(t.id);
    }
  }
  const longestFrom = (id: string): number => {
    if (memoLen.has(id)) return memoLen.get(id)!;
    let best = 0;
    let bestNext: string | null = null;
    for (const next of outgoing.get(id) ?? []) {
      const candidate = 1 + longestFrom(next);
      if (candidate > best) {
        best = candidate;
        bestNext = next;
      }
    }
    memoLen.set(id, best);
    memoNext.set(id, bestNext);
    return best;
  };
  let startId: string | null = null;
  let startLen = -1;
  for (const t of tasks) {
    if (!levels.has(t.id)) continue;
    const len = longestFrom(t.id);
    if (len > startLen) {
      startLen = len;
      startId = t.id;
    }
  }
  const path = new Set<string>();
  let cursor = startId;
  while (cursor) {
    path.add(cursor);
    cursor = memoNext.get(cursor) ?? null;
  }
  // A single isolated task isn't a meaningful critical path; only
  // highlight when at least one edge is present.
  return path.size > 1 ? path : new Set();
}

function statusIcon(status: TaskStatus) {
  switch (status) {
    case "completed":
      return <CheckCircle size={14} className="text-teal" />;
    case "overdue":
      return <Clock size={14} className="text-ember" />;
    case "skipped":
      return <Ban size={14} className="text-mist" />;
    case "in_progress":
      return <Clock size={14} className="text-amber" />;
    default:
      return <Circle size={14} className="text-mist" />;
  }
}

export default function DependencyGraph({ tasks }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width;
      if (w) setContainerWidth(w);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const { nodes, edges, cycleNodes, width, height } = useMemo(() => {
    const { levels, cycleNodes } = topoLevels(tasks);
    const criticalSet = criticalPath(tasks, levels);

    // Place cycle-stuck nodes in a synthetic trailing column so they
    // still render and the user can see them flagged.
    const maxLevel = Math.max(0, ...Array.from(levels.values()));
    const cycleColumn = cycleNodes.size > 0 ? maxLevel + 1 : -1;

    const grouped = new Map<number, FlowTask[]>();
    for (const t of tasks) {
      const lvl = levels.has(t.id) ? levels.get(t.id)! : cycleColumn;
      if (!grouped.has(lvl)) grouped.set(lvl, []);
      grouped.get(lvl)!.push(t);
    }
    // Sort each column by due date for readability.
    for (const arr of grouped.values()) {
      arr.sort((a, b) => {
        const da = a.dueDate?.toMillis?.() ?? 0;
        const db = b.dueDate?.toMillis?.() ?? 0;
        return da - db;
      });
    }

    const sortedLevels = Array.from(grouped.keys()).sort((a, b) => a - b);
    const nodes: LayoutNode[] = [];
    let maxNodesInCol = 0;
    for (const lvl of sortedLevels) {
      const col = grouped.get(lvl)!;
      maxNodesInCol = Math.max(maxNodesInCol, col.length);
      col.forEach((task, i) => {
        nodes.push({
          task,
          level: lvl,
          indexInLevel: i,
          x: PADDING_X + sortedLevels.indexOf(lvl) * (NODE_WIDTH + COLUMN_GAP),
          y: PADDING_Y + i * (NODE_HEIGHT + ROW_GAP),
          onCriticalPath: criticalSet.has(task.id),
        });
      });
    }

    const byId = new Map(nodes.map((n) => [n.task.id, n]));
    const edges = nodes
      .map((n) => {
        const dep = n.task.dependsOnTaskId;
        if (!dep) return null;
        const from = byId.get(dep);
        if (!from) return null;
        const fromCritical = criticalSet.has(dep) && criticalSet.has(n.task.id);
        const inCycle = cycleNodes.has(dep) || cycleNodes.has(n.task.id);
        return {
          from,
          to: n,
          critical: fromCritical,
          cycle: inCycle,
        };
      })
      .filter((e): e is NonNullable<typeof e> => !!e);

    const width =
      PADDING_X * 2 +
      sortedLevels.length * NODE_WIDTH +
      Math.max(0, sortedLevels.length - 1) * COLUMN_GAP;
    const height =
      PADDING_Y * 2 + maxNodesInCol * NODE_HEIGHT + Math.max(0, maxNodesInCol - 1) * ROW_GAP;

    return { nodes, edges, cycleNodes, criticalSet, width, height };
  }, [tasks]);

  if (tasks.length === 0) {
    return (
      <Card>
        <EmptyState
          title="No tasks to graph"
          description="Once tasks are created with dependencies, the workflow will appear here."
        />
      </Card>
    );
  }

  const hasAnyDeps = tasks.some((t) => !!t.dependsOnTaskId);
  const svgWidth = Math.max(width, containerWidth || width);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 text-xs text-mist">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-0.5 bg-teal" /> Critical path
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-0.5 bg-navy/30" /> Dependency
        </span>
        {cycleNodes.size > 0 && (
          <span className="inline-flex items-center gap-1 text-ember">
            <AlertTriangle size={12} /> {cycleNodes.size} task
            {cycleNodes.size === 1 ? "" : "s"} in a dependency cycle
          </span>
        )}
        {!hasAnyDeps && (
          <span>
            No dependencies defined — tasks are shown in due-date order.
          </span>
        )}
      </div>

      <Card padding="none">
        <div
          ref={containerRef}
          className="overflow-x-auto"
          style={{ minHeight: height + 16 }}
        >
          <div style={{ position: "relative", width: svgWidth, height }}>
            <svg
              width={svgWidth}
              height={height}
              style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
            >
              <defs>
                <marker
                  id="arrow-default"
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(15,28,46,0.3)" />
                </marker>
                <marker
                  id="arrow-critical"
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#0D9E8A" />
                </marker>
                <marker
                  id="arrow-cycle"
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#DC2626" />
                </marker>
              </defs>
              {edges.map((e, i) => {
                const x1 = e.from.x + NODE_WIDTH;
                const y1 = e.from.y + NODE_HEIGHT / 2;
                const x2 = e.to.x;
                const y2 = e.to.y + NODE_HEIGHT / 2;
                const midX = (x1 + x2) / 2;
                const d = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
                const stroke = e.cycle
                  ? "#DC2626"
                  : e.critical
                  ? "#0D9E8A"
                  : "rgba(15,28,46,0.3)";
                const marker = e.cycle
                  ? "url(#arrow-cycle)"
                  : e.critical
                  ? "url(#arrow-critical)"
                  : "url(#arrow-default)";
                return (
                  <path
                    key={i}
                    d={d}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={e.critical ? 2 : 1.5}
                    markerEnd={marker}
                  />
                );
              })}
            </svg>
            {nodes.map((n) => {
              const due = n.task.dueDate?.toDate?.();
              const inCycle = cycleNodes.has(n.task.id);
              return (
                <div
                  key={n.task.id}
                  className={clsx(
                    "absolute rounded-md border bg-white p-3 shadow-sm",
                    inCycle
                      ? "border-ember"
                      : n.onCriticalPath
                      ? "border-teal"
                      : "border-navy/10"
                  )}
                  style={{
                    left: n.x,
                    top: n.y,
                    width: NODE_WIDTH,
                    height: NODE_HEIGHT,
                  }}
                >
                  <div className="flex items-center gap-1.5">
                    {statusIcon(n.task.status)}
                    <span className="text-xs font-medium text-mist">
                      {n.task.assigneeRole.replace("_", " ")}
                    </span>
                    {n.onCriticalPath && (
                      <Badge variant="teal">Critical</Badge>
                    )}
                    {inCycle && <Badge variant="ember">Cycle</Badge>}
                  </div>
                  <p className="mt-1 text-sm font-medium text-navy truncate">
                    {n.task.title}
                  </p>
                  <p className="mt-1 text-xs text-mist">
                    {due ? format(due, "MMM d") : "—"}
                    {!n.task.isRequired && " · optional"}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </Card>
    </div>
  );
}
