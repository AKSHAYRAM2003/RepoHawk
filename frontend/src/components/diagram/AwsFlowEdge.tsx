"use client";

import { memo } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from "@xyflow/react";

const RELATION_COLORS: Record<string, string> = {
  "data-flow":    "#10b981",
  "control-flow": "#6366f1",
  "build-dep":    "#64748b",
  default:        "#6366f1",
};

const RELATION_DASH: Record<string, string | undefined> = {
  "data-flow":    undefined,
  "control-flow": undefined,
  "build-dep":    "6 4",
  default:        undefined,
};

export default memo(function AwsFlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  label,
  markerEnd,
  style,
}: EdgeProps) {
  const relation = (data as any)?.relation ?? "default";
  const color    = RELATION_COLORS[relation] ?? RELATION_COLORS.default;
  const dash     = RELATION_DASH[relation];
  const isDataFlow = relation === "data-flow";

  // Fan-out offsets: spread multiple edges entering/leaving the same node
  // so they don't all pile on the exact same point and overlap each other
  const sOffY = (data as any)?.sourceOffsetY ?? 0;
  const tOffY = (data as any)?.targetOffsetY ?? 0;

  // Smooth-step with borderRadius:0 → perfectly straight elbows (right-angle corners)
  // Apply the fan-out offsets to shift each edge's Y start/end point
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY: sourceY + sOffY,
    sourcePosition,
    targetX,
    targetY: targetY + tOffY,
    targetPosition,
    borderRadius: 0,
    offset: 50,
  });

  // Only show label if there's actual text
  const edgeLabel = label as string | undefined;
  const showLabel = !!edgeLabel && edgeLabel.trim().length > 0;

  // Use explicitly pre-computed corridor position if provided (avoids card/label overlap).
  // Falls back to getSmoothStepPath midpoint only if labelPos is absent.
  const explicitPos = (data as any)?.labelPos as { x: number; y: number } | undefined;
  const finalLabelX = explicitPos?.x ?? labelX;
  const finalLabelY = explicitPos?.y ?? labelY;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: color,
          strokeWidth: isDataFlow ? 2.5 : 2,
          strokeDasharray: dash,
          // Spread parent style first, then force opacity=1 last
          // so nothing can override it (e.g. React Flow dimming on search)
          ...style,
          opacity: 1,
        }}
      />

      {/* Animated flow dot for data-flow edges */}
      {isDataFlow && (
        <circle r={3} fill={color} opacity={0.9}>
          <animateMotion dur="1.6s" repeatCount="indefinite" calcMode="linear">
            <mpath href={`#${id}`} />
          </animateMotion>
        </circle>
      )}

      {/* ── Label: ───[text]─── style ── */}
      {showLabel && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${finalLabelX}px,${finalLabelY}px)`,
              pointerEvents: "none",
              display: "flex",
              alignItems: "center",
              gap: 0,
              // Above both edge SVG and node cards
              zIndex: 30,
            }}
            className="nodrag nopan"
          >
            {/* Left dash stub */}
            <div
              style={{
                width: 18,
                height: 1.5,
                background: `linear-gradient(90deg, transparent, ${color})`,
                flexShrink: 0,
              }}
            />

            {/* Pill label */}
            <div
              style={{
                background: "rgba(8,10,18,0.96)",
                border: `1px solid ${color}55`,
                borderRadius: 5,
                padding: "2px 8px",
                fontSize: 9,
                fontWeight: 700,
                color: color,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
                fontFamily: "'Inter', system-ui, sans-serif",
                boxShadow: `0 2px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)`,
                userSelect: "none",
              }}
            >
              {edgeLabel}
            </div>

            {/* Right dash stub */}
            <div
              style={{
                width: 18,
                height: 1.5,
                background: `linear-gradient(90deg, ${color}, transparent)`,
                flexShrink: 0,
              }}
            />
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});
