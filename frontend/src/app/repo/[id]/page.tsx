"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Workflow, 
  RefreshCw, 
  AlertTriangle, 
  GitBranch, 
  Terminal, 
  Cpu, 
  Binary, 
  Search, 
  ShieldAlert,
  ArrowRight
} from "lucide-react";
import { useRepoAnalysis } from "@/hooks/useRepoAnalysis";
import { useDiagram } from "@/hooks/useDiagram";
import DiagramCanvas from "@/components/diagram/DiagramCanvas";
import Link from "next/link";

export default function ArchitectureCanvasPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const { repo, status, logs, currentStep, error, isNotFound, refetch, stopAnalysis } = useRepoAnalysis(id);
  const { diagram, loading: diagramLoading } = useDiagram(id);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const diagramNodes = diagram?.reactflow_json?.nodes ?? [];
  const diagramEdges = diagram?.reactflow_json?.edges ?? [];

  const steps = [
    { id: "git_cloner", label: "Cloning Repository", desc: "Downloading source files from GitHub", icon: GitBranch },
    { id: "ast_parser", label: "AST File Parsing", desc: "Generating syntax trees & extracting functions", icon: Binary },
    { id: "embedder", label: "Vector Embeddings", desc: "Indexing code blocks for AI semantic query", icon: Cpu },
    { id: "architect", label: "Generating Layout", desc: "Laying out services & class connections", icon: Workflow },
    { id: "critique", label: "Critique & Refinement", desc: "Verifying diagram clarity and details", icon: Search }
  ];

  // Map backend node status to active step index
  useEffect(() => {
    const idx = steps.findIndex(s => s.id === currentStep);
    if (idx !== -1) {
      setActiveStepIndex(idx);
    } else if (status === "complete") {
      setActiveStepIndex(steps.length);
    }
  }, [currentStep, status]);

  // Render not found state
  if (isNotFound) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-[url('/grid-pattern.svg')] bg-[length:32px_32px] bg-slate-50 dark:bg-[#0b0b0d]">
        <div className="bg-white/80 dark:bg-[#0f0f12]/80 backdrop-blur-xl p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-xl w-full text-center flex flex-col items-center gap-6">
          <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center text-amber-500">
            <AlertTriangle size={32} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Workspace Not Found</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-2 max-w-md">
              This repository workspace does not exist or has been deleted.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="px-6 py-3 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-500 active:scale-98 transition-all"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Loading pipeline status overlay
  if (status === "loading") {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950/20 dark:bg-[#0f0f11]/20">
        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
        <p className="mt-4 text-sm text-slate-400 font-medium">Loading workspace data...</p>
      </div>
    );
  }

  // Failed state overlay
  if (status === "failed") {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-[url('/grid-pattern.svg')] bg-[length:32px_32px] bg-slate-50 dark:bg-[#0b0b0d]">
        <div className="bg-white/80 dark:bg-[#0f0f12]/80 backdrop-blur-xl p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-xl w-full text-center flex flex-col items-center gap-6">
          <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center text-rose-500">
            <ShieldAlert size={32} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Analysis Failed</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-2 max-w-md">
              The AI pipeline was unable to complete the architecture mapping for this repository.
            </p>
          </div>

          {error && (
            <div className="w-full text-left p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 font-mono text-xs text-rose-400 overflow-x-auto max-h-36">
              {error}
            </div>
          )}

          <div className="flex gap-4 w-full justify-center">
            <button
              onClick={refetch}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-600 to-emerald-600 hover:opacity-90 active:scale-98 transition-all cursor-pointer"
            >
              <RefreshCw size={16} />
              Retry Analysis
            </button>
            <Link
              href={`/repo/${id}/logs`}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 active:scale-98 transition-all"
            >
              <Terminal size={16} />
              View Detail Logs
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Running or queued pipeline progress indicator
  if (status === "running" || status === "queued") {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-[url('/gridpattern.svg')] bg-[length:40px_40px] bg-slate-50 dark:bg-[#0a0a0c] overflow-y-auto">
        <div className="bg-white/80 dark:bg-[#0f0f13]/80 backdrop-blur-xl p-8 lg:p-10 rounded-[2.5rem] border border-slate-200 dark:border-slate-850 shadow-2xl max-w-3xl w-full">
          
          {/* Header */}
          <div className="text-center max-w-md mx-auto space-y-3 mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase tracking-wider animate-pulse">
              <RefreshCw size={12} className="animate-spin" />
              Mapping active
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 via-slate-800 to-slate-600 dark:from-white dark:via-slate-200 dark:to-slate-400 bg-clip-text text-transparent">
              Mapping Architecture
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
              We are scanning your codebase to generate class layouts, dependencies, and flow diagrams.
            </p>
          </div>

          {/* Stepper progress */}
          <div className="space-y-6 mb-10">
            {steps.map((step, index) => {
              const StepIcon = step.icon;
              const isCompleted = index < activeStepIndex;
              const isActive = index === activeStepIndex;
              const isPending = index > activeStepIndex;

              return (
                <div 
                  key={step.id}
                  className={`flex items-start gap-4 p-4 rounded-2xl border transition-all duration-300 ${
                    isActive 
                      ? "bg-blue-500/5 border-blue-500/20 shadow-lg shadow-blue-500/5 scale-[1.02]" 
                      : isCompleted 
                        ? "bg-slate-500/5 border-slate-200/50 dark:border-slate-800/40 opacity-70" 
                        : "bg-transparent border-transparent opacity-40"
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-300 ${
                    isActive 
                      ? "bg-blue-500 text-white border-blue-400 animate-pulse" 
                      : isCompleted 
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                        : "bg-slate-100 dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-slate-800"
                  }`}>
                    {isCompleted ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <StepIcon size={18} className={isActive ? "animate-spin-slow" : ""} />
                    )}
                  </div>

                  <div className="flex-1 space-y-0.5">
                    <div className="flex justify-between items-center">
                      <span className={`font-bold text-sm ${isActive ? "text-blue-500 dark:text-blue-400" : isCompleted ? "text-slate-800 dark:text-slate-200" : "text-slate-400"}`}>
                        {step.label}
                      </span>
                      {isActive && (
                        <span className="text-[10px] font-mono font-bold text-blue-500 dark:text-blue-400 uppercase tracking-widest animate-pulse">
                          In Progress
                        </span>
                      )}
                    </div>
                    <p className="text-slate-400 text-xs font-normal">
                      {step.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Log snippet */}
          {logs.length > 0 && (
            <div className="p-4 rounded-2xl bg-[#060608] border border-slate-800 text-left space-y-2">
              <div className="flex items-center justify-between text-slate-500 text-[10px] font-mono font-bold uppercase tracking-wider pb-2 border-b border-slate-800">
                <span className="flex items-center gap-1.5"><Terminal size={10} /> Live Output</span>
                <Link href={`/repo/${id}/logs`} className="hover:text-white transition-colors flex items-center gap-0.5">
                  Full Logs <ArrowRight size={10} />
                </Link>
              </div>
              <p className="font-mono text-xs text-slate-300 truncate">
                &gt; {logs[logs.length - 1].log}
              </p>
            </div>
          )}

          {/* Stop analysis button */}
          <div className="mt-6 flex justify-center">
            <button
              onClick={stopAnalysis}
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-semibold text-white bg-rose-600 hover:bg-rose-500 active:scale-98 transition-all cursor-pointer shadow-lg shadow-rose-900/20"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
              Stop Analysis Pipeline
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Completed - Render the architecture diagram
  // Show skeleton while diagram loads, then animate in
  if (diagramLoading || !diagram) {
    return (
      <div className="w-full h-full flex flex-col bg-slate-50 dark:bg-[#0a0a0c]">
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-[#0f0f13]/50 backdrop-blur-xl shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center text-emerald-500">
              <Workflow className="w-4 h-4" />
            </div>
            <div>
              <div className="h-4 w-40 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
              <div className="h-3 w-24 bg-slate-200 dark:bg-slate-800 rounded mt-1.5 animate-pulse" />
            </div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
            <p className="text-sm text-slate-400 font-medium">Loading architecture diagram...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="w-full h-full flex flex-col bg-slate-50 dark:bg-[#0a0a0c]"
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-[#0f0f13]/50 backdrop-blur-xl shrink-0">
        <div className="flex items-center gap-3">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
            className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center text-emerald-500"
          >
            <Workflow className="w-4 h-4" />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              {repo?.name || "Architecture"} — Component Map
            </h2>
            <p className="text-[11px] text-slate-400">
              {diagramNodes.length} components · {diagramEdges.length} relationships
            </p>
          </motion.div>
        </div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <Link
            href={`/repo/${id}/logs`}
            className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors flex items-center gap-1"
          >
            <Terminal className="w-3.5 h-3.5" />
            Pipeline Logs
          </Link>
        </motion.div>
      </div>
      {/* Canvas */}
      <div className="flex-1 min-h-0">
        <DiagramCanvas nodes={diagramNodes} edges={diagramEdges} />
      </div>
    </motion.div>
  );
}
