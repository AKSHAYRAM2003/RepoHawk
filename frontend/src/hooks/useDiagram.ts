"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface ArchNodeData {
  label: string;
  layer?: string;
  group?: string;
  type?: string;
  description?: string;
  tech?: string;
}

export interface DiagramNode {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data: ArchNodeData;
}

export interface DiagramEdge {
  id: string;
  source: string;
  target: string;
  type?: string;
  animated?: boolean;
  label?: string;
  relation?: string;
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

export function useDiagram(repoId: string, analysisStatus?: string) {
  const [diagram, setDiagram] = useState<Diagram | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDiagram = useCallback(async () => {
    if (!repoId) return null;
    try {
      const res = await fetch(`/api/repos/${repoId}/diagrams`);
      if (!res.ok) return null;
      const data: Diagram[] = await res.json();
      return data.length > 0 ? data[0] : null;
    } catch (err) {
      console.error("Error fetching diagram:", err);
      return null;
    }
  }, [repoId]);

  useEffect(() => {
    if (!repoId) { setLoading(false); return; }
    let cancelled = false;
    let retries = 0;

    async function load() {
      setLoading(true);
      let result = await fetchDiagram();
      // If the diagram isn't found immediately, retry up to 2 times with a 2-second delay
      while (!result && retries < 2) {
        retries++;
        await new Promise((r) => setTimeout(r, 2000));
        if (cancelled) return;
        result = await fetchDiagram();
      }
      if (!cancelled) {
        setDiagram(result);
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [repoId, fetchDiagram, analysisStatus]);

  return { diagram, loading };
}
