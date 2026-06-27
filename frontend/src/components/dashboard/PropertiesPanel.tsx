"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { MessageSquare, LayoutTemplate, PanelRightClose, PanelRightOpen, Layers, Tag, Cpu, Zap, Box, ArrowRight } from "lucide-react";
import QAChatPanel from "./QAChatPanel";

interface PropertiesPanelProps {
  repoId: string;
  validNodeIds?: string[];
}

interface SelectedNode {
  id: string;
  data: {
    label?: string;
    type?: string;
    layer?: string;
    group?: string;
    description?: string;
    tech?: string;
  };
}

const MIN_WIDTH = 280;
const MAX_WIDTH = 640;
const DEFAULT_WIDTH = 320;

const TYPE_META: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  app:            { label: "Application",    color: "#f59e0b", bg: "rgba(245,158,11,0.10)",  icon: "⚛" },
  service:        { label: "Core Service",   color: "#10b981", bg: "rgba(16,185,129,0.10)",  icon: "⚙" },
  package:        { label: "Shared Package", color: "#8b5cf6", bg: "rgba(139,92,246,0.10)",  icon: "⬡" },
  agent:          { label: "Agent / Module", color: "#3b82f6", bg: "rgba(59,130,246,0.10)",  icon: "⟁" },
  infrastructure: { label: "Infrastructure", color: "#64748b", bg: "rgba(100,116,139,0.10)", icon: "▦" },
  external:       { label: "External",       color: "#ec4899", bg: "rgba(236,72,153,0.10)",  icon: "⊕" },
  database:       { label: "Database",       color: "#06b6d4", bg: "rgba(6,182,212,0.10)",   icon: "⛁" },
};

const LAYER_LABELS: Record<string, string> = {
  "dev-tools":      "Developer Tools",
  "applications":   "Applications",
  "core-services":  "Core Services / APIs",
  "business-logic": "Business Logic",
  "data-storage":   "Data Storage",
  "external":       "External Systems",
};

function Field({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        {icon && <span style={{ color: "#334155" }}>{icon}</span>}
        <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "#334155" }}>
          {label}
        </p>
      </div>
      {children}
    </div>
  );
}

function NodeProperties({ node, onAskAI }: { node: SelectedNode; onAskAI: (question: string) => void }) {
  const tm = TYPE_META[node.data.type ?? "service"] ?? TYPE_META.service;

  const suggestedQuestions = [
    `What does the ${node.data.label} component do?`,
    `How does ${node.data.label} connect to other components?`,
    `What files make up ${node.data.label}?`,
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "16px", overflowY: "auto", flex: 1, scrollbarWidth: "thin" }}>
      {/* Hero type card */}
      <div
        style={{
          background: tm.bg,
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
            width: 44,
            height: 44,
            borderRadius: 12,
            background: `${tm.color}18`,
            border: `1px solid ${tm.color}40`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 20,
            flexShrink: 0,
          }}
        >
          {tm.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: "var(--on-surface)", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {node.data.label}
          </p>
          <p style={{ fontSize: 11, color: tm.color, fontWeight: 600, marginTop: 3 }}>
            {tm.label}
          </p>
        </div>
      </div>

      <div style={{ height: 1, background: "var(--outline-variant)" }} />

      {/* Properties */}
      {node.data.layer && (
        <Field label="Layer" icon={<Layers size={10} />}>
          <span style={{ fontSize: 12, color: "var(--on-surface-variant)" }}>
            {LAYER_LABELS[node.data.layer] ?? node.data.layer}
          </span>
        </Field>
      )}

      {node.data.group && (
        <Field label="Group" icon={<Box size={10} />}>
          <span style={{ fontSize: 12, color: "var(--on-surface-variant)" }}>
            {node.data.group}
          </span>
        </Field>
      )}

      {node.data.description && (
        <Field label="Description">
          <p style={{ fontSize: 12, color: "var(--on-surface-variant)", lineHeight: 1.6 }}>
            {node.data.description}
          </p>
        </Field>
      )}

      {node.data.tech && (
        <Field label="Tech Stack" icon={<Cpu size={10} />}>
          <div
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 8,
              padding: "6px 10px",
              fontFamily: "monospace",
              fontSize: 11,
              color: "var(--on-surface-variant)",
            }}
          >
            {node.data.tech}
          </div>
        </Field>
      )}

      <div style={{ height: 1, background: "var(--outline-variant)" }} />

      {/* Ask AI section */}
      <Field label="Ask AI about this component" icon={<Zap size={10} />}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {suggestedQuestions.map((q) => (
            <button
              key={q}
              onClick={() => onAskAI(q)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid rgba(99,102,241,0.2)",
                background: "rgba(99,102,241,0.04)",
                cursor: "pointer",
                textAlign: "left",
                color: "var(--on-surface-variant)",
                fontSize: 11,
                lineHeight: 1.4,
                transition: "all 0.12s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(99,102,241,0.1)";
                e.currentTarget.style.borderColor = "rgba(99,102,241,0.4)";
                e.currentTarget.style.color = "var(--on-surface)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(99,102,241,0.04)";
                e.currentTarget.style.borderColor = "rgba(99,102,241,0.2)";
                e.currentTarget.style.color = "var(--on-surface-variant)";
              }}
            >
              <span style={{ flex: 1 }}>{q}</span>
              <ArrowRight size={11} style={{ flexShrink: 0, color: "#6366f1" }} />
            </button>
          ))}
        </div>
      </Field>

      {/* Node ID (debug) */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: 10, marginTop: 4 }}>
        <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "#1e293b", marginBottom: 4 }}>
          Node ID
        </p>
        <p style={{ fontSize: 9, fontFamily: "monospace", color: "#334155", wordBreak: "break-all" }}>
          {node.id}
        </p>
      </div>
    </div>
  );
}

