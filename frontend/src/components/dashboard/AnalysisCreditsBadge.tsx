"use client";

import React, { useState, useEffect } from "react";
import { Zap, Clock, Lightbulb } from "lucide-react";

export function computeAnalysisCredits(repos: Array<{ analysis_status: string }>): {
  total: number;
  used: number;
  remaining: number;
} {
  const TOTAL_CREDITS = 5;
  const completedCount = repos.filter((r) => r.analysis_status === "complete").length;
  const used = Math.min(TOTAL_CREDITS, completedCount);
  const remaining = Math.max(0, TOTAL_CREDITS - used);
  return { total: TOTAL_CREDITS, used, remaining };
}

interface AnalysisCreditsBadgeProps {
  repos?: Array<{ analysis_status: string }>;
  className?: string;
}

export default function AnalysisCreditsBadge({
  repos: propRepos,
  className = "",
}: AnalysisCreditsBadgeProps) {
  const [internalRepos, setInternalRepos] = useState<Array<{ analysis_status: string }>>([]);
  const [loading, setLoading] = useState(!propRepos);
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    if (propRepos) {
      setInternalRepos(propRepos);
      setLoading(false);
      return;
    }

    let cancelled = false;
    fetch("/api/repos", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (!cancelled && Array.isArray(data)) {
          setInternalRepos(data);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [propRepos]);

  const activeRepos = propRepos ?? internalRepos;
  const { total, used, remaining } = computeAnalysisCredits(activeRepos);

  const isExhausted = remaining === 0;
  const isLow = remaining <= 2 && remaining > 0;

  return (
    <div
      className={`relative inline-flex items-center ${showTooltip ? "z-[100]" : "z-10"} ${className}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Pill Badge */}
      <div
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all select-none border backdrop-blur-md shadow-sm ${
          isExhausted
            ? "bg-rose-50 border-rose-300 text-rose-700 dark:bg-rose-500/10 dark:border-rose-500/35 dark:text-rose-300"
            : isLow
            ? "bg-amber-50/80 border-amber-300/80 text-amber-900 dark:bg-amber-500/10 dark:border-amber-500/35 dark:text-amber-300"
            : "bg-surface-container-low border-outline-variant text-on-surface hover:border-outline"
        }`}
      >
        <Zap
          size={13}
          className={`shrink-0 transition-transform hover:scale-110 ${
            isExhausted
              ? "text-rose-500 fill-rose-500"
              : isLow
              ? "text-amber-500 fill-amber-500 dark:text-amber-400 dark:fill-amber-400"
              : "text-amber-500 fill-amber-500 dark:text-amber-400 dark:fill-amber-400"
          }`}
          style={{
            filter: isExhausted
              ? "drop-shadow(0 0 4px rgba(244, 63, 94, 0.4))"
              : "drop-shadow(0 0 4px rgba(245, 158, 11, 0.45))",
          }}
        />

        <div className="flex items-baseline gap-0.5 font-mono">
          <span
            className={`font-bold tracking-tight text-xs ${
              isExhausted
                ? "text-rose-600 dark:text-rose-300"
                : isLow
                ? "text-amber-700 dark:text-amber-300"
                : "text-on-surface"
            }`}
          >
            {loading ? "—" : remaining}
          </span>
          <span className="text-[10.5px] font-medium text-on-surface-variant opacity-60">
            /{total}
          </span>
        </div>

        <span className="text-[11px] font-medium text-on-surface-variant hidden sm:inline">
          Credits
        </span>
      </div>

      {/* Floating Explanatory Tooltip Popover */}
      {showTooltip && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            zIndex: 9999,
            width: 255,
          }}
          className="rounded-2xl p-3.5 bg-surface-container-lowest dark:bg-[#1e1e24] border border-outline-variant shadow-xl dark:shadow-[0_16px_40px_rgba(0,0,0,0.7)] backdrop-blur-xl"
        >
          {/* Header Row */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-outline-variant/40 dark:border-white/10">
            <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
              Analysis Quota
            </span>
            <span
              className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border ${
                isExhausted
                  ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30"
                  : "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30"
              }`}
            >
              <Zap size={10} className="fill-current" />
              {remaining} of {total} left
            </span>
          </div>

          {/* Usage description */}
          <p className="text-[11.5px] text-on-surface leading-relaxed m-0">
            {used === 0
              ? "Each analyzed repo consumes 1 credit (5/hr limit)."
              : `Used ${used} credit${used > 1 ? "s" : ""} for ${used} analyzed repo${used > 1 ? "s" : ""}.`}
          </p>

          {/* Unlimited Free Chat Announcement Box */}
          <div className="my-2.5 p-2.5 rounded-xl flex items-center gap-2 text-[11.5px] bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/25">
            <Lightbulb size={14} className="shrink-0 text-amber-600 dark:text-amber-300 fill-amber-500/20" />
            <span className="leading-snug">
              Once analyzed, Q&A chat is <strong className="font-semibold text-emerald-900 dark:text-emerald-200">100% free & unlimited</strong>.
            </span>
          </div>

          {/* Window footnote */}
          <div className="pt-1.5 border-t border-outline-variant/30 dark:border-white/5 flex items-center gap-1.5 text-[10px] text-on-surface-variant opacity-75">
            <Clock size={11} className="shrink-0" />
            <span>5 analysis credits / hour sliding window</span>
          </div>
        </div>
      )}
    </div>
  );
}
