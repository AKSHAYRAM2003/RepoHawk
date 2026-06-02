"use client";

import React, { useState } from "react";
import { MessageSquare, LayoutTemplate, PanelRightClose, PanelRightOpen } from "lucide-react";
import QAChatPanel from "./QAChatPanel";

interface PropertiesPanelProps {
  repoId: string;
  validNodeIds?: string[];        // commit 8 — actual diagram node IDs
}

export default function PropertiesPanel({ repoId, validNodeIds = [] }: PropertiesPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<"properties" | "qa">("properties");

  return (
    <aside
      className={`relative flex flex-col border-l border-slate-200 dark:border-slate-800/50 bg-slate-50 dark:bg-[#0a0a0a] transition-all duration-300 ease-in-out ${isCollapsed ? "w-12" : "w-80 lg:w-96"}`}
    >
      {/* Collapse toggle */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -left-3 top-16 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 rounded-full p-1 shadow-sm z-10 transition-colors"
      >
        {isCollapsed ? <PanelRightOpen size={14} /> : <PanelRightClose size={14} />}
      </button>

      {!isCollapsed ? (
        <>
          {/* Tab header */}
          <div className="h-14 flex items-center px-2 border-b border-slate-200 dark:border-slate-800/50 flex-shrink-0">
            <div className="flex bg-slate-200/50 dark:bg-slate-800/40 p-1 rounded-lg w-full">
              <button
                onClick={() => setActiveTab("properties")}
                className={`flex-1 flex items-center justify-center gap-2 py-1.5 px-2 text-xs font-semibold rounded-md transition-all ${
                  activeTab === "properties"
                    ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                }`}
              >
                <LayoutTemplate size={14} />
                Properties
              </button>
              <button
                onClick={() => setActiveTab("qa")}
                className={`flex-1 flex items-center justify-center gap-2 py-1.5 px-2 text-xs font-semibold rounded-md transition-all ${
                  activeTab === "qa"
                    ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                }`}
              >
                <MessageSquare size={14} />
                QA Agent
              </button>
            </div>
          </div>

          {/* Panel content */}
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            {/* Properties tab */}
            {activeTab === "properties" && (
              <div className="flex-1 flex flex-col items-center justify-center text-center space-y-3 opacity-60 p-4">
                <LayoutTemplate size={32} className="text-slate-400" />
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  No node selected
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 px-6">
                  Click on a component in the Architecture Canvas to view its
                  source code and properties.
                </p>
              </div>
            )}

            {/* QA Agent tab — full chat interface */}
            {activeTab === "qa" && (
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <QAChatPanel repoId={repoId} validNodeIds={validNodeIds} />
              </div>
            )}
          </div>
        </>
      ) : (
        /* Collapsed icon-only sidebar */
        <div className="flex-1 flex flex-col items-center py-4 space-y-6">
          <button
            onClick={() => {
              setActiveTab("properties");
              setIsCollapsed(false);
            }}
            className={`p-2 rounded-lg transition-colors ${
              activeTab === "properties"
                ? "bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/50"
            }`}
          >
            <LayoutTemplate size={20} />
          </button>
          <button
            onClick={() => {
              setActiveTab("qa");
              setIsCollapsed(false);
            }}
            className={`p-2 rounded-lg transition-colors ${
              activeTab === "qa"
                ? "bg-indigo-500/10 text-indigo-500"
                : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/50"
            }`}
          >
            <MessageSquare size={20} />
          </button>
        </div>
      )}
    </aside>
  );
}
