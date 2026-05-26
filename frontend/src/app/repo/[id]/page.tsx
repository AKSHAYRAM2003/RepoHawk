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
  const { diagram, loading: diagramLoading } = useDiagram(id, status);
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
      <div className="w-full h-full flex flex-col items-center p-4 sm:p-8 bg-[#0a0a0c] overflow-y-auto">
        <div className="my-auto bg-[#0f0f12]/80 backdrop-blur-xl p-6 sm:p-8 rounded-2xl sm:rounded-3xl border border-slate-800 shadow-2xl max-w-md w-full text-center flex flex-col items-center gap-5">
          <div className="w-14 h-14 sm:w-16 sm:h-16 bg-amber-500/10 rounded-full flex items-center justify-center text-amber-500">
            <AlertTriangle size={28} />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white">Workspace Not Found</h2>
            <p className="text-slate-400 text-sm mt-2">
              This repository workspace does not exist or has been deleted.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="w-full px-6 py-3 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-all text-center"
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
      <div className="w-full h-full flex flex-col items-center p-4 sm:p-8 bg-[#0a0a0c] overflow-y-auto">
        <div className="my-auto bg-[#0f0f12]/80 backdrop-blur-xl p-6 sm:p-8 rounded-2xl sm:rounded-3xl border border-slate-800 shadow-2xl max-w-md w-full text-center flex flex-col items-center gap-5">
          <div className="w-14 h-14 sm:w-16 sm:h-16 bg-rose-500/10 rounded-full flex items-center justify-center text-rose-500">
            <ShieldAlert size={28} />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white">Analysis Failed</h2>
            <p className="text-slate-400 text-sm mt-2">
              The AI pipeline was unable to complete the architecture mapping for this repository.
            </p>
          </div>

          {error && (
            <div className="w-full text-left p-3 sm:p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 font-mono text-xs text-rose-400 overflow-x-auto max-h-32">
              {error}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <button
              onClick={refetch}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-600 to-emerald-600 hover:opacity-90 transition-all cursor-pointer"
            >
              <RefreshCw size={16} />
              Retry Analysis
            </button>
            <Link
              href={`/repo/${id}/logs`}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold border border-slate-800 text-slate-300 hover:bg-slate-900 transition-all"
            >
              <Terminal size={16} />
              View Logs
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Running or queued pipeline progress indicator
  if (status === "running" || status === "queued") {
    return (
      <div className="w-full h-full flex flex-col items-center p-3 sm:p-6 lg:p-8 bg-[#0a0a0c] overflow-y-auto">
        <div className="my-auto bg-[#0f0f13]/90 backdrop-blur-xl p-5 sm:p-7 lg:p-10 rounded-2xl sm:rounded-[2rem] border border-slate-800/80 shadow-2xl w-full max-w-xl lg:max-w-2xl">

          {/* Header */}
          <div className="text-center max-w-md mx-auto space-y-2 sm:space-y-3 mb-6 sm:mb-8 lg:mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] sm:text-xs font-mono font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase tracking-wider animate-pulse">
              <RefreshCw size={11} className="animate-spin" />
              Mapping active
            </div>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              Mapping Architecture
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
              We are scanning your codebase to generate class layouts, dependencies, and flow diagrams.
            </p>
          </div>

          {/* Stepper progress */}
          <div className="space-y-3 sm:space-y-4 mb-6 sm:mb-8 lg:mb-10">
            {steps.map((step, index) => {
              const StepIcon = step.icon;
              const isCompleted = index < activeStepIndex;
              const isActive = index === activeStepIndex;

              return (
                <div
                  key={step.id}
                  className={`flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl sm:rounded-2xl border transition-all duration-300 ${
                    isActive
                      ? "bg-blue-500/5 border-blue-500/20 shadow-lg shadow-blue-500/5 scale-[1.01] sm:scale-[1.02]"
                      : isCompleted
                        ? "bg-slate-800/30 border-slate-800/50 opacity-70"
                        : "bg-transparent border-transparent opacity-35"
                  }`}
                >
                  {/* Step icon */}
                  <div className={`w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0 rounded-lg sm:rounded-xl flex items-center justify-center border transition-all duration-300 ${
                    isActive
                      ? "bg-blue-500 text-white border-blue-400 animate-pulse"
                      : isCompleted
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : "bg-slate-900 text-slate-500 border-slate-800"
                  }`}>
                    {isCompleted ? (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <StepIcon size={16} className={isActive ? "animate-spin-slow" : ""} />
                    )}
                  </div>

                  {/* Step text */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`font-bold text-xs sm:text-sm truncate ${
                        isActive ? "text-blue-400" : isCompleted ? "text-slate-200" : "text-slate-500"
                      }`}>
                        {step.label}
                      </span>
                      {isActive && (
                        <span className="flex-shrink-0 text-[9px] sm:text-[10px] font-mono font-bold text-blue-400 uppercase tracking-widest animate-pulse">
                          In Progress
                        </span>
                      )}
                    </div>
                    <p className="text-slate-500 text-[10px] sm:text-xs font-normal truncate">
                      {step.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Log snippet */}
          {logs.length > 0 && (
            <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-[#060608] border border-slate-800 text-left space-y-2">
              <div className="flex items-center justify-between text-slate-500 text-[9px] sm:text-[10px] font-mono font-bold uppercase tracking-wider pb-2 border-b border-slate-800">
                <span className="flex items-center gap-1.5">
                  <Terminal size={10} /> Live Output
                </span>
                <Link href={`/repo/${id}/logs`} className="hover:text-white transition-colors flex items-center gap-0.5">
                  Full Logs <ArrowRight size={10} />
                </Link>
              </div>
              <p className="font-mono text-[10px] sm:text-xs text-slate-300 truncate">
                &gt; {logs[logs.length - 1].log}
              </p>
            </div>
          )}

          {/* Stop analysis button */}
          <div className="mt-4 sm:mt-6">
            <button
              onClick={stopAnalysis}
              className="flex items-center justify-center gap-2 w-full py-3 sm:py-3.5 rounded-xl font-semibold text-white bg-rose-600 hover:bg-rose-500 transition-all cursor-pointer shadow-lg shadow-rose-900/20 text-sm"
            >
              <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-white animate-pulse" />
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
