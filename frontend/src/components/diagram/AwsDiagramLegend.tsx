"use client";

import { motion } from "framer-motion";

const LEGEND_ITEMS = [
  { icon: "⚛", color: "#f59e0b", label: "Application" },
  { icon: "⚙", color: "#10b981", label: "Core Service" },
  { icon: "⬡", color: "#8b5cf6", label: "Shared Package" },
  { icon: "⟁", color: "#3b82f6", label: "Agent / Module" },
  { icon: "⛁", color: "#06b6d4", label: "Database" },
  { icon: "⊕", color: "#ec4899", label: "External System" },
  { icon: "▦", color: "#64748b", label: "Infrastructure" },
];

const EDGE_TYPES = [
  { line: "solid", color: "#10b981", label: "Data Flow (animated)" },
  { line: "solid", color: "#6366f1", label: "Control Flow" },
  { line: "dashed", color: "#64748b", label: "Build Dependency" },
];

export default function AwsDiagramLegend() {
  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: 0.6 }}
      style={{
        position: "absolute",
        bottom: 80,
        left: 12,
        zIndex: 10,
        background: "rgba(10,10,16,0.88)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 14,
        padding: "12px 14px",
        minWidth: 170,
        backdropFilter: "blur(16px)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        pointerEvents: "none",
      }}
    >
      <p
        style={{
          fontSize: 9,
          fontWeight: 800,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "#475569",
          marginBottom: 8,
        }}
      >
        Legend
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {LEGEND_ITEMS.map((item) => (
          <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 20,
                height: 20,
                borderRadius: 6,
                background: `${item.color}22`,
                border: `1px solid ${item.color}55`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10,
                color: item.color,
                flexShrink: 0,
              }}
            >
              {item.icon}
            </div>
            <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 500 }}>
              {item.label}
            </span>
          </div>
        ))}
      </div>

      <div
        style={{
          height: 1,
          background: "rgba(255,255,255,0.05)",
          margin: "10px 0 8px",
        }}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {EDGE_TYPES.map((et) => (
          <div key={et.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <svg width="28" height="10" viewBox="0 0 28 10">
              <line
                x1="0"
                y1="5"
                x2="22"
                y2="5"
                stroke={et.color}
                strokeWidth="1.5"
                strokeDasharray={et.line === "dashed" ? "4 3" : undefined}
              />
              <polygon points="22,2 28,5 22,8" fill={et.color} />
            </svg>
            <span style={{ fontSize: 10, color: "#64748b", fontWeight: 500 }}>
              {et.label}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
