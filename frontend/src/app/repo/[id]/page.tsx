"use client";

import React from "react";
import { Workflow } from "lucide-react";

export default function ArchitectureCanvasPage({ params }: { params: { id: string } }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center text-center p-8 bg-[url('/grid-pattern.svg')] bg-[length:32px_32px]">
      <div className="bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-md p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl max-w-lg w-full">
        <div className="mx-auto w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mb-6">
          <Workflow className="w-8 h-8 text-blue-500" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 mb-3">
          Architecture Canvas
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-8">
          The repo {params.id} has been queued for analysis. React Flow will render the component graph here.
        </p>
        <div className="flex gap-4 justify-center">
          <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></div>
          <div className="h-2 w-2 rounded-full bg-blue-400 animate-pulse delay-75"></div>
          <div className="h-2 w-2 rounded-full bg-blue-300 animate-pulse delay-150"></div>
        </div>
      </div>
    </div>
  );
}
