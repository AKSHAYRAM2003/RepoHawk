"use client";

import { useState, useEffect } from "react";

export interface DiagramNode {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data: { label: string };
}

export interface DiagramEdge {
  id: string;
  source: string;
  target: string;
  type?: string;
  animated?: boolean;
  label?: string;
}

export interface Diagram {
  id: string;
  repo_id: string;
  mermaid_syntax: string;
  reactflow_json: {
    nodes: DiagramNode[];
    edges: DiagramEdge[];
  };
}

export function useDiagram(repoId: string) {
  const [diagram, setDiagram] = useState<Diagram | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!repoId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchDiagram() {
      try {
        const res = await fetch(`/api/repos/${repoId}/diagrams`);
        if (!res.ok) {
          if (res.status !== 404) {
            console.warn(`Diagram fetch failed: HTTP ${res.status}`);
          }
          return;
        }
        const data: Diagram[] = await res.json();
        if (!cancelled && data.length > 0) {
          setDiagram(data[0]);
        }
      } catch (err) {
        console.error("Error fetching diagram:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchDiagram();

    return () => { cancelled = true; };
  }, [repoId]);

  return { diagram, loading };
}
