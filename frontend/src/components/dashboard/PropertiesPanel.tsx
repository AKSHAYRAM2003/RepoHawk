"use client";

import React, { useState } from "react";
import { MessageSquare, LayoutTemplate, PanelRightClose, PanelRightOpen } from "lucide-react";
import QAChatPanel from "./QAChatPanel";

interface PropertiesPanelProps {
  repoId: string;
  validNodeIds?: string[];
}

export default function PropertiesPanel({ repoId, validNodeIds = [] }: PropertiesPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<"properties" | "qa">("properties");

  return (
    <aside
      className="relative flex flex-col border-l border-outline-variant bg-surface-low transition-all duration-300 ease-in-out"
      style={{ width: isCollapsed ? 48 : undefined, flex: isCollapsed ? undefined : "0 0 320px" }}
    >
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
          <div className="h-14 flex items-center px-2 border-b border-outline-variant flex-shrink-0">
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
