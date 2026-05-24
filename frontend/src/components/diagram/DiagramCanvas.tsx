"use client";

import { useMemo } from "react";
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
import type { DiagramEdge, DiagramNode } from "@/hooks/useDiagram";

const nodeWidth = 220;
const nodeHeight = 72;

const NODE_COLORS = [
  { bg: "from-indigo-500/10 to-indigo-600/5", border: "border-indigo-500/30", accent: "bg-indigo-500", text: "text-indigo-400" },
  { bg: "from-emerald-500/10 to-emerald-600/5", border: "border-emerald-500/30", accent: "bg-emerald-500", text: "text-emerald-400" },
  { bg: "from-violet-500/10 to-violet-600/5", border: "border-violet-500/30", accent: "bg-violet-500", text: "text-violet-400" },
  { bg: "from-amber-500/10 to-amber-600/5", border: "border-amber-500/30", accent: "bg-amber-500", text: "text-amber-400" },
  { bg: "from-rose-500/10 to-rose-600/5", border: "border-rose-500/30", accent: "bg-rose-500", text: "text-rose-400" },
  { bg: "from-cyan-500/10 to-cyan-600/5", border: "border-cyan-500/30", accent: "bg-cyan-500", text: "text-cyan-400" },
];

function getNodeStyle(index: number) {
  return NODE_COLORS[index % NODE_COLORS.length];
}

function layoutNodes(nodes: DiagramNode[], edges: DiagramEdge[]) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", nodesep: 50, ranksep: 120, marginx: 40, marginy: 40 });

  nodes.forEach((n) => g.setNode(n.id, { width: nodeWidth, height: nodeHeight }));
  edges.forEach((e) => g.setEdge(e.source, e.target));

  dagre.layout(g);

  return nodes.map((n, i) => {
    const pos = g.node(n.id);
    return {
      ...n,
      position: {
        x: pos.x - nodeWidth / 2,
        y: pos.y - nodeHeight / 2,
      },
      data: { ...n.data, _index: i },
    };
  });
}

function CustomNode({ data }: NodeProps) {
  const label = data.label as string;
  const idx = (data as any)._index as number ?? 0;
  const style = getNodeStyle(idx);
  const name = label.includes(".") ? label.split(".").pop()! : label;
  const module = label.includes(".") ? label.split(".")[0] : "";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.5, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94], delay: idx * 0.04 }}
      className={`relative px-4 py-3 rounded-2xl bg-gradient-to-br ${style.bg} border ${style.border} shadow-lg shadow-black/10 dark:shadow-black/30 backdrop-blur-sm min-w-[200px]`}
    >
      <Handle type="target" position={Position.Left} className={`!w-2.5 !h-2.5 !border-2 !border-slate-800 ${style.accent}`} />
      <div className="flex items-center gap-2.5">
        <div className={`w-2 h-2 rounded-full ${style.accent} shadow-lg ${style.accent.replace("bg-", "shadow-")}/50`} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-slate-100 truncate leading-tight">
            {name}
          </div>
          {module && (
            <div className="text-[10px] font-mono text-slate-500 truncate mt-0.5">
              {module}
            </div>
          )}
        </div>
      </div>
      <Handle type="source" position={Position.Right} className={`!w-2.5 !h-2.5 !border-2 !border-slate-800 ${style.accent}`} />
    </motion.div>
  );
}

const nodeTypes = { custom: CustomNode };

const edgeAnimationStyles = `
@keyframes dashDraw {
  to { stroke-dashoffset: 0; }
}
.react-flow__edge-path {
  stroke-dasharray: 2000;
  stroke-dashoffset: 2000;
  animation: dashDraw 0.8s ease-out forwards;
}
.react-flow__edge:hover .react-flow__edge-path {
  filter: brightness(1.3);
}
`;

export default function DiagramCanvas({
  nodes: rawNodes,
  edges: rawEdges,
}: {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}) {
  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(() => {
    const nodes = layoutNodes(rawNodes, rawEdges);
    const animatedNodes = nodes.map((n) => ({ ...n, type: "custom" }));
    const animatedEdges = rawEdges.map((e, i) => ({
      ...e,
      type: "smoothstep",
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed, width: 24, height: 24, color: "#6366f1" },
      style: {
        stroke: "#6366f1",
        strokeWidth: 2,
        strokeDasharray: "2000",
        strokeDashoffset: "2000",
        animation: `dashDraw 0.7s ease-out ${0.2 + i * 0.05}s forwards`,
      },
      labelStyle: { fill: "#94a3b8", fontSize: 10, fontWeight: 500 },
      labelBgStyle: { fill: "#0f0f13", fillOpacity: 0.8 },
      labelBgPadding: [6, 3] as [number, number],
      labelBgBorderRadius: 4,
    }));
    return { nodes: animatedNodes, edges: animatedEdges };
  }, [rawNodes, rawEdges]);

  const [nodesState, , onNodesChange] = useNodesState(layoutedNodes);
  const [edgesState, , onEdgesChange] = useEdgesState(layoutedEdges);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="w-full h-full"
    >
      <style>{edgeAnimationStyles}</style>
      <ReactFlow
        nodes={nodesState}
        edges={edgesState}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        attributionPosition="bottom-left"
        colorMode="dark"
        minZoom={0.3}
        maxZoom={2}
      >
        <Background color="#1e293b" gap={24} size={1} />
        <Controls showInteractive={false} className="!bg-[#18181b] !border-slate-800 !rounded-xl !shadow-xl [&_button]:!border-slate-700 [&_button]:!text-slate-400 [&_button]:!bg-transparent [&_button:hover]:!bg-slate-800" />
        <MiniMap
          nodeStrokeColor="#6366f1"
          nodeColor="#1e293b"
          nodeBorderRadius={10}
          maskColor="rgba(0,0,0,0.6)"
          style={{ background: "#0f0f13", border: "1px solid #1e293b", borderRadius: 12, boxShadow: "0 4px 24px rgba(0,0,0,0.4)" }}
        />
      </ReactFlow>
    </motion.div>
  );
}
