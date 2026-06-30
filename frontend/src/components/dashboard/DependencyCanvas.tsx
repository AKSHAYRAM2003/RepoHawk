"use client";

import React, { useMemo, useState, useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  Panel,
  ReactFlowProvider,
  type NodeProps,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { 
  Package, FileCode, Search, ExternalLink, Sparkles, BookOpen, Layers, X
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Dep {
  name: string;
  version: string;
  type: "runtime" | "dev" | "peer" | "indirect" | string;
}

interface Manifest {
  file: string;
  ecosystem: string;
  name?: string;
  version?: string;
  dependencies: Dep[];
}

interface DependencyCanvasProps {
  manifests: Manifest[];
  search: string;
  repoId: string;
}

// ── Custom Node Renderers ─────────────────────────────────────────────────────

const appNodeStyle = {
  width: 160,
  padding: "12px 14px",
  borderRadius: 14,
  background: "linear-gradient(135deg, #1e1b4b 0%, #0d0e16 100%)",
  border: "1.5px solid #6366f1",
  boxShadow: "0 0 16px rgba(99, 102, 241, 0.25)",
  color: "#f1f5f9",
  fontFamily: "system-ui, sans-serif",
  textAlign: "center" as const,
};

function AppNode({ data }: NodeProps & { data: { label: string } }) {
  return (
    <div style={appNodeStyle}>
      <Handle type="source" position={Position.Right} style={{ background: "#6366f1", width: 8, height: 8 }} />
      <div style={{ fontSize: 9, fontWeight: 800, color: "#818cf8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>
        Repository
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {data.label}
      </div>
    </div>
  );
}

function ManifestNode({ data }: NodeProps & { data: { file: string; ecosystem: string; count: number } }) {
  const isNpm = data.ecosystem === "npm";
  const ecoColor = isNpm ? "#f59e0b" : data.ecosystem === "pip" ? "#3b82f6" : "#06b6d4";
  return (
    <div
      style={{
        width: 180,
        padding: "10px 12px",
        borderRadius: 12,
        background: "rgba(13, 14, 22, 0.95)",
        border: `1.5px solid ${ecoColor}60`,
        boxShadow: `0 4px 20px rgba(0, 0, 0, 0.4)`,
        color: "#f1f5f9",
        fontFamily: "system-ui, sans-serif",
        position: "relative",
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: ecoColor, width: 6, height: 6 }} />
      <Handle type="source" position={Position.Right} style={{ background: ecoColor, width: 6, height: 6 }} />
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{
          width: 24, height: 24, borderRadius: 6,
          background: `${ecoColor}15`, border: `1px solid ${ecoColor}30`,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: ecoColor, fontSize: 10, fontWeight: 800, flexShrink: 0
        }}>
          <span style={{ margin: "auto" }}>{data.ecosystem.toUpperCase()}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {data.file}
          </div>
          <div style={{ fontSize: 9, color: "var(--on-surface-variant)", opacity: 0.8, marginTop: 2 }}>
            {data.count} dependencies
          </div>
        </div>
      </div>
    </div>
  );
}

const TYPE_COLORS: Record<string, string> = {
  runtime: "#10b981",
  dev: "#8b5cf6",
  peer: "#f59e0b",
  indirect: "#64748b",
};

function DepNode({ data, selected }: NodeProps & { data: { name: string; version: string; type: string } }) {
  const typeColor = TYPE_COLORS[data.type] ?? TYPE_COLORS.runtime;
  return (
    <div
      style={{
        width: 200,
        padding: "8px 10px",
        borderRadius: 10,
        background: selected ? "rgba(18, 20, 34, 0.98)" : "rgba(13, 14, 22, 0.95)",
        border: `1.2px solid ${selected ? "#818cf8" : `${typeColor}40`}`,
        boxShadow: selected 
          ? `0 0 12px 2px rgba(129, 140, 248, 0.3), 0 4px 16px rgba(0,0,0,0.6)` 
          : `0 2px 10px rgba(0, 0, 0, 0.45)`,
        color: "#f1f5f9",
        fontFamily: "system-ui, sans-serif",
        cursor: "pointer",
        transition: "border-color 0.15s, box-shadow 0.15s",
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: typeColor, width: 6, height: 6 }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {data.name}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 3 }}>
            <span style={{
              fontSize: 8, fontWeight: 800, textTransform: "uppercase",
              padding: "1px 4px", borderRadius: 3,
              background: `${typeColor}15`, color: typeColor, border: `1px solid ${typeColor}25`
            }}>
              {data.type}
            </span>
            {data.version && (
              <span style={{ fontSize: 9, fontFamily: "monospace", color: "var(--on-surface-variant)", opacity: 0.7 }}>
                {data.version}
              </span>
            )}
          </div>
        </div>
        <Package size={12} style={{ color: "var(--on-surface-variant)", opacity: 0.5, flexShrink: 0 }} />
      </div>
    </div>
  );
}

const nodeTypes = {
  appNode: AppNode,
  manifestNode: ManifestNode,
  depNode: DepNode,
};

// ── Main Canvas Component ─────────────────────────────────────────────────────

function DependencyCanvasInner({ manifests, search, repoId }: DependencyCanvasProps) {
  const [selectedDep, setSelectedDep] = useState<{ dep: Dep; ecosystem: string } | null>(null);

  // Generate nodes & edges
  const { nodes, edges } = useMemo(() => {
    const rawNodes: any[] = [];
    const rawEdges: Edge[] = [];

    // 1. App central node
    rawNodes.push({
      id: "app-root",
      type: "appNode",
      position: { x: 40, y: 220 },
      data: { label: repoId.slice(0, 12) },
    });

    let currentManifestY = 50;
    const manifestSpacing = 160;
    const depSpacing = 55;

    // Filter and process manifests
    manifests.forEach((manifest, mIdx) => {
      const manifestId = `m-${mIdx}`;
      const ecoColor = manifest.ecosystem === "npm" ? "#f59e0b" : manifest.ecosystem === "pip" ? "#3b82f6" : "#06b6d4";

      // Match search query
      const filteredDeps = manifest.dependencies.filter((d) =>
        !search || d.name.toLowerCase().includes(search.toLowerCase())
      );

      // Node for manifest
      rawNodes.push({
        id: manifestId,
        type: "manifestNode",
        position: { x: 260, y: currentManifestY + 50 },
        data: {
          file: manifest.file,
          ecosystem: manifest.ecosystem,
          count: manifest.dependencies.length,
        },
      });

      // Edge App -> Manifest
      rawEdges.push({
        id: `e-app-${manifestId}`,
        source: "app-root",
        target: manifestId,
        animated: true,
        style: { stroke: "#6366f1", strokeWidth: 1.5 },
      });

      // Render deps (cap visual tree to top 30 to keep it performing and clean)
      const visibleDeps = filteredDeps.slice(0, 35);
      const startDepY = currentManifestY;

      visibleDeps.forEach((dep, dIdx) => {
        const depId = `d-${mIdx}-${dIdx}`;
        const typeColor = TYPE_COLORS[dep.type] ?? TYPE_COLORS.runtime;

        rawNodes.push({
          id: depId,
          type: "depNode",
          position: { x: 500, y: startDepY + dIdx * depSpacing },
          data: {
            name: dep.name,
            version: dep.version,
            type: dep.type,
            ecosystem: manifest.ecosystem,
            rawDep: dep,
          },
        });

        // Edge Manifest -> Dep
        rawEdges.push({
          id: `e-${manifestId}-${depId}`,
          source: manifestId,
          target: depId,
          style: { stroke: `${ecoColor}40`, strokeWidth: 1.2 },
        });
      });

      // If capped, show a "more indicator" node
      if (filteredDeps.length > 35) {
        const moreId = `d-${mIdx}-more`;
        rawNodes.push({
          id: moreId,
          type: "output",
          position: { x: 500, y: startDepY + 35 * depSpacing },
          data: { label: `+ ${filteredDeps.length - 35} more packages (use search to find)` },
          style: {
            width: 200,
            fontSize: 10,
            fontStyle: "italic",
            color: "var(--on-surface-variant)",
            background: "rgba(255,255,255,0.03)",
            border: "1px dashed var(--outline-variant)",
            borderRadius: 8,
            padding: "6px 10px",
            textAlign: "center" as const,
          },
        });

        rawEdges.push({
          id: `e-${manifestId}-${moreId}`,
          source: manifestId,
          target: moreId,
          style: { stroke: "var(--outline-variant)", strokeDasharray: "4 4", strokeWidth: 1 },
        });
      }

      // Height logic to prevent overlap between multiple manifests
      const manifestHeight = Math.max(120, visibleDeps.length * depSpacing + 40);
      currentManifestY += manifestHeight;
    });

    return { nodes: rawNodes, edges: rawEdges };
  }, [manifests, search, repoId]);

  const [nodesState, , onNodesChange] = useNodesState(nodes);
  const [edgesState, , onEdgesChange] = useEdgesState(edges);

  // Sync ReactFlow internal states with memo updates
  React.useEffect(() => {
    // Note: To avoid mutating coordinate updates while dragging, we re-apply when nodes list changes
  }, [nodes]);

  const onNodeClick = useCallback((_: any, node: any) => {
    if (node.type === "depNode") {
      setSelectedDep({
        dep: node.data.rawDep,
        ecosystem: node.data.ecosystem,
      });
    } else {
      setSelectedDep(null);
    }
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedDep(null);
  }, []);

  // Registry URLs
  const getRegistryUrl = (name: string, eco: string) => {
    if (eco === "npm") return `https://www.npmjs.com/package/${name}`;
    if (eco === "pip") return `https://pypi.org/project/${name}`;
    return `https://pkg.go.dev/${name}`;
  };

  const handleSearchInCode = (name: string) => {
    window.dispatchEvent(
      new CustomEvent("repohawk-trigger-search", {
        detail: { prefilledQuery: name }
      })
    );
  };

  const handleAskAIAboutLib = (name: string, eco: string) => {
    const ecoLabel = eco === "npm" ? "npm Node.js" : eco === "pip" ? "Python pip" : "Go module";
    const prompt = `Can you explain the purpose of the "${name}" library (ecosystem: ${ecoLabel})? What does it do, and what are typical use cases or components in this repository that might depend on it?`;
    window.dispatchEvent(
      new CustomEvent("repohawk-ask-ai-about-node", {
        detail: {
          nodeId: "",
          nodeLabel: "",
          question: prompt,
        }
      })
    );
  };

  return (
    <div style={{ display: "flex", width: "100%", height: "100%", position: "relative" }}>
      {/* ReactFlow Canvas */}
      <div style={{ flex: 1, height: "100%" }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          minZoom={0.25}
          maxZoom={1.5}
        >
          <Background color="#1e293b" size={1.5} style={{ opacity: 0.15 }} />
          <Controls style={{ background: "var(--surface-container-high)", border: "1px solid var(--outline-variant)", borderRadius: 8, color: "var(--on-surface)" }} />
          <MiniMap
            style={{ background: "#0d0e16", border: "1px solid var(--outline-variant)", borderRadius: 10 }}
            maskColor="rgba(0, 0, 0, 0.4)"
            nodeColor={(n) => {
              if (n.type === "appNode") return "#6366f1";
              if (n.type === "manifestNode") return "#10b981";
              return "#38bdf8";
            }}
          />
          <Panel position="bottom-center" style={{ background: "rgba(10,11,20,0.92)", border: "1px solid var(--outline-variant)", padding: "6px 12px", borderRadius: 8, fontSize: 10, display: "flex", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: TYPE_COLORS.runtime }} /> Runtime
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: TYPE_COLORS.dev }} /> Dev
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: TYPE_COLORS.indirect }} /> Indirect
            </div>
          </Panel>
        </ReactFlow>
      </div>

      {/* Selected Dep Side Info Card (Drawer style on right) */}
      {selectedDep && (
        <div
          style={{
            width: 280,
            background: "var(--surface-container-high)",
            borderLeft: "1px solid var(--outline-variant)",
            padding: "18px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
            zIndex: 10,
            overflowY: "auto",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: "rgba(16,185,129,0.12)", color: "#10b981",
                display: "flex", alignItems: "center", justifyContent: "center"
              }}>
                <Package size={14} />
              </div>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--on-surface)", margin: 0, fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 }}>
                {selectedDep.dep.name}
              </h3>
            </div>
            <button
              onClick={() => setSelectedDep(null)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--on-surface-variant)", opacity: 0.6 }}
            >
              <X size={14} />
            </button>
          </div>

          <div style={{ borderTop: "1px solid var(--outline-variant)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <span style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", color: "var(--on-surface-variant)" }}>Ecosystem</span>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--on-surface)", marginTop: 2 }}>{selectedDep.ecosystem.toUpperCase()}</div>
            </div>
            <div>
              <span style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", color: "var(--on-surface-variant)" }}>Version</span>
              <div style={{ fontSize: 11, fontFamily: "monospace", color: "var(--on-surface)", marginTop: 2 }}>{selectedDep.dep.version || "Unknown"}</div>
            </div>
            <div>
              <span style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", color: "var(--on-surface-variant)" }}>Dependency Type</span>
              <div style={{ fontSize: 11, color: "var(--on-surface)", marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: TYPE_COLORS[selectedDep.dep.type] || TYPE_COLORS.runtime }} />
                {selectedDep.dep.type.toUpperCase()}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: "auto" }}>
            <a
              href={getRegistryUrl(selectedDep.dep.name, selectedDep.ecosystem)}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "8px 12px", borderRadius: 8,
                background: "color-mix(in srgb, var(--on-surface) 6%, transparent)",
                color: "var(--on-surface)", fontSize: 11, fontWeight: 600, textDecoration: "none",
                transition: "background 0.15s"
              }}
            >
              <ExternalLink size={12} />
              Open Package Registry
            </a>

            <button
              onClick={() => handleSearchInCode(selectedDep.dep.name)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "8px 12px", borderRadius: 8,
                background: "color-mix(in srgb, var(--on-surface) 6%, transparent)",
                border: "none", color: "var(--on-surface)", fontSize: 11, fontWeight: 600,
                cursor: "pointer", transition: "background 0.15s"
              }}
            >
              <Search size={12} />
              Search occurrences
            </button>

            <button
              onClick={() => handleAskAIAboutLib(selectedDep.dep.name, selectedDep.ecosystem)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "8px 12px", borderRadius: 8,
                background: "linear-gradient(135deg, #4a50c5, #00b08a)",
                border: "none", color: "white", fontSize: 11, fontWeight: 600,
                cursor: "pointer", transition: "opacity 0.15s"
              }}
            >
              <Sparkles size={12} />
              Ask AI about library
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DependencyCanvas(props: DependencyCanvasProps) {
  return (
    <ReactFlowProvider>
      <DependencyCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
