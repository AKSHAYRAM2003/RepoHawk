"use client";

import { useMemo } from "react";
import type { DiagramNode, DiagramEdge } from "@/hooks/useDiagram";
import LayeredArchitecture from "./LayeredArchitecture";

/**
 * DiagramCanvas auto-detects the data format:
 * - If nodes have `data.layer` → use LayeredArchitecture (AWS-style)
 * - Otherwise → use ClassicDiagram (simple dagre layout)
 */
export default function DiagramCanvas({
  nodes,
  edges,
}: {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}) {
  const hasLayerData = useMemo(
    () => nodes.some((n) => n.data?.layer),
    [nodes]
  );

  if (hasLayerData) {
    return <LayeredArchitecture nodes={nodes} edges={edges} />;
  }

  // Fallback to old classic diagram
  return <ClassicDiagram nodes={nodes} edges={edges} />;
}

// ------------------------------------------------------------------
// Classic fallback (simple dagre layout, no layers)
// ------------------------------------------------------------------
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  MarkerType,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "dagre";
import { motion } from "framer-motion";

const nodeWidth = 200;
const nodeHeight = 60;

const ACCENT_COLORS = [
  { bg: "from-indigo-500/10 to-indigo-600/5", border: "border-indigo-500/30", dot: "bg-indigo-500" },
  { bg: "from-emerald-500/10 to-emerald-600/5", border: "border-emerald-500/30", dot: "bg-emerald-500" },
  { bg: "from-violet-500/10 to-violet-600/5", border: "border-violet-500/30", dot: "bg-violet-500" },
  { bg: "from-amber-500/10 to-amber-600/5", border: "border-amber-500/30", dot: "bg-amber-500" },
  { bg: "from-rose-500/10 to-rose-600/5", border: "border-rose-500/30", dot: "bg-rose-500" },
  { bg: "from-cyan-500/10 to-cyan-600/5", border: "border-cyan-500/30", dot: "bg-cyan-500" },
];

function ClassicNode({ data }: NodeProps) {
  const label = data.label as string;
  const idx = ((data as any)._index as number) ?? 0;
  const c = ACCENT_COLORS[idx % ACCENT_COLORS.length];
  const name = label.includes(".") ? label.split(".").pop()! : label;
  const mod = label.includes(".") ? label.split(".")[0] : "";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.7, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.35, delay: idx * 0.03 }}
      className={`px-4 py-3 rounded-2xl bg-gradient-to-br ${c.bg} border ${c.border} shadow-md backdrop-blur-sm min-w-[180px]`}
    >
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !border-2 !border-slate-800 !bg-indigo-500" />
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${c.dot} shadow-lg`} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-slate-100 truncate">{name}</div>
          {mod && <div className="text-[10px] font-mono text-slate-500 truncate">{mod}</div>}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !border-2 !border-slate-800 !bg-indigo-500" />
    </motion.div>
  );
}

const classicNodeTypes = { classic: ClassicNode };

const edgeAnimCSS = `
@keyframes dash { to { stroke-dashoffset: 0; } }
.react-flow__edge-path { stroke-dasharray: 2000; stroke-dashoffset: 2000; animation: dash 0.6s ease-out forwards; }
`;

function ClassicDiagram({ nodes: rawNodes, edges: rawEdges }: { nodes: DiagramNode[]; edges: DiagramEdge[] }) {
  const { nodes: layouted, edges: styled } = useMemo(() => {
    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: "TB", nodesep: 40, ranksep: 70 });
    rawNodes.forEach((n) => g.setNode(n.id, { width: nodeWidth, height: nodeHeight }));
    rawEdges.forEach((e) => g.setEdge(e.source, e.target));
    dagre.layout(g);

    const nodes = rawNodes.map((n, i) => {
      const pos = g.node(n.id);
      return { ...n, position: { x: pos.x - nodeWidth / 2, y: pos.y - nodeHeight / 2 }, type: "classic", data: { ...n.data, _index: i } };
    });
    const edges = rawEdges.map((e, i) => ({
      ...e,
      type: "smoothstep" as const,
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed, color: "#6366f1" },
      style: { stroke: "#6366f1", strokeWidth: 2, strokeDasharray: "2000", strokeDashoffset: "2000", animation: `dash 0.6s ease-out ${0.1 + i * 0.04}s forwards` },
      labelStyle: { fill: "#94a3b8", fontSize: 10 },
    }));
    return { nodes, edges };
  }, [rawNodes, rawEdges]);

  const [ns, , onNodesChange] = useNodesState(layouted);
  const [es, , onEdgesChange] = useEdgesState(styled);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full h-full">
      <style>{edgeAnimCSS}</style>
      <ReactFlow nodes={ns} edges={es} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} nodeTypes={classicNodeTypes} fitView attributionPosition="bottom-left" colorMode="dark">
        <Background color="#1e293b" gap={20} />
        <Controls className="!bg-[#18181b] !border-slate-800 !rounded-xl" />
        <MiniMap nodeStrokeColor="#6366f1" nodeColor="#1e293b" nodeBorderRadius={8} style={{ background: "#0f0f13", border: "1px solid #1e293b", borderRadius: 12 }} />
      </ReactFlow>
    </motion.div>
  );
}
