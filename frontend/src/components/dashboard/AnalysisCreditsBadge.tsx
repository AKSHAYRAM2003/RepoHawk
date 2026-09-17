"use client";

import React, { useState, useEffect } from "react";
import { Zap, Clock } from "lucide-react";

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
      <div
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all select-none border backdrop-blur-md"
        style={{
          background: isExhausted
            ? "color-mix(in srgb, #f43f5e 8%, var(--surface-container-low, #1c1b1b))"
            : "var(--surface-container-low, #1c1b1b)",
          borderColor: isExhausted
            ? "color-mix(in srgb, #f43f5e 35%, transparent)"
            : isLow
            ? "color-mix(in srgb, #f59e0b 35%, var(--outline-variant, #464653))"
            : "var(--outline-variant, #464653)",
          color: "var(--on-surface, #e5e2e1)",
        }}
      >
        <Zap
          size={13}
          fill={isExhausted ? "#f43f5e" : "#fbbf24"}
          style={{
            color: isExhausted ? "#f43f5e" : "#f59e0b",
            filter: isExhausted
              ? "drop-shadow(0 0 5px rgba(244, 63, 94, 0.5))"
              : "drop-shadow(0 0 5px rgba(251, 191, 36, 0.55))",
          }}
          className="shrink-0 transition-transform hover:scale-110"
        />

        <div className="flex items-baseline gap-0.5">
          <span
            className="font-mono font-bold tracking-tight text-xs"
            style={{
              color: isExhausted
                ? "#fb7185"
                : isLow
                ? "#fbbf24"
                : "var(--on-surface, #ffffff)",
            }}
          >
            {loading ? "—" : remaining}
          </span>
          <span
            className="font-mono text-[10px] font-medium"
            style={{ color: "var(--on-surface-variant, #908f9f)", opacity: 0.7 }}
          >
            /{total}
          </span>
        </div>

        <span
          className="text-[11px] font-medium hidden sm:inline"
          style={{ color: "var(--on-surface-variant, #c6c5d5)" }}
        >
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
            width: 240,
            borderRadius: 14,
            padding: "12px 14px",
            background: "var(--surface-container-high, #201f1f)",
            border: "1px solid var(--outline-variant, #464653)",
            boxShadow: "0 14px 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.08)",
            backdropFilter: "blur(16px)",
          }}
        >
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
            <span
              className="text-[10px] font-bold uppercase tracking-wider"
              style={{ color: "var(--on-surface-variant, #908f9f)" }}
            >
              Analysis Quota
            </span>
            <span
              className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full flex items-center gap-1"
              style={{
                background: isExhausted
                  ? "rgba(244, 63, 94, 0.15)"
                  : "rgba(245, 158, 11, 0.15)",
                color: isExhausted ? "#fb7185" : "#fbbf24",
                border: `1px solid ${isExhausted ? "rgba(244, 63, 94, 0.3)" : "rgba(245, 158, 11, 0.3)"}`,
              }}
            >
              <Zap size={10} fill="currentColor" />
              {remaining} of {total} left
            </span>
          </div>

          <p
            className="text-[11px] leading-relaxed m-0"
            style={{ color: "var(--on-surface, #e5e2e1)" }}
          >
            {used === 0
              ? "Each successfully analyzed repo consumes 1 credit."
              : `Used ${used} credit${used > 1 ? "s" : ""} for ${used} analyzed repo${used > 1 ? "s" : ""}.`}
          </p>

          <div
            className="mt-2.5 pt-2 border-t border-white/5 flex items-center gap-1.5 text-[10px]"
            style={{ color: "var(--on-surface-variant, #908f9f)" }}
          >
            <Clock size={11} className="shrink-0 opacity-80" />
            <span>Quota refreshes hourly (sliding window)</span>
          </div>
        </div>
      )}
    </div>
  );
}
