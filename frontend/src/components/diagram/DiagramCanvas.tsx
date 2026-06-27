"use client";

import { useMemo } from "react";
import type { DiagramNode, DiagramEdge } from "@/hooks/useDiagram";
import LayeredArchitecture from "./LayeredArchitecture";

/**
 * DiagramCanvas — always uses the new AWS-style LayeredArchitecture renderer.
 * Legacy classic diagram removed; all repos now use the full-featured canvas.
 */
export default function DiagramCanvas({
  nodes,
  edges,
  repoName,
}: {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  repoName?: string;
}) {
  // Ensure every node has layer data (fallback to "core-services")
  const normalizedNodes = useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        data: {
          ...n.data,
          layer: n.data.layer ?? "core-services",
        },
      })),
    [nodes]
  );

  return <LayeredArchitecture nodes={normalizedNodes} edges={edges} repoName={repoName} />;
}
