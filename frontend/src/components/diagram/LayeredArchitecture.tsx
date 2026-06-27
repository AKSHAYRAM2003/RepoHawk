"use client";

import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import {
  ReactFlow,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  BackgroundVariant,
  Panel,
  useReactFlow,
  ReactFlowProvider,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, X, Layers, ZoomIn, ZoomOut, Maximize2, Minimize2,
  RotateCcw, Info, Grid3x3, Download, Check,
} from "lucide-react";
import { toPng } from "html-to-image";
import AwsArchNode from "./AwsArchNode";
import AwsFlowEdge from "./AwsFlowEdge";
import MetadataPanel from "./MetadataPanel";
import type { DiagramNode, DiagramEdge, ArchNodeData } from "@/hooks/useDiagram";

const edgeTypes = { awsEdge: AwsFlowEdge };

// ── Layer configuration ────────────────────────────────────────────────────────
const LAYER_CONFIG: Record<string, {
  label: string; borderColor: string; bgColor: string; accentColor: string; shortLabel: string;
}> = {
  "dev-tools":      { label: "Dev Tools",        shortLabel: "DEV", borderColor: "rgba(100,116,139,0.35)", bgColor: "rgba(30,41,59,0.2)",      accentColor: "#64748b" },
  applications:     { label: "Applications",     shortLabel: "APP", borderColor: "rgba(245,158,11,0.4)",   bgColor: "rgba(245,158,11,0.05)",   accentColor: "#f59e0b" },
  "core-services":  { label: "Core Services",    shortLabel: "API", borderColor: "rgba(16,185,129,0.4)",   bgColor: "rgba(16,185,129,0.05)",   accentColor: "#10b981" },
  "business-logic": { label: "Business Logic",   shortLabel: "BIZ", borderColor: "rgba(99,102,241,0.4)",   bgColor: "rgba(99,102,241,0.05)",   accentColor: "#6366f1" },
  "data-storage":   { label: "Data Storage",     shortLabel: "DB",  borderColor: "rgba(6,182,212,0.4)",    bgColor: "rgba(6,182,212,0.05)",    accentColor: "#06b6d4" },
  external:         { label: "External Systems", shortLabel: "EXT", borderColor: "rgba(236,72,153,0.4)",   bgColor: "rgba(236,72,153,0.05)",   accentColor: "#ec4899" },
};

const LAYER_ORDER = [
  "dev-tools", "applications", "core-services",
  "business-logic", "data-storage", "external",
];

// ── Layout constants ───────────────────────────────────────────────────────────
const NODE_W        = 224;
const NODE_H        = 112;
const COL_GAP       = 100;  // horizontal space between columns — edge routing corridor
const ROW_GAP       = 64;   // vertical space between nodes — edge routing lane
const LAYER_PAD_X   = 24;
const LAYER_PAD_TOP = 52;   // header height
const LAYER_PAD_BOT = 28;
const CANVAS_TOP    = 20;   // all groups start at this y

