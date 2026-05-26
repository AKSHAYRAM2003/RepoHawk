"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

const LAYER_META: Record<string, { label: string; color: string }> = {
  "dev-tools":      { label: "Developer Tools / Build Systems", color: "from-slate-500/5 to-slate-600/3 border-slate-700/30" },
  "applications":   { label: "Applications",                    color: "from-amber-500/5 to-amber-600/3 border-amber-700/30" },
  "core-services":  { label: "Core Services / APIs",           color: "from-emerald-500/5 to-emerald-600/3 border-emerald-700/30" },
  "business-logic": { label: "Business Logic / Internal Modules", color: "from-blue-500/5 to-blue-600/3 border-blue-700/30" },
  "data-storage":   { label: "Data Storage / Persistence",     color: "from-cyan-500/5 to-cyan-600/3 border-cyan-700/30" },
  "external":       { label: "External Systems",               color: "from-pink-500/5 to-pink-600/3 border-pink-700/30" },
};

export default function LayerContainer({
  layer,
  children,
}: {
  layer: string;
  children: ReactNode;
}) {
  const meta = LAYER_META[layer] ?? { label: layer, color: "from-slate-500/5 to-slate-600/3 border-slate-700/30" };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={`rounded-2xl border bg-gradient-to-b ${meta.color} p-5 relative`}
    >
      {/* Layer header */}
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-700/20">
        <div className="w-1.5 h-5 rounded-full bg-slate-500/40" />
        <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
          {meta.label}
        </span>
      </div>

      {/* Nodes grid */}
      <div className="flex flex-wrap gap-4 justify-center">
        {children}
      </div>
    </motion.div>
  );
}
