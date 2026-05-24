"use client";

import { useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "dagre";
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

export default function DiagramCanvas({
  nodes: rawNodes,
  edges: rawEdges,
}: {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}) {
  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(() => {
    const nodes = layoutNodes(rawNodes, rawEdges);
    const edges = rawEdges.map((e) => ({
      ...e,
      type: "smoothstep",
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { stroke: "#6366f1", strokeWidth: 2 },
      labelStyle: { fill: "#94a3b8", fontSize: 11 },
    }));
    return { nodes, edges };
  }, [rawNodes, rawEdges]);

  const [nodesState, , onNodesChange] = useNodesState(layoutedNodes);
  const [edgesState, , onEdgesChange] = useEdgesState(layoutedEdges);

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodesState}
        edges={edgesState}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
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
    </div>
  );
}