// ── Build LANDSCAPE layout ─────────────────────────────────────────────────────
//
//  Z-INDEX STACKING (from bottom to top):
//  [0] Group containers (big colored boxes) — edges appear ABOVE these
//  [5] Edges — lines pass THROUGH big boxes, are HIDDEN behind small cards
//  [6] Layer header labels — above edges
//  [20] Individual archNode cards — edges hidden behind these (fully opaque)
//  [30] Edge labels (inline ───[text]─── pills) — always on top
//
function buildLayout(rawNodes: DiagramNode[], rawEdges: DiagramEdge[]) {
  const byLayer = new Map<string, DiagramNode[]>();
  for (const n of rawNodes) {
    const layer = n.data.layer ?? "core-services";
    if (!byLayer.has(layer)) byLayer.set(layer, []);
    byLayer.get(layer)!.push(n);
  }

  const orderedLayers: string[] = [];
  for (const l of LAYER_ORDER) if (byLayer.has(l)) orderedLayers.push(l);
  for (const [k] of byLayer) if (!orderedLayers.includes(k)) orderedLayers.push(k);

  const resultNodes: Node[] = [];
  let currentX = 16;

  // ── Label placement support ────────────────────────────────────────────────
  // nodePositions: absolute canvas {x,y} of each archNode (top-left corner)
  // nodeCorridorX: centerX of the inter-column gap immediately after each node
  const nodePositions = new Map<string, { x: number; y: number }>();
  const nodeCorridorX = new Map<string, number>();

  for (const layerName of orderedLayers) {
    const layerNodes = byLayer.get(layerName)!;
    const cfg = LAYER_CONFIG[layerName] ?? LAYER_CONFIG["core-services"];

    const layerH =
      LAYER_PAD_TOP +
      layerNodes.length * NODE_H +
      Math.max(0, layerNodes.length - 1) * ROW_GAP +
      LAYER_PAD_BOT;
    const layerW = LAYER_PAD_X * 2 + NODE_W;

    // ── 1. Background group container (zIndex: 0) ──────────────────────────
    // Edges (zIndex:5) render ABOVE this, so lines appear to "pass through" it
    resultNodes.push({
      id: `layer-group-${layerName}`,
      type: "group",
      position: { x: currentX, y: CANVAS_TOP },
      style: {
        width: layerW,
        height: layerH,
        background: cfg.bgColor,
        border: `1.5px solid ${cfg.borderColor}`,
        borderRadius: 18,
        pointerEvents: "none",
      },
      data: { label: cfg.label },
      selectable: false,
      draggable: false,
      zIndex: 0,   // BELOW edges — lines visually cross the container box
    } as any);

    // ── 2. Layer header label (zIndex: 6) ──────────────────────────────────
    // Positioned at the top of the group — above edges so text is readable
    resultNodes.push({
      id: `layer-label-${layerName}`,
      type: "layerLabel",
      position: { x: currentX + LAYER_PAD_X, y: CANVAS_TOP + 14 },
      data: {
        label: cfg.label,
        accentColor: cfg.accentColor,
        count: layerNodes.length,
        shortLabel: cfg.shortLabel,
      },
      selectable: false,
      draggable: false,
      zIndex: 6,
    } as any);

    // ── 3. Individual component cards (zIndex: 20, NO parentId) ───────────
    //
    //  KEY FIX: No parentId means these nodes have GLOBAL z-index comparison.
    //  With parentId, z-index is trapped in the parent's stacking context,
    //  making zIndex:20 lose to edges at zIndex:5. Without parentId, zIndex:20
    //  wins globally → cards appear ABOVE edges → lines hidden behind cards.
    //
    // Center X of the gap/corridor immediately after this column — used for label placement
    const nextCorridorX = currentX + layerW + COL_GAP / 2;
    layerNodes.forEach((n, i) => {
      const pos = {
        x: currentX + LAYER_PAD_X,
        y: CANVAS_TOP + LAYER_PAD_TOP + i * (NODE_H + ROW_GAP),
      };
      nodePositions.set(n.id, pos);
      nodeCorridorX.set(n.id, nextCorridorX);
      resultNodes.push({
        ...n,
        type: "archNode",
        // NO parentId — absolute canvas position for global z-index to work
        position: pos,
        draggable: false,
        style: { width: NODE_W, height: NODE_H },
        zIndex: 20,  // ABOVE edges (5) — card blocks the line visually ✓
      } as any);
    });

    currentX += layerW + COL_GAP;
  }

  // ── Label slot allocator ───────────────────────────────────────────────────
  // Labels are placed in the inter-column corridor after the source node.
  // claimLabelY() ensures each label in a corridor gets a unique Y slot so
  // labels never overlap each other OR land on top of node cards.
  const LABEL_SLOT_H = 30; // label height (≈18px) + 12px breathing room
  const corridorSlots = new Map<number, number[]>(); // corrX → [used Y values]

  function claimLabelY(corrX: number, desiredY: number): number {
    if (!corridorSlots.has(corrX)) corridorSlots.set(corrX, []);
    const slots = corridorSlots.get(corrX)!;
    // Try desired Y first, then alternate above/below expanding outward
    let y = desiredY;
    let step = LABEL_SLOT_H;
    let flip = 1;
    for (let attempt = 0; attempt < 40; attempt++) {
      if (slots.every((sy) => Math.abs(sy - y) >= LABEL_SLOT_H)) {
        slots.push(y);
        return y;
      }
      y = desiredY + flip * step;
      flip = -flip;
      if (flip === 1) step += LABEL_SLOT_H;
    }
    const fallback = desiredY + slots.length * LABEL_SLOT_H;
    slots.push(fallback);
    return fallback;
  }

  // ── Edges (zIndex: 5) ─────────────────────────────────────────────────────
  // Above group containers (0) → visible passing through big boxes
  // Below individual cards (20)  → hidden behind small cards
  //
  // MULTI-EDGE OFFSET: When multiple edges arrive at / leave from the same
  // node handle, they would all share the exact same point and overlap.
  // We fix this by spreading them across evenly-spaced lanes within the
  // card height, passed as `sourceOffsetY` / `targetOffsetY` in data.
  //
  const incomingEdges  = new Map<string, number>();
  const outgoingEdges  = new Map<string, number>();
  const incomingTotal  = new Map<string, number>();
  const outgoingTotal  = new Map<string, number>();

  for (const e of rawEdges) {
    incomingTotal.set(e.target, (incomingTotal.get(e.target) ?? 0) + 1);
    outgoingTotal.set(e.source, (outgoingTotal.get(e.source) ?? 0) + 1);
  }

  const resultEdges: Edge[] = rawEdges.map((e, i) => {
    const relation   = e.relation ?? "control-flow";
    const isDataFlow = relation === "data-flow";
    const isBuildDep = relation === "build-dep";
    const color      = isDataFlow ? "#10b981" : isBuildDep ? "#64748b" : "#6366f1";

    // ── Fan-out offsets: spread multiple edges per handle vertically ──────
    const tTotal = incomingTotal.get(e.target) ?? 1;
    const tIdx   = incomingEdges.get(e.target) ?? 0;
    incomingEdges.set(e.target, tIdx + 1);

    const sTotal = outgoingTotal.get(e.source) ?? 1;
    const sIdx   = outgoingEdges.get(e.source) ?? 0;
    outgoingEdges.set(e.source, sIdx + 1);

    const laneH   = NODE_H - 40;  // 72px usable height within the card
    const tOffset = tTotal <= 1 ? 0 : (tIdx / (tTotal - 1) - 0.5) * laneH;
    const sOffset = sTotal <= 1 ? 0 : (sIdx / (sTotal - 1) - 0.5) * laneH;

    // ── Label position: always in the corridor AFTER the source column ────
    // This guarantees labels never land on node cards or other labels.
    const edgeLabel = e.label as string | undefined;
    let labelPos: { x: number; y: number } | undefined;
    if (edgeLabel?.trim() && nodePositions.has(e.source) && nodePositions.has(e.target)) {
      const sp    = nodePositions.get(e.source)!;
      const tp    = nodePositions.get(e.target)!;
      const corrX = nodeCorridorX.get(e.source);
      if (corrX !== undefined) {
        const srcHandleY = sp.y + NODE_H / 2 + sOffset;
        const tgtHandleY = tp.y + NODE_H / 2 + tOffset;
        const desiredY   = (srcHandleY + tgtHandleY) / 2;
        const placedY    = claimLabelY(corrX, desiredY);
        labelPos = { x: corrX, y: placedY };
      }
    }

    return {
      ...e,
      id: e.id ?? `e-${e.source}-${e.target}-${i}`,
      type: "awsEdge",
      animated: false,
      sourceHandle: "right",
      targetHandle: "left",
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 14,
        height: 14,
        color,
      },
      data: {
        relation,
        animated: isDataFlow,
        label: e.label,
        sourceOffsetY: sOffset,
        targetOffsetY: tOffset,
        labelPos,           // explicit corridor position — avoids card overlap
      },
      label: e.label,
      style: {
        strokeWidth: isDataFlow ? 2.5 : 2,
        stroke: color,
        strokeDasharray: isBuildDep ? "6 4" : undefined,
        opacity: 1,
      },
      zIndex: 5,
    };
  });

  return { nodes: resultNodes, edges: resultEdges };
}

