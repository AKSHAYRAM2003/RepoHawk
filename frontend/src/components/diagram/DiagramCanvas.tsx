"use client";

import { useMemo, useCallback, useRef } from "react";
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

const nodeWidth = 200;
const nodeHeight = 60;

function layoutNodes(nodes: DiagramNode[], edges: DiagramEdge[]) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 60, ranksep: 100 });

  nodes.forEach((n) => g.setNode(n.id, { width: nodeWidth, height: nodeHeight }));
  edges.forEach((e) => g.setEdge(e.source, e.target));

  dagre.layout(g);

  return nodes.map((n) => {
    const pos = g.node(n.id);
    return {
      ...n,
      position: {
        x: pos.x - nodeWidth / 2,
        y: pos.y - nodeHeight / 2,
      },
    };
  });
}

function AnimatedNode({ data }: NodeProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.6, y: 30 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="px-4 py-3 rounded-xl bg-white dark:bg-[#18181b] border border-slate-200 dark:border-slate-700 shadow-lg shadow-slate-200/50 dark:shadow-black/20 min-w-[180px]"
    >
      <Handle type="target" position={Position.Top} className="!bg-indigo-500 !w-2 !h-2" />
      <div className="text-xs font-semibold text-slate-900 dark:text-white truncate text-center">
        {data.label as string}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-indigo-500 !w-2 !h-2" />
    </motion.div>
  );
}

const nodeTypes = { animated: AnimatedNode };

const edgeStyles = `
@keyframes dashDraw {
  to { stroke-dashoffset: 0; }
}
.react-flow__edge-path {
  stroke-dasharray: 2000;
  stroke-dashoffset: 2000;
  animation: dashDraw 0.8s ease-out forwards;
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

    const animatedNodes = nodes.map((n, i) => ({
      ...n,
      type: "animated",
      data: { ...n.data },
    }));

    const animatedEdges = rawEdges.map((e, i) => ({
      ...e,
      type: "smoothstep",
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed, color: "#6366f1" },
      style: { stroke: "#6366f1", strokeWidth: 2, strokeDasharray: "2000", strokeDashoffset: "2000", animation: `dashDraw 0.8s ease-out ${0.3 + i * 0.08}s forwards` },
      labelStyle: { fill: "#94a3b8", fontSize: 11 },
      labelBgStyle: { fill: "transparent" },
      labelBgPadding: [4, 2] as [number, number],
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
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="w-full h-full"
    >
      <style>{edgeStyles}</style>
      <ReactFlow
        nodes={nodesState}
        edges={edgesState}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3, duration: 400 }}
        attributionPosition="bottom-left"
        colorMode="dark"
      >
        <Background color="#1e293b" gap={20} />
        <Controls />
        <MiniMap
          nodeStrokeColor="#6366f1"
          nodeColor="#1e293b"
          nodeBorderRadius={8}
          style={{ background: "#0f0f13", border: "1px solid #1e293b" }}
        />
      </ReactFlow>
    </motion.div>
  );
}
