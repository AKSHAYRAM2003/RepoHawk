"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Layers, Tag, Box, Cpu, ExternalLink, Database } from "lucide-react";
import type { ArchNodeData } from "@/hooks/useDiagram";

const TYPE_META: Record<
  string,
  { label: string; color: string; icon: string }
> = {
  app:            { label: "Application",      color: "#f59e0b", icon: "⚛" },
  service:        { label: "Core Service",     color: "#10b981", icon: "⚙" },
  package:        { label: "Shared Package",   color: "#8b5cf6", icon: "⬡" },
  agent:          { label: "Agent / Module",   color: "#3b82f6", icon: "⟁" },
  infrastructure: { label: "Infrastructure",   color: "#64748b", icon: "▦" },
  external:       { label: "External System",  color: "#ec4899", icon: "⊕" },
  database:       { label: "Database",         color: "#06b6d4", icon: "⛁" },
};

const LAYER_LABELS: Record<string, string> = {
  "dev-tools":      "Developer Tools",
  "applications":   "Applications",
  "core-services":  "Core Services / APIs",
  "business-logic": "Business Logic",
  "data-storage":   "Data Storage",
  "external":       "External Systems",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p
        style={{
          fontSize: 9,
          fontWeight: 800,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "#334155",
          marginBottom: 5,
        }}
      >
        {label}
      </p>
      {children}
    </div>
  );
}

export default function MetadataPanel({
  node,
  onClose,
}: {
  node: { id: string; data: ArchNodeData } | null;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {node && (
        <motion.div
          initial={{ opacity: 0, x: 48, scale: 0.97 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 48, scale: 0.97 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          style={{
            width: 280,
            flexShrink: 0,
            borderLeft: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(8,9,14,0.97)",
            backdropFilter: "blur(20px)",
            padding: "20px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <span
              style={{
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "#334155",
              }}
            >
              Component Details
            </span>
            <button
              onClick={onClose}
              style={{
                width: 24,
                height: 24,
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.06)",
                background: "rgba(255,255,255,0.03)",
                color: "#475569",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
            >
              <X size={12} />
            </button>
          </div>

          {/* Type + icon hero */}
          {node.data.type && (() => {
            const tm = TYPE_META[node.data.type] ?? TYPE_META.service;
            return (
              <div
                style={{
                  background: `${tm.color}10`,
                  border: `1px solid ${tm.color}30`,
                  borderRadius: 12,
                  padding: "14px",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 11,
                    background: `${tm.color}18`,
                    border: `1px solid ${tm.color}40`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 18,
                    flexShrink: 0,
                  }}
                >
                  {tm.icon}
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9", lineHeight: 1.2 }}>
                    {node.data.label}
                  </p>
                  <p style={{ fontSize: 10, color: tm.color, fontWeight: 600, marginTop: 3 }}>
                    {tm.label}
                  </p>
                </div>
              </div>
            );
          })()}

          {/* Divider */}
          <div style={{ height: 1, background: "rgba(255,255,255,0.04)" }} />

          {/* Layer */}
          {node.data.layer && (
            <Field label="Layer">
              <div className="flex items-center gap-2">
                <Layers size={11} style={{ color: "#475569" }} />
                <span style={{ fontSize: 12, color: "#94a3b8" }}>
                  {LAYER_LABELS[node.data.layer] ?? node.data.layer}
                </span>
              </div>
            </Field>
          )}

          {/* Group */}
          {node.data.group && (
            <Field label="Group">
              <div className="flex items-center gap-2">
                <Box size={11} style={{ color: "#475569" }} />
                <span style={{ fontSize: 12, color: "#94a3b8" }}>{node.data.group}</span>
              </div>
            </Field>
          )}

          {/* Description */}
          {node.data.description && (
            <Field label="Description">
              <p style={{ fontSize: 12, color: "#64748b", lineHeight: 1.6 }}>
                {node.data.description}
              </p>
            </Field>
          )}

          {/* Tech stack */}
          {node.data.tech && (
            <Field label="Tech Stack">
              <div
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 8,
                  padding: "6px 10px",
                  fontFamily: "monospace",
                  fontSize: 11,
                  color: "#94a3b8",
                }}
              >
                {node.data.tech}
              </div>
            </Field>
          )}

          {/* Node ID */}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: 14, marginTop: 4 }}>
            <p
              style={{
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#1e293b",
                marginBottom: 5,
              }}
            >
              Node ID
            </p>
            <p
              style={{
                fontSize: 9,
                fontFamily: "monospace",
                color: "#334155",
                wordBreak: "break-all",
              }}
            >
              {node.id}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
