"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { motion } from "framer-motion";
import type { ArchNodeData } from "@/hooks/useDiagram";

const LAYER_STYLES: Record<string, { bg: string; border: string; dot: string; label: string; tag: string }> = {
  "applications":   { bg: "from-amber-500/8 to-amber-600/3", border: "border-amber-500/25", dot: "bg-amber-500", label: "text-amber-300", tag: "bg-amber-500/15 text-amber-300 border-amber-500/20" },
  "core-services":  { bg: "from-emerald-500/8 to-emerald-600/3", border: "border-emerald-500/25", dot: "bg-emerald-500", label: "text-emerald-300", tag: "bg-emerald-500/15 text-emerald-300 border-emerald-500/20" },
  "business-logic": { bg: "from-blue-500/8 to-blue-600/3", border: "border-blue-500/25", dot: "bg-blue-500", label: "text-blue-300", tag: "bg-blue-500/15 text-blue-300 border-blue-500/20" },
  "data-storage":   { bg: "from-cyan-500/8 to-cyan-600/3", border: "border-cyan-500/25", dot: "bg-cyan-500", label: "text-cyan-300", tag: "bg-cyan-500/15 text-cyan-300 border-cyan-500/20" },
  "external":       { bg: "from-pink-500/8 to-pink-600/3", border: "border-pink-500/25", dot: "bg-pink-500", label: "text-pink-300", tag: "bg-pink-500/15 text-pink-300 border-pink-500/20" },
  "dev-tools":      { bg: "from-slate-500/8 to-slate-600/3", border: "border-slate-500/25", dot: "bg-slate-500", label: "text-slate-300", tag: "bg-slate-500/15 text-slate-300 border-slate-500/20" },
};

const TYPE_ICONS: Record<string, string> = {
  "app": "◇",
  "service": "▣",
  "package": "⊞",
  "agent": "⚙",
  "infrastructure": "⎔",
  "external": "⊕",
  "database": "⛁",
};

function getLayerStyle(layer?: string) {
  return LAYER_STYLES[layer ?? ""] ?? LAYER_STYLES["core-services"];
}

export default function ArchNode({ data, selected }: NodeProps & { data: ArchNodeData }) {
  const d = data as ArchNodeData;
  const style = getLayerStyle(d.layer);
  const icon = TYPE_ICONS[d.type ?? ""] ?? "▪";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={`
        relative px-4 py-3 rounded-2xl bg-gradient-to-br ${style.bg}
        border ${selected ? "border-indigo-400/60 shadow-lg shadow-indigo-500/15" : style.border}
        ${style.border} shadow-md shadow-black/8 dark:shadow-black/30
        backdrop-blur-sm min-w-[200px] max-w-[260px]
        transition-shadow duration-200
      `}
    >
      <Handle type="target" position={Position.Top} className="!w-2.5 !h-2.5 !border-2 !border-slate-800 !bg-indigo-500" />
      <Handle type="source" position={Position.Bottom} className="!w-2.5 !h-2.5 !border-2 !border-slate-800 !bg-indigo-500" />

      <div className="flex items-start gap-2.5">
        {/* Icon */}
        <div className={`w-7 h-7 rounded-lg ${style.dot}/20 flex items-center justify-center text-sm shrink-0 mt-0.5 ${style.label}`}>
          {icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-slate-100 leading-tight">{d.label}</span>
            {d.type && (
              <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-md border uppercase tracking-wider ${style.tag}`}>
                {d.type}
              </span>
            )}
          </div>
          {d.description && (
            <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2">{d.description}</p>
          )}
          {d.tech && (
            <p className="text-[10px] font-mono text-slate-500">{d.tech}</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
