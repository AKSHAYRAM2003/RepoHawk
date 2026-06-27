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
  const { repo, status, logs, currentStep, error, isNotFound, refetch, stopAnalysis, retryAnalysis } = useRepoAnalysis(id);
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

  useEffect(() => {
    const idx = steps.findIndex(s => s.id === currentStep);
    if (idx !== -1 && idx !== activeStepIndex) {
      setActiveStepIndex(idx);
    } else if (status === "complete" && activeStepIndex !== steps.length) {
      setActiveStepIndex(steps.length);
    }
  }, [currentStep, status, activeStepIndex, steps.length, steps]);

  // ── Not Found ────────────────────────────────────────────────────────────────
  if (isNotFound) {
    return (
      <div className="w-full h-full flex flex-col items-center p-4 sm:p-8 bg-surface overflow-y-auto">
        <div className="my-auto bg-surface-mid backdrop-blur-xl p-6 sm:p-8 rounded-2xl sm:rounded-3xl border border-outline-variant shadow-2xl max-w-md w-full text-center flex flex-col items-center gap-5">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center" style={{ background: "color-mix(in srgb, #f59e0b 12%, transparent)", color: "#f59e0b" }}>
            <AlertTriangle size={28} />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-on-surface">Workspace Not Found</h2>
            <p className="text-on-surface-variant text-sm mt-2">
              This repository workspace does not exist or has been deleted.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="w-full px-6 py-3 rounded-xl font-semibold text-on-primary bg-primary-accent hover:opacity-90 transition-all text-center"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (status === "loading") {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-surface">
        <RefreshCw className="w-8 h-8 animate-spin text-primary-color" />
        <p className="mt-4 text-sm text-on-surface-variant font-medium">Loading workspace data...</p>
      </div>
    );
  }

  // ── Failed ───────────────────────────────────────────────────────────────────
  // ── Failed ───────────────────────────────────────────────────────────────────
  const pipelineError = status === "failed" ? logs.find(l => l.status === "failed")?.log || logs[logs.length - 1]?.log : null;
  const rawError = error || pipelineError;

  const getFriendlyError = (raw: string | null) => {
    if (!raw) return "An unknown error occurred during analysis.";
    const msg = raw.toLowerCase();
    
    if (msg.includes("git clone failed") || msg.includes("exit code(128)")) {
      return "We couldn't access this repository. Please make sure the URL is correct and the repository is public.";
    }
    if (msg.includes("invalid github url") || msg.includes("not found")) {
      return "The link provided doesn't look like a valid, public GitHub repository.";
    }
    if (msg.includes("rate limit") || msg.includes("429") || msg.includes("too many requests")) {
      return "The AI service is currently experiencing high traffic. Please try again in a few minutes.";
    }
    if (msg.includes("no parsed files") || msg.includes("blob:none")) {
      return "We couldn't find any supported source code files in this repository to analyze.";
    }
    if (msg.includes("timeout") || msg.includes("time out")) {
      return "The analysis took too long and timed out. The repository might be too large.";
    }
    
    // Clean up emojis from raw logs if no specific friendly message matches
    return raw.replace(/^[❌⚠️]\s*/, "");
  };

  const friendlyError = getFriendlyError(rawError);

  if (status === "failed") {
    return (
      <div className="w-full h-full flex flex-col items-center p-4 sm:p-8 bg-surface overflow-y-auto">
        <div className="my-auto bg-surface-mid backdrop-blur-xl p-6 sm:p-8 rounded-2xl sm:rounded-3xl border border-outline-variant shadow-2xl max-w-md w-full text-center flex flex-col items-center gap-5">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center" style={{ background: "color-mix(in srgb, #f43f5e 10%, transparent)", color: "#f43f5e" }}>
            <ShieldAlert size={28} />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-on-surface">Analysis Failed</h2>
            <p className="text-on-surface-variant text-sm mt-2">
              {friendlyError}
            </p>
          </div>

          {rawError && rawError !== friendlyError && (
            <div
              className="w-full text-left p-3 sm:p-4 rounded-xl border font-mono text-xs overflow-x-auto max-h-32 mt-2"
              style={{
                borderColor: "color-mix(in srgb, #f43f5e 20%, transparent)",
                background: "color-mix(in srgb, #f43f5e 5%, transparent)",
                color: "#f43f5e",
              }}
            >
              <span className="font-bold block mb-1">Technical details:</span>
              {rawError}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <button
              onClick={retryAnalysis}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-600 to-emerald-600 hover:opacity-90 transition-all cursor-pointer"
            >
              <RefreshCw size={16} />
              Retry Analysis
            </button>
            <Link
              href={`/repo/${id}/logs`}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold border border-outline-variant text-on-surface-variant hover:bg-surface-high transition-all"
            >
              <Terminal size={16} />
              View Logs
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Running / Queued ─────────────────────────────────────────────────────────
  if (status === "running" || status === "queued") {
    return (
      <div className="w-full h-full flex flex-col items-center p-3 sm:p-6 lg:p-8 bg-surface overflow-y-auto">
        <div className="my-auto bg-surface-mid backdrop-blur-xl p-5 sm:p-7 lg:p-10 rounded-2xl sm:rounded-[2rem] border border-outline-variant shadow-2xl w-full max-w-xl lg:max-w-2xl">

          {/* Header */}
          <div className="text-center max-w-md mx-auto space-y-2 sm:space-y-3 mb-6 sm:mb-8 lg:mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] sm:text-xs font-mono font-bold uppercase tracking-wider animate-pulse"
              style={{
                background: "color-mix(in srgb, var(--primary) 10%, transparent)",
                color: "var(--primary)",
                border: "1px solid color-mix(in srgb, var(--primary) 25%, transparent)",
              }}
            >
              <RefreshCw size={11} className="animate-spin" />
              Mapping active
            </div>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-on-surface">
              Mapping Architecture
            </h2>
            <p className="text-on-surface-variant text-xs sm:text-sm leading-relaxed">
              We are scanning your codebase to generate class layouts, dependencies, and flow diagrams.
            </p>
          </div>

          {/* Stepper */}
          <div className="space-y-3 sm:space-y-4 mb-6 sm:mb-8 lg:mb-10">
            {steps.map((step, index) => {
              const StepIcon = step.icon;
              const isCompleted = index < activeStepIndex;
              const isActive = index === activeStepIndex;

              return (
                <div
                  key={step.id}
                  className={`flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl sm:rounded-2xl border transition-all duration-300`}
                  style={{
                    background: isActive
                      ? "color-mix(in srgb, var(--primary) 6%, transparent)"
                      : isCompleted
                        ? "color-mix(in srgb, var(--on-surface) 4%, transparent)"
                        : "transparent",
                    borderColor: isActive
                      ? "color-mix(in srgb, var(--primary) 25%, transparent)"
                      : isCompleted
                        ? "var(--outline-variant)"
                        : "transparent",
                    opacity: !isActive && !isCompleted ? 0.35 : 1,
                    transform: isActive ? "scale(1.01)" : "scale(1)",
                  }}
                >
                  <div
                    className="w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0 rounded-lg sm:rounded-xl flex items-center justify-center border transition-all duration-300"
                    style={{
                      background: isActive
                        ? "var(--primary)"
                        : isCompleted
                          ? "color-mix(in srgb, #10b981 10%, transparent)"
                          : "color-mix(in srgb, var(--on-surface) 6%, transparent)",
                      borderColor: isActive
                        ? "var(--primary)"
                        : isCompleted
                          ? "color-mix(in srgb, #10b981 30%, transparent)"
                          : "var(--outline-variant)",
                      color: isActive ? "var(--on-primary)" : isCompleted ? "#10b981" : "var(--on-surface-variant)",
                    }}
                  >
                    {isCompleted ? (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <StepIcon size={16} className={isActive ? "animate-spin-slow" : ""} />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`font-bold text-xs sm:text-sm truncate ${
                        isActive ? "text-primary-color" : isCompleted ? "text-on-surface" : "text-on-surface-variant"
                      }`}>
                        {step.label}
                      </span>
                      {isActive && (
                        <span className="flex-shrink-0 text-[9px] sm:text-[10px] font-mono font-bold uppercase tracking-widest animate-pulse text-primary-color">
                          In Progress
                        </span>
                      )}
                    </div>
                    <p className="text-on-surface-variant text-[10px] sm:text-xs font-normal truncate mt-0.5">
                      {step.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Log snippet */}
          {logs.length > 0 && (
            <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-outline-variant bg-surface-lowest text-left space-y-2">
              <div className="flex items-center justify-between text-on-surface-variant text-[9px] sm:text-[10px] font-mono font-bold uppercase tracking-wider pb-2 border-b border-outline-variant">
                <span className="flex items-center gap-1.5">
                  <Terminal size={10} /> Live Output
                </span>
                <Link href={`/repo/${id}/logs`} className="hover:text-on-surface transition-colors flex items-center gap-0.5">
                  Full Logs <ArrowRight size={10} />
                </Link>
              </div>
              <p className="font-mono text-[10px] sm:text-xs text-on-surface truncate">
                &gt; {logs[logs.length - 1].log}
              </p>
            </div>
          )}

          {/* Stop button */}
          <div className="mt-4 sm:mt-6">
            <button
              onClick={stopAnalysis}
              className="flex items-center justify-center gap-2 w-full py-3 sm:py-3.5 rounded-xl font-semibold text-white bg-rose-600 hover:bg-rose-500 transition-all cursor-pointer shadow-lg text-sm"
            >
              <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-white animate-pulse" />
              Stop Analysis Pipeline
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Diagram loading skeleton ──────────────────────────────────────────────────
  if (diagramLoading || !diagram) {
    return (
      <div className="w-full h-full flex flex-col bg-surface">
        <div className="flex items-center justify-between px-6 py-3 border-b border-outline-variant bg-surface-low backdrop-blur-xl shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "color-mix(in srgb, #10b981 12%, transparent)", color: "#10b981" }}>
              <Workflow className="w-4 h-4" />
            </div>
            <div>
              <div className="h-4 w-40 bg-surface-highest rounded animate-pulse" />
              <div className="h-3 w-24 bg-surface-highest rounded mt-1.5 animate-pulse" />
            </div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center bg-surface">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-2 rounded-full animate-spin" style={{ borderColor: "color-mix(in srgb, var(--primary) 30%, transparent)", borderTopColor: "var(--primary)" }} />
            <p className="text-sm text-on-surface-variant font-medium">Loading architecture diagram...</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Complete — Render diagram ─────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="w-full h-full flex flex-col bg-surface"
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-outline-variant bg-surface-low backdrop-blur-xl shrink-0">
        <div className="flex items-center gap-3">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "color-mix(in srgb, #10b981 12%, transparent)", color: "#10b981" }}
          >
            <Workflow className="w-4 h-4" />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            <h2 className="text-sm font-bold text-on-surface">
              {repo?.name || "Architecture"} — Component Map
            </h2>
            <p className="text-[11px] text-on-surface-variant">
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
            className="text-xs text-on-surface-variant hover:text-on-surface transition-colors flex items-center gap-1"
          >
            <Terminal className="w-3.5 h-3.5" />
            Pipeline Logs
          </Link>
        </motion.div>
      </div>

      {/* Canvas */}
      <div className="flex-1 min-h-0">
        <DiagramCanvas nodes={diagramNodes} edges={diagramEdges} repoName={repo?.name ?? undefined} />
      </div>
    </motion.div>
  );
}