export default function PropertiesPanel({ repoId, validNodeIds = [] }: PropertiesPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<"properties" | "qa">("properties");
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [selectedNode, setSelectedNode] = useState<SelectedNode | null>(null);
  const [pendingAiQuestion, setPendingAiQuestion] = useState<string | null>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(DEFAULT_WIDTH);
  const panelRef = useRef<HTMLDivElement>(null);

  // Listen for node selections from the diagram canvas
  useEffect(() => {
    const handleNodeSelect = (e: Event) => {
      const { node } = (e as CustomEvent<{ node: SelectedNode | null }>).detail;
      setSelectedNode(node);
      if (node) {
        // Auto-switch to properties tab when a node is selected
        setActiveTab("properties");
        if (isCollapsed) setIsCollapsed(false);
      }
    };
    window.addEventListener("repohawk-node-selected", handleNodeSelect);
    return () => window.removeEventListener("repohawk-node-selected", handleNodeSelect);
  }, [isCollapsed]);

  const handleAskAI = useCallback((question: string) => {
    setPendingAiQuestion(question);
    setActiveTab("qa");
  }, []);

  const clearPendingQuestion = useCallback(() => {
    setPendingAiQuestion(null);
  }, []);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current) return;
    const dx = startX.current - e.clientX;
    const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + dx));
    setWidth(newWidth);
  }, []);

  const onMouseUp = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  useEffect(() => {
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [onMouseMove, onMouseUp]);

  const onDragHandleMouseDown = (e: React.MouseEvent) => {
    if (isCollapsed) return;
    e.preventDefault();
    isDragging.current = true;
    startX.current = e.clientX;
    startWidth.current = width;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  return (
    <aside
      ref={panelRef}
      className="relative flex flex-col border-l border-outline-variant bg-surface-low transition-[border] duration-150"
      style={{
        width: isCollapsed ? 48 : width,
        minWidth: isCollapsed ? 48 : MIN_WIDTH,
        maxWidth: isCollapsed ? 48 : MAX_WIDTH,
        flexShrink: 0,
      }}
    >
      {/* ── Drag handle (left edge) ── */}
      {!isCollapsed && (
        <div
          onMouseDown={onDragHandleMouseDown}
          className="absolute left-0 top-0 bottom-0 z-20 flex items-center justify-center"
          style={{ width: 8, cursor: "col-resize" }}
          title="Drag to resize"
        >
          <div
            className="h-12 rounded-full transition-opacity opacity-0 hover:opacity-100"
            style={{
              width: 3,
              background: "var(--outline-variant)",
              transition: "opacity 0.2s, background 0.2s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.background = "var(--primary)";
              (e.currentTarget as HTMLDivElement).style.opacity = "1";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.background = "var(--outline-variant)";
              (e.currentTarget as HTMLDivElement).style.opacity = "0";
            }}
          />
        </div>
      )}

      {/* Collapse toggle */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -left-3.5 top-16 bg-surface-low border border-outline-variant text-on-surface-variant hover:text-on-surface rounded-full p-1 shadow-md z-10 transition-colors"
        title={isCollapsed ? "Expand panel" : "Collapse panel"}
      >
        {isCollapsed ? <PanelRightOpen size={13} /> : <PanelRightClose size={13} />}
      </button>

      {!isCollapsed ? (
        <>
          {/* Tab header */}
          <div className="h-14 flex items-center px-3 border-b border-outline-variant flex-shrink-0">
            <div
              className="flex p-1 rounded-xl w-full gap-1"
              style={{ background: "color-mix(in srgb, var(--on-surface) 6%, transparent)" }}
            >
              <button
                onClick={() => setActiveTab("properties")}
                className={`flex-1 flex items-center justify-center gap-2 py-1.5 px-2 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === "properties"
                    ? "bg-surface text-on-surface shadow-sm"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                <LayoutTemplate size={13} />
                Properties
                {selectedNode && (
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "#6366f1",
                      flexShrink: 0,
                    }}
                  />
                )}
              </button>
              <button
                onClick={() => setActiveTab("qa")}
                className={`flex-1 flex items-center justify-center gap-2 py-1.5 px-2 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === "qa"
                    ? "bg-surface text-on-surface shadow-sm"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                <MessageSquare size={13} />
                QA Agent
              </button>
            </div>
          </div>

          {/* Panel content */}
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            {activeTab === "properties" && (
              <>
                {selectedNode ? (
                  <NodeProperties node={selectedNode} onAskAI={handleAskAI} />
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center space-y-3 opacity-60 p-6">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center"
                      style={{ background: "color-mix(in srgb, var(--on-surface) 8%, transparent)" }}
                    >
                      <LayoutTemplate size={22} className="text-on-surface-variant" />
                    </div>
                    <p className="text-sm font-semibold text-on-surface">
                      No node selected
                    </p>
                    <p className="text-xs text-on-surface-variant px-4 leading-relaxed">
                      Click on any component in the Architecture Canvas to view its details and ask AI questions about it.
                    </p>
                  </div>
                )}
              </>
            )}

            {activeTab === "qa" && (
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <QAChatPanel
                  repoId={repoId}
                  validNodeIds={validNodeIds}
                  pendingQuestion={pendingAiQuestion}
                  onPendingQuestionConsumed={clearPendingQuestion}
                />
              </div>
            )}
          </div>
        </>
      ) : (
        /* Collapsed icon-only view */
        <div className="flex-1 flex flex-col items-center py-4 space-y-2 pt-16">
          <button
            onClick={() => { setActiveTab("properties"); setIsCollapsed(false); }}
            className={`p-2.5 rounded-xl transition-colors ${
              activeTab === "properties"
                ? "active-primary"
                : "text-on-surface-variant hover-surface"
            }`}
            title="Properties"
          >
            <LayoutTemplate size={18} />
          </button>
          <button
            onClick={() => { setActiveTab("qa"); setIsCollapsed(false); }}
            className={`p-2.5 rounded-xl transition-colors ${
              activeTab === "qa"
                ? "active-primary"
                : "text-on-surface-variant hover-surface"
            }`}
            title="QA Agent"
          >
            <MessageSquare size={18} />
          </button>
        </div>
      )}
    </aside>
  );
}