// ── Layer label node ──────────────────────────────────────────────────────────
function LayerLabelNode({ data }: any) {
  const { label, accentColor, count, shortLabel } = data;
  return (
    <div style={{ pointerEvents: "none", display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
      <div
        style={{
          padding: "2px 7px",
          borderRadius: 5,
          background: `${accentColor}20`,
          border: `1px solid ${accentColor}50`,
          fontSize: 9,
          fontWeight: 800,
          letterSpacing: "0.12em",
          textTransform: "uppercase" as const,
          color: accentColor,
          flexShrink: 0,
        }}
      >
        {shortLabel}
      </div>
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.05em",
          color: accentColor,
          opacity: 0.9,
          textTransform: "uppercase" as const,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 9,
          fontWeight: 600,
          color: "rgba(255,255,255,0.4)",
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 5,
          padding: "0 5px",
          lineHeight: 1.6,
        }}
      >
        {count}
      </span>
    </div>
  );
}

const allNodeTypes = { archNode: AwsArchNode, layerLabel: LayerLabelNode };

// ── Legend ─────────────────────────────────────────────────────────────────────
const LEGEND_NODES = [
  { icon: "◈", color: "#f59e0b", label: "Application" },
  { icon: "⬡", color: "#10b981", label: "Core Service" },
  { icon: "⬢", color: "#8b5cf6", label: "Package" },
  { icon: "◎", color: "#3b82f6", label: "Agent / Module" },
  { icon: "⬙", color: "#06b6d4", label: "Database" },
  { icon: "⬖", color: "#ec4899", label: "External" },
  { icon: "▣", color: "#64748b", label: "Infrastructure" },
];

