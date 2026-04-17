"use client";
import React from "react";
import { TerminalSquare } from "lucide-react";

export default function LogsPage({ params }: { params: { id: string } }) {
  return (
    <div className="w-full h-full flex flex-col bg-[#0a0a0a] text-green-400 p-6 font-mono text-sm overflow-hidden">
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/10 text-white/50">
        <TerminalSquare size={18} />
        <span>Pipeline Logs / Analysis Stream</span>
      </div>
      <div className="flex-1 overflow-y-auto space-y-2 opacity-70">
        <p className="text-white/30">$ repo_id: {params.id}</p>
        <p>📡 Connecting to Server-Sent Events stream...</p>
        <p className="animate-pulse">_</p>
      </div>
    </div>
  );
}
