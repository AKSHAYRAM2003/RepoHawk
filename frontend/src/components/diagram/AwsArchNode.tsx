"use client";

import { memo, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { ArchNodeData } from "@/hooks/useDiagram";
import { Zap } from "lucide-react";

const TYPE_THEME: Record<
  string,
  { icon: string; iconBg: string; iconColor: string; border: string; tagBg: string; tagText: string; dot: string; label: string }
> = {
  app:            { icon: "◈", iconBg: "rgba(245,158,11,0.18)", iconColor: "#f59e0b", border: "rgba(245,158,11,0.4)",  tagBg: "rgba(245,158,11,0.15)", tagText: "#fbbf24", dot: "#f59e0b", label: "App" },
  service:        { icon: "⬡", iconBg: "rgba(16,185,129,0.18)",  iconColor: "#10b981", border: "rgba(16,185,129,0.4)",  tagBg: "rgba(16,185,129,0.15)",  tagText: "#34d399", dot: "#10b981", label: "Service" },
  package:        { icon: "⬢", iconBg: "rgba(139,92,246,0.18)",  iconColor: "#8b5cf6", border: "rgba(139,92,246,0.4)",  tagBg: "rgba(139,92,246,0.15)",  tagText: "#a78bfa", dot: "#8b5cf6", label: "Package" },
  agent:          { icon: "◎", iconBg: "rgba(59,130,246,0.18)",   iconColor: "#3b82f6", border: "rgba(59,130,246,0.4)",   tagBg: "rgba(59,130,246,0.15)",   tagText: "#60a5fa", dot: "#3b82f6", label: "Agent" },
  infrastructure: { icon: "▣", iconBg: "rgba(100,116,139,0.18)", iconColor: "#94a3b8", border: "rgba(100,116,139,0.4)", tagBg: "rgba(100,116,139,0.15)", tagText: "#94a3b8", dot: "#64748b", label: "Infra" },
  external:       { icon: "⬖", iconBg: "rgba(236,72,153,0.18)",  iconColor: "#ec4899", border: "rgba(236,72,153,0.4)",  tagBg: "rgba(236,72,153,0.15)",  tagText: "#f472b6", dot: "#ec4899", label: "External" },
  database:       { icon: "⬙", iconBg: "rgba(6,182,212,0.18)",   iconColor: "#06b6d4", border: "rgba(6,182,212,0.4)",   tagBg: "rgba(6,182,212,0.15)",   tagText: "#22d3ee", dot: "#06b6d4", label: "Database" },
};

const FALLBACK = TYPE_THEME.service;

export default memo(function AwsArchNode({ id, data, selected }: NodeProps & { data: ArchNodeData }) {
  const d = data as ArchNodeData;
  const t = TYPE_THEME[d.type ?? ""] ?? FALLBACK;
  const [isHovered, setIsHovered] = useState(false);

  const handleStyle: React.CSSProperties = {
    background: t.dot,
    border: "2px solid #0d0e16",
    width: 9,
    height: 9,
    borderRadius: "50%",
  };

  const handleAskAI = (e: React.MouseEvent) => {
    // Stop the click from propagating to ReactFlow's node selection
    e.stopPropagation();
    const question = `Explain the "${d.label}" component — what does it do, how does it connect to other parts of the system, and what files make it up?`;
    window.dispatchEvent(
      new CustomEvent("repohawk-ask-ai-about-node", {
        detail: { nodeId: id, nodeLabel: d.label, question },
      })
    );
  };

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        width: 224,
        height: 112,
        // FULLY OPAQUE — so edge lines behind this card are invisible
        background: selected
          ? "rgb(18,20,34)"
          : "rgb(13,14,22)",
        border: `1.5px solid ${selected ? "#818cf8" : t.border}`,
        borderRadius: 14,
        boxShadow: selected
          ? `0 0 0 2.5px rgba(129,140,248,0.28), 0 8px 32px rgba(0,0,0,0.7)`
          : isHovered
            ? `0 0 0 1.5px rgba(99,102,241,0.35), 0 8px 32px rgba(0,0,0,0.7)`
            : `0 2px 14px rgba(0,0,0,0.55)`,
        position: "relative",
        cursor: "pointer",
        transition: "box-shadow 0.15s, border-color 0.15s",
        overflow: "hidden",
        fontFamily: "'Inter', 'SF Pro Display', system-ui, -apple-system, sans-serif",
        boxSizing: "border-box",
      }}
    >
      {/* Left accent bar */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          borderRadius: "14px 0 0 14px",
          background: `linear-gradient(180deg, ${t.dot} 0%, ${t.dot}60 100%)`,
        }}
      />

      {/* Handles — left & right for horizontal layout */}
      <Handle
        id="left"
        type="target"
        position={Position.Left}
        style={{ ...handleStyle, left: -5 }}
      />
      <Handle
        id="right"
        type="source"
        position={Position.Right}
        style={{ ...handleStyle, right: -5 }}
      />
      {/* Also top/bottom for cross-layer edges */}
      <Handle type="target" id="top" position={Position.Top} style={{ ...handleStyle, top: -5, opacity: 0.4 }} />
      <Handle type="source" id="bottom" position={Position.Bottom} style={{ ...handleStyle, bottom: -5, opacity: 0.4 }} />

      {/* Content — fills fixed 112px height */}
      <div style={{ padding: "8px 10px 8px 14px", display: "flex", gap: 9, alignItems: "flex-start", height: "100%", boxSizing: "border-box" }}>

        {/* Icon badge */}
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 9,
            background: t.iconBg,
            border: `1px solid ${t.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
            color: t.iconColor,
            flexShrink: 0,
            marginTop: 2,
          }}
        >
          {t.icon}
        </div>

        {/* Text block */}
        <div style={{ flex: 1, minWidth: 0, overflow: "hidden", display: "flex", flexDirection: "column", gap: 3 }}>
          {/* Type badge */}
          <span
            style={{
              display: "inline-block",
              fontSize: 8,
              fontWeight: 800,
              letterSpacing: "0.09em",
              textTransform: "uppercase",
              padding: "1px 5px",
              borderRadius: 3,
              background: t.tagBg,
              color: t.tagText,
              border: `1px solid ${t.border}`,
              alignSelf: "flex-start",
              lineHeight: 1.6,
            }}
          >
            {t.label}
          </span>

          {/* Title — wraps max 2 lines */}
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#f1f5f9",
              lineHeight: 1.3,
              letterSpacing: "-0.01em",
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical" as any,
              wordBreak: "break-word",
            }}
          >
            {d.label}
          </div>

          {/* Description — 1 line */}
          {d.description && (
            <p
              style={{
                fontSize: 9.5,
                color: "#64748b",
                lineHeight: 1.4,
                margin: 0,
                overflow: "hidden",
                display: "-webkit-box",
                WebkitLineClamp: 1,
                WebkitBoxOrient: "vertical" as any,
              }}
            >
              {d.description}
            </p>
          )}

          {/* Tech chip */}
          {d.tech && (
            <div
              style={{
                fontSize: 8.5,
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                color: "#475569",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 3,
                padding: "1px 5px",
                display: "inline-block",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: "100%",
                alignSelf: "flex-start",
                lineHeight: 1.6,
              }}
            >
              {d.tech}
            </div>
          )}
        </div>
      </div>

      {/* Ask AI hover button — appears on hover in top-right corner */}
      <button
        onClick={handleAskAI}
        title={`Ask AI about ${d.label}`}
        style={{
          position: "absolute",
          top: 7,
          right: 7,
          display: "flex",
          alignItems: "center",
          gap: 3,
          padding: "3px 7px",
          borderRadius: 6,
          border: "1px solid rgba(99,102,241,0.45)",
          background: "rgba(99,102,241,0.15)",
          color: "#818cf8",
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.04em",
          cursor: "pointer",
          opacity: isHovered ? 1 : 0,
          transform: isHovered ? "translateY(0) scale(1)" : "translateY(-3px) scale(0.92)",
          transition: "opacity 0.15s, transform 0.15s",
          backdropFilter: "blur(4px)",
          whiteSpace: "nowrap",
          pointerEvents: isHovered ? "auto" : "none",
          zIndex: 10,
        }}
      >
        <Zap size={9} />
        Ask AI
      </button>
    </div>
  );
});
