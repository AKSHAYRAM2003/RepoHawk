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
  default:        "#475569",
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

  // Smooth-step with borderRadius:0 → perfectly straight elbows (right-angle corners)
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 0,
    offset: 50,
  });

  // Only show label if there's actual text and the edge is long enough to warrant it
  const edgeLabel = label as string | undefined;
  const showLabel = !!edgeLabel && edgeLabel.trim().length > 0;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: color,
          strokeWidth: isDataFlow ? 2 : 1.5,
          strokeDasharray: dash,
          // Edges should render below node cards — controlled by zIndex on edge definition
          ...style,
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
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
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
