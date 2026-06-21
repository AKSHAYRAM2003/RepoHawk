"use client";

import React, { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TerminalSquare, RefreshCw, AlertTriangle, CheckCircle, Flame, ArrowLeft } from "lucide-react";
import { useRepoAnalysis } from "@/hooks/useRepoAnalysis";
import Link from "next/link";

function LogEntry({ entry, index, isLatest }: { entry: { step: string; log: string; status: string }; index: number; isLatest: boolean }) {
  let colorClass = "text-slate-300";
  if (entry.log.startsWith("✅")) {
    colorClass = "text-emerald-400 font-semibold";
  } else if (entry.log.startsWith("❌")) {
    colorClass = "text-rose-400 font-semibold";
  } else if (entry.log.startsWith("⚠️")) {
    colorClass = "text-amber-400 font-semibold";
  } else if (entry.log.startsWith("📡")) {
    colorClass = "text-blue-400";
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, height: 0 }}
      animate={{ opacity: 1, y: 0, height: "auto" }}
      transition={{ duration: 0.35, ease: "easeOut", delay: index * 0.02 }}
      className={`flex items-start gap-2 ${colorClass} ${isLatest ? "relative" : ""}`}
    >
      <span className="text-slate-600 select-none shrink-0">[{entry.step}]</span>
      <motion.span
        initial={isLatest ? { clipPath: "inset(0 100% 0 0)" } : undefined}
        animate={isLatest ? { clipPath: "inset(0 0% 0 0)" } : undefined}
        transition={{ duration: 0.5, ease: "easeOut", delay: 0.2 }}
        className="whitespace-pre-wrap break-all"
      >
        {entry.log}
      </motion.span>
    </motion.div>
  );
}

export default function LogsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const { repo, status, logs, currentStep, error, isNotFound, refetch, stopAnalysis } = useRepoAnalysis(id);
  const logsEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

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

  const getStepDisplayName = (step: string) => {
    switch (step) {
      case "git_cloner": return "Cloning codebase...";
      case "ast_parser": return "Parsing AST & functions...";
      case "embedder": return "Vectorizing chunks...";
      case "architect": return "Mapping architecture...";
      case "critique": return "Reviewing mapping quality...";
      case "connected": return "Initializing connection...";
      default: return step;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="w-full h-full flex flex-col bg-[#0f0f11] text-slate-100 p-8 font-sans overflow-hidden"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-slate-400 text-xs">
            <Link href="/dashboard" className="hover:text-white transition-colors flex items-center gap-1">
              <ArrowLeft size={12} /> Workspaces
            </Link>
            <span>/</span>
            <span className="truncate max-w-[200px]">{repo?.name || id}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <TerminalSquare className="text-emerald-400" />
            Analysis Pipeline Logs
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {status === "running" && (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse">
              <RefreshCw size={12} className="animate-spin" />
              Running: {getStepDisplayName(currentStep)}
            </span>
          )}
          {status === "queued" && (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Flame size={12} className="animate-pulse" />
              Queued
            </span>
          )}
          {status === "complete" && (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle size={12} />
              Completed
            </span>
          )}
          {status === "failed" && (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <AlertTriangle size={12} />
              Failed
            </span>
          )}

          {status === "running" || status === "queued" ? (
            <button
              onClick={stopAnalysis}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-500 rounded-xl text-white active:scale-95 transition-all cursor-pointer shadow-sm shadow-rose-900/10"
            >
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              Stop Analysis
            </button>
          ) : (
            <button
              onClick={refetch}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-white hover:bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white active:scale-95 transition-all cursor-pointer shadow-sm"
            >
              <RefreshCw size={12} />
              Start Analysis
            </button>
          )}
        </div>
      </div>

      {/* Main Terminal Window */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="flex-1 min-h-0 rounded-2xl border border-slate-800 bg-[#060608]/90 shadow-2xl flex flex-col overflow-hidden relative backdrop-blur-xl"
      >
        {/* Terminal Title Bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-900/50 border-b border-slate-800/80">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[#ff5f56] shadow-inner opacity-80" />
            <div className="w-3 h-3 rounded-full bg-[#ffbd2e] shadow-inner opacity-80" />
            <div className="w-3 h-3 rounded-full bg-[#27c93f] shadow-inner opacity-80" />
          </div>
          <span className="font-mono text-xs text-slate-500 select-none">repohawk-worker.sh</span>
          <div className="w-12" />
        </div>

        {/* Terminal Body */}
        <div className="flex-1 overflow-y-auto p-6 font-mono text-[13px] leading-relaxed space-y-3 scrollbar-thin scrollbar-thumb-slate-800">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-slate-500"
          >
            [System Log Initialized - {new Date(repo?.created_at || new Date().toISOString()).toLocaleTimeString()}]
          </motion.div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-slate-500"
          >
            $ repohawk analyze --id={id} --url={repo?.github_url || "Fetching URL..."}
          </motion.div>

          <AnimatePresence initial={false}>
            {logs.map((entry, index) => (
              <LogEntry
                key={`${entry.step}-${index}`}
                entry={entry}
                index={index}
                isLatest={index === logs.length - 1 && (status === "running" || status === "queued")}
              />
            ))}
          </AnimatePresence>

          {status === "running" && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 text-blue-400"
            >
              <span className="text-slate-600 select-none">[{currentStep}]</span>
              <span className="flex items-center gap-2">
                <RefreshCw size={12} className="animate-spin" />
                Processing next node in LangGraph pipeline...
              </span>
            </motion.div>
          )}

          {status === "queued" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-slate-400 flex items-center gap-2"
            >
              <span className="text-slate-600 select-none">[queued]</span>
              <span className="flex items-center gap-2 animate-pulse">
                ⏳ Waiting in queue for an available agent...
              </span>
            </motion.div>
          )}

          {error && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-2 text-rose-400 border border-rose-500/20 bg-rose-500/5 p-3 rounded-lg mt-4"
            >
              <AlertTriangle className="flex-shrink-0 mt-0.5" size={16} />
              <div>
                <p className="font-bold">Fatal Pipeline Error:</p>
                <p className="mt-1">{error}</p>
              </div>
            </motion.div>
          )}

          <div ref={logsEndRef} />
        </div>
      </motion.div>
    </motion.div>
  );
}