const LEGEND_EDGES = [
  { color: "#10b981", dash: false, label: "Data Flow" },
  { color: "#6366f1", dash: false, label: "Control Flow" },
  { color: "#64748b", dash: true,  label: "Build Dep" },
];

function DiagramLegend() {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        title="Toggle Legend"
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "5px 10px",
          background: "rgba(10,11,20,0.94)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: open ? "9px 9px 0 0" : "9px",
          color: "#94a3b8", fontSize: 10, fontWeight: 700,
          letterSpacing: "0.08em", cursor: "pointer",
          backdropFilter: "blur(12px)", textTransform: "uppercase",
        }}
      >
        <Grid3x3 size={11} />
        Legend
        {open && <X size={10} style={{ marginLeft: 2 }} />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4, scaleY: 0.95 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            exit={{ opacity: 0, y: 4, scaleY: 0.95 }}
            transition={{ duration: 0.12 }}
            style={{
              background: "rgba(10,11,20,0.96)", border: "1px solid rgba(255,255,255,0.1)",
              borderTop: "none", borderRadius: "0 9px 9px 9px",
              padding: "12px 14px", backdropFilter: "blur(14px)",
              display: "flex", gap: 16,
              boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
            }}
          >
            <div>
              <p style={{ fontSize: 8, fontWeight: 800, letterSpacing: "0.1em", color: "#475569", textTransform: "uppercase", marginBottom: 7 }}>
                Component Types
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {LEGEND_NODES.map((item) => (
                  <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <div style={{ width: 20, height: 20, borderRadius: 6, background: `${item.color}18`, border: `1px solid ${item.color}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: item.color, flexShrink: 0 }}>
                      {item.icon}
                    </div>
                    <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 500, whiteSpace: "nowrap" }}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ width: 1, background: "rgba(255,255,255,0.06)", alignSelf: "stretch" }} />
            <div>
              <p style={{ fontSize: 8, fontWeight: 800, letterSpacing: "0.1em", color: "#475569", textTransform: "uppercase", marginBottom: 7 }}>
                Connection Types
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {LEGEND_EDGES.map((et) => (
                  <div key={et.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <svg width="28" height="10" viewBox="0 0 28 10" style={{ flexShrink: 0 }}>
                      <line x1="0" y1="5" x2="20" y2="5" stroke={et.color} strokeWidth="2" strokeDasharray={et.dash ? "5 3" : undefined} />
                      <polygon points="20,2 28,5 20,8" fill={et.color} />
                    </svg>
                    <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 500, whiteSpace: "nowrap" }}>{et.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Custom Controls ───────────────────────────────────────────────────────────
function DiagramControls({
  containerRef,
  onExport,
  isExporting,
  exported,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  onExport: () => void;
  isExporting: boolean;
  exported: boolean;
}) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) containerRef.current?.requestFullscreen?.();
    else document.exitFullscreen?.();
  }, [containerRef]);

  const btn: React.CSSProperties = {
    width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
    background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer",
    borderRadius: 7, transition: "background 0.15s, color 0.15s",
  };

  const controls = [
    { icon: <ZoomIn size={14} />,     title: "Zoom in",        action: () => zoomIn({ duration: 200 }) },
    { icon: <ZoomOut size={14} />,    title: "Zoom out",       action: () => zoomOut({ duration: 200 }) },
    { icon: <RotateCcw size={13} />,  title: "Fit view",       action: () => fitView({ padding: 0.1, duration: 400 }) },
    { icon: isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />, title: isFullscreen ? "Exit fullscreen" : "Fullscreen (F)", action: toggleFullscreen },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, background: "rgba(10,11,20,0.92)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: 4, backdropFilter: "blur(12px)", boxShadow: "0 4px 20px rgba(0,0,0,0.5)" }}>
      {controls.map((c, i) => (
        <button key={i} title={c.title} style={btn} onClick={c.action}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "white"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}
        >{c.icon}</button>
      ))}
      {/* Divider */}
      <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "2px 4px" }} />
      {/* Export PNG */}
      <button
        title={exported ? "Exported!" : isExporting ? "Exporting…" : "Export as PNG"}
        onClick={onExport}
        disabled={isExporting}
        style={{
          ...btn,
          color: exported ? "#10b981" : isExporting ? "#6366f1" : "#94a3b8",
          opacity: isExporting ? 0.7 : 1,
        }}
        onMouseEnter={(e) => { if (!isExporting) { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = exported ? "#10b981" : "white"; } }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = exported ? "#10b981" : isExporting ? "#6366f1" : "rgba(255,255,255,0.6)"; }}
      >
        {exported ? <Check size={13} /> : isExporting
          ? <div style={{ width: 13, height: 13, border: "2px solid #6366f1", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
          : <Download size={13} />}
      </button>
    </div>
  );
}

// ── Search ────────────────────────────────────────────────────────────────────
function DiagramSearch({ query, onChange, onClear }: { query: string; onChange: (v: string) => void; onClear: () => void }) {
  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
      <Search size={11} style={{ position: "absolute", left: 9, color: "#475569", pointerEvents: "none" }} />
      <input
        value={query} onChange={(e) => onChange(e.target.value)} placeholder="Search components…"
        style={{ paddingLeft: 26, paddingRight: query ? 28 : 10, paddingTop: 6, paddingBottom: 6, fontSize: 11, fontWeight: 500, background: "rgba(10,11,20,0.92)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#e2e8f0", outline: "none", width: 180, backdropFilter: "blur(12px)" }}
        onFocus={(e) => (e.target.style.borderColor = "rgba(99,102,241,0.6)")}
        onBlur={(e)  => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
      />
      {query && (
        <button onClick={onClear} style={{ position: "absolute", right: 7, background: "none", border: "none", cursor: "pointer", color: "#475569", display: "flex", alignItems: "center" }}>
          <X size={10} />
        </button>
      )}
    </div>
  );
}

// ── Inner canvas ──────────────────────────────────────────────────────────────
function DiagramInner({ rawNodes, rawEdges, containerRef, repoName }: {
  rawNodes: DiagramNode[];
  rawEdges: DiagramEdge[];
  containerRef: React.RefObject<HTMLDivElement | null>;
  repoName?: string;
}) {
  const [selectedNode, setSelectedNode] = useState<{ id: string; data: ArchNodeData } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exported, setExported] = useState(false);
  const reactFlowWrapperRef = useRef<HTMLDivElement>(null);
  const { fitView } = useReactFlow();

  // ── PNG Export ─────────────────────────────────────────────────────────────
  const handleExport = useCallback(async () => {
    const el = reactFlowWrapperRef.current;
    if (!el || isExporting) return;
    setIsExporting(true);
    try {
      // Step 1: fit the entire diagram into view so nothing is cropped
      fitView({ padding: 0.08, duration: 200 });
      // Step 2: wait for the fitView animation to finish before capturing
      await new Promise((r) => setTimeout(r, 350));

      // Step 3: capture at 4× device pixel ratio for crisp output
      const dataUrl = await toPng(el, {
        backgroundColor: "#080a12",
        pixelRatio: 4,          // 4× = ~300 DPI quality; stays sharp when zoomed
        cacheBust: true,        // avoid stale cached images
        filter: (node) => {
          // Strip UI chrome — controls, minimap, search bar
          if (node.classList?.contains("react-flow__panel")) return false;
          if (node.classList?.contains("react-flow__minimap")) return false;
          if (node.classList?.contains("react-flow__controls")) return false;
          return true;
        },
      });

      // Step 4: trigger download
      const link = document.createElement("a");
      link.download = `repohawk-${repoName ?? "diagram"}-architecture.png`;
      link.href = dataUrl;
      link.click();

      setExported(true);
      setTimeout(() => setExported(false), 2000);
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setIsExporting(false);
    }
  }, [isExporting, repoName, fitView]);

  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(
    () => buildLayout(rawNodes, rawEdges),
    [rawNodes, rawEdges],
  );

  const displayNodes = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return layoutedNodes.map((n) => {
      if (n.type !== "archNode") return n;
      const label = ((n.data as any)?.label ?? "") as string;
      const desc  = ((n.data as any)?.description ?? "") as string;

      // Search dimming
      const searchDim = q && !(label.toLowerCase().includes(q) || desc.toLowerCase().includes(q));

      // Highlight glow: pulse ring on the QA-referenced node
      const isHighlighted = n.id === highlightedNodeId;
      const highlightStyle = isHighlighted
        ? {
            boxShadow: "0 0 0 3px #6366f1, 0 0 24px 6px rgba(99,102,241,0.5)",
            borderRadius: 14,
            transition: "box-shadow 0.3s ease",
          }
        : {};

      return {
        ...n,
        style: {
          ...n.style,
          opacity: searchDim ? 0.15 : 1,
          ...highlightStyle,
        },
      };
    });
  }, [layoutedNodes, searchQuery, highlightedNodeId]);

  const [nodesState, setNodesState, onNodesChange] = useNodesState(displayNodes);
  const [edgesState, , onEdgesChange] = useEdgesState(layoutedEdges);

  // Sync nodesState whenever displayNodes changes (search filter or highlight glow)
  useEffect(() => {
    setNodesState(displayNodes as any);
  }, [displayNodes, setNodesState]);

  const onNodeClick = useCallback((_: any, node: any) => {
    if (node.type === "archNode") {
      const nd = { id: node.id, data: node.data as ArchNodeData };
      setSelectedNode(nd);
      // Notify PropertiesPanel in the right sidebar
      window.dispatchEvent(
        new CustomEvent("repohawk-node-selected", { detail: { node: nd } })
      );
    }
  }, []);
  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    window.dispatchEvent(
      new CustomEvent("repohawk-node-selected", { detail: { node: null } })
    );
  }, []);

  // ── QA Chat highlight integration (commit 8) ────────────────────────────────
  // Listens for 'repohawk-highlight-node' dispatched by the chat panel.
  // STRICT EXACT MATCH ONLY — the chat backend now validates the node-id
  // against the real diagram node ids before sending it, so we can trust
  // the payload. No fuzzy matching. This prevents the previous bug where
  // a substring like "id" would match every node.
  useEffect(() => {
    const handleHighlight = (e: Event) => {
      const { nodeId } = (e as CustomEvent<{ nodeId: string }>).detail;
      if (!nodeId) return;

      // Strict exact match
      const match = layoutedNodes.find(
        (n) => n.type === "archNode" && n.id === nodeId
      );

      if (!match) {
        console.warn(
          `[RepoHawk] repohawk-highlight-node: no exact-match node for id="${nodeId}". ` +
          `Ignoring (chat highlight ids are now server-validated; if you see this, the backend validation may have failed).`
        );
        return;
      }

      // 1. Open MetadataPanel for this node
      setSelectedNode({ id: match.id, data: match.data as unknown as ArchNodeData });

      // 2. Apply glow pulse via highlightedNodeId → displayNodes memo will pick it up
      setHighlightedNodeId(match.id);

      // 3. Smoothly center + zoom the viewport onto the node
      setTimeout(() => {
        fitView({
          nodes: [{ id: match.id }],
          duration: 800,
          padding: 0.35,
          minZoom: 0.5,
          maxZoom: 1.5,
        });
      }, 50);

      // 4. Remove glow after 2.5s so it fades naturally
      setTimeout(() => setHighlightedNodeId(null), 2500);
    };

    window.addEventListener("repohawk-highlight-node", handleHighlight);
    return () => window.removeEventListener("repohawk-highlight-node", handleHighlight);
  }, [layoutedNodes, fitView]);

  const layerCount = useMemo(
    () => new Set(rawNodes.map((n) => n.data.layer ?? "core-services")).size,
    [rawNodes],
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "f" || e.key === "F") {
        if (!document.fullscreenElement) containerRef.current?.requestFullscreen?.();
        else document.exitFullscreen?.();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [containerRef]);

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", background: "#080a12", overflow: "hidden" }}>
      <div ref={reactFlowWrapperRef} style={{ flex: 1, minWidth: 0, position: "relative" }}>
        <ReactFlow
          nodes={nodesState}
          edges={edgesState}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={allNodeTypes}
          edgeTypes={edgeTypes}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          fitView
          fitViewOptions={{ padding: 0.12 }}
          panOnDrag={true}
          panOnScroll={false}
          zoomOnScroll={true}
          zoomOnPinch={true}
          colorMode="dark"
          minZoom={0.04}
          maxZoom={3}
          // Do NOT use defaultEdgeOptions zIndex — each edge already has zIndex:5
          proOptions={{ hideAttribution: true }}
          elementsSelectable={true}
          nodesDraggable={false}
          attributionPosition="bottom-left"
          // Prevent React Flow from elevating edges above nodes on select
          elevateEdgesOnSelect={false}
        >
          <Background variant={BackgroundVariant.Dots} gap={28} size={1.1} color="rgba(255,255,255,0.04)" style={{ background: "#080a12" }} />

          <MiniMap
            position="bottom-right"
            nodeStrokeWidth={0}
            nodeColor={(n) => {
              const c: Record<string, string> = { app: "#f59e0b", service: "#10b981", package: "#8b5cf6", agent: "#3b82f6", database: "#06b6d4", external: "#ec4899", infrastructure: "#64748b" };
              return c[(n.data as any)?.type] ?? "#1e293b";
            }}
            maskColor="rgba(0,0,0,0.7)"
            style={{ background: "rgba(10,11,20,0.92)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, marginBottom: 160, marginRight: 6 }}
          />

          <Panel position="top-left">
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(10,11,20,0.92)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 9, padding: "6px 12px", backdropFilter: "blur(12px)" }}>
              <Layers size={12} style={{ color: "#6366f1" }} />
              <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>{rawNodes.length} components</span>
              <div style={{ width: 1, height: 12, background: "rgba(255,255,255,0.08)" }} />
              <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>{rawEdges.length} connections</span>
              <div style={{ width: 1, height: 12, background: "rgba(255,255,255,0.08)" }} />
              <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>{layerCount} layers</span>
            </motion.div>
          </Panel>

          <Panel position="top-right">
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <DiagramSearch query={searchQuery} onChange={setSearchQuery} onClear={() => setSearchQuery("")} />
            </motion.div>
          </Panel>

          <Panel position="bottom-right">
            <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end", marginBottom: 8 }}>
              <DiagramControls
                containerRef={containerRef}
                onExport={handleExport}
                isExporting={isExporting}
                exported={exported}
              />
            </div>
          </Panel>

          <Panel position="bottom-left">
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(10,11,20,0.85)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 7, padding: "4px 10px", backdropFilter: "blur(8px)" }}>
              <Info size={9} style={{ color: "#475569" }} />
              <span style={{ fontSize: 9, color: "#475569", fontWeight: 500 }}>
                Scroll&nbsp;·&nbsp;zoom&nbsp;&nbsp;·&nbsp;&nbsp;drag&nbsp;pan&nbsp;&nbsp;·&nbsp;&nbsp;F&nbsp;fullscreen
              </span>
            </div>
          </Panel>
        </ReactFlow>

        {/* Legend — absolute overlay, above everything */}
        <div style={{ position: "absolute", bottom: 44, left: 16, zIndex: 50, pointerEvents: "all" }}>
          <DiagramLegend />
        </div>
      </div>

      <MetadataPanel node={selectedNode} onClose={() => setSelectedNode(null)} />
    </div>
  );
}

// ── Root export ───────────────────────────────────────────────────────────────
export default function LayeredArchitecture({ nodes: rawNodes, edges: rawEdges, repoName }: {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  repoName?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%" }}>
      <ReactFlowProvider>
        <DiagramInner rawNodes={rawNodes} rawEdges={rawEdges} containerRef={containerRef} repoName={repoName} />
      </ReactFlowProvider>
    </div>
  );
}
