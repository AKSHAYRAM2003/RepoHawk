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

  // Visual color tokens
  const badgeStyle = isExhausted
    ? {
        bg: "rgba(244, 63, 94, 0.12)",
        border: "1px solid rgba(244, 63, 94, 0.35)",
        text: "#fb7185",
        iconColor: "#f43f5e",
      }
    : isLow
    ? {
        bg: "rgba(245, 158, 11, 0.12)",
        border: "1px solid rgba(245, 158, 11, 0.35)",
        text: "#fbbf24",
        iconColor: "#f59e0b",
      }
    : {
        bg: "rgba(99, 102, 241, 0.1)",
        border: "1px solid rgba(99, 102, 241, 0.28)",
        text: "#a5b4fc",
        iconColor: "#818cf8",
      };

  return (
    <div
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all select-none hover:opacity-90"
        style={{
          background: badgeStyle.bg,
          border: badgeStyle.border,
          color: badgeStyle.text,
          backdropFilter: "blur(8px)",
        }}
      >
        <Zap
          size={13}
          fill={badgeStyle.iconColor}
          style={{
            color: badgeStyle.iconColor,
            filter: `drop-shadow(0 0 6px ${badgeStyle.iconColor})`,
          }}
        />
        <span className="font-mono font-bold tracking-tight">
          {loading ? "..." : `${remaining}/${total}`}
        </span>
        <span className="opacity-80 text-[11px] font-medium hidden sm:inline">Credits</span>
      </div>

      {/* Floating Explanatory Tooltip Popover */}
      {showTooltip && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            zIndex: 50,
            width: 230,
            borderRadius: 12,
            padding: "10px 12px",
            background: "var(--surface-container-high, #1e1e24)",
            border: "1px solid var(--outline-variant, rgba(255,255,255,0.12))",
            boxShadow: "0 8px 28px rgba(0,0,0,0.4)",
            backdropFilter: "blur(12px)",
          }}
        >
          <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-white/10">
            <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
              Analysis Quota
            </span>
            <span
              className="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded"
              style={{
                background: badgeStyle.bg,
                color: badgeStyle.text,
              }}
            >
              {remaining} / {total} left
            </span>
          </div>
          <p className="text-[11px] text-on-surface-variant leading-relaxed m-0">
            {used === 0
              ? "Each successfully analyzed repo consumes 1 credit."
              : `Used ${used} credit${used > 1 ? "s" : ""} for ${used} analyzed repo${used > 1 ? "s" : ""}.`}
          </p>
          <div className="mt-2 pt-1.5 border-t border-white/5 flex items-center gap-1.5 text-[10px] text-on-surface-variant opacity-75">
            <Clock size={10} />
            <span>5 credits per hour sliding window</span>
          </div>
        </div>
      )}
    </div>
  );
}
