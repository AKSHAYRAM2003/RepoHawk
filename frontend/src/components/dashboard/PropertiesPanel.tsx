"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { MessageSquare, LayoutTemplate, PanelRightClose, PanelRightOpen } from "lucide-react";
import QAChatPanel from "./QAChatPanel";

interface PropertiesPanelProps {
  repoId: string;
  validNodeIds?: string[];
}

const MIN_WIDTH = 280;
const MAX_WIDTH = 640;
const DEFAULT_WIDTH = 320;

export default function PropertiesPanel({ repoId, validNodeIds = [] }: PropertiesPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<"properties" | "qa">("properties");
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(DEFAULT_WIDTH);
  const panelRef = useRef<HTMLDivElement>(null);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current) return;
    // Dragging LEFT increases width, RIGHT decreases
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
          {/* Visual indicator */}
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
                  Click on a component in the Architecture Canvas to view its
                  source code and properties.
                </p>
              </div>
            )}

            {activeTab === "qa" && (
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <QAChatPanel repoId={repoId} validNodeIds={validNodeIds} />
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
