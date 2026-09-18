"use client";

import React, { useState, useEffect } from "react";
import { Zap, Clock, Lightbulb } from "lucide-react";

export interface CreditInfo {
  total: number;
  used: number;
  remaining: number;
  resetSecondsRemaining: number;
  nextRefreshDate: Date | null;
  formattedResetTime: string;
  formattedCountdown: string;
}

export function computeAnalysisCredits(
  repos: Array<{ analysis_status: string; created_at?: string | null }>,
  windowHours: number = 4
): CreditInfo {
  const TOTAL_CREDITS = 5;
  const WINDOW_MS = windowHours * 60 * 60 * 1000;
  const now = Date.now();

  // Active repos in current 4-hour sliding window (failed repos don't consume quota)
  const windowRepos = repos
    .filter((r) => {
      if (r.analysis_status === "failed") return false;
      if (!r.created_at) return true;
      const createdTime = new Date(r.created_at).getTime();
      return !isNaN(createdTime) && now - createdTime < WINDOW_MS;
    })
    .sort((a, b) => {
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return timeA - timeB;
    });

  const used = Math.min(TOTAL_CREDITS, windowRepos.length);
  const remaining = Math.max(0, TOTAL_CREDITS - used);

  let resetSecondsRemaining = 0;
  let nextRefreshDate: Date | null = null;

  if (remaining === 0 && windowRepos.length > 0) {
    const oldestTime = windowRepos[0].created_at
      ? new Date(windowRepos[0].created_at).getTime()
      : now - WINDOW_MS + 3600 * 1000;
    const refreshTime = oldestTime + WINDOW_MS;
    resetSecondsRemaining = Math.max(0, Math.ceil((refreshTime - now) / 1000));
    nextRefreshDate = new Date(refreshTime);
  }

  const formattedResetTime = nextRefreshDate
    ? nextRefreshDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : "";

  let formattedCountdown = "";
  if (resetSecondsRemaining > 0) {
    const h = Math.floor(resetSecondsRemaining / 3600);
    const m = Math.floor((resetSecondsRemaining % 3600) / 60);
    const s = resetSecondsRemaining % 60;
    if (h > 0) {
      formattedCountdown = `${h}h ${m}m`;
    } else if (m > 0) {
      formattedCountdown = `${m}m ${s}s`;
    } else {
      formattedCountdown = `${s}s`;
    }
  }

  return {
    total: TOTAL_CREDITS,
    used,
    remaining,
    resetSecondsRemaining,
    nextRefreshDate,
    formattedResetTime,
    formattedCountdown,
  };
}

interface AnalysisCreditsBadgeProps {
  repos?: Array<{ analysis_status: string; created_at?: string | null }>;
  className?: string;
}

export default function AnalysisCreditsBadge({
  repos: propRepos,
  className = "",
}: AnalysisCreditsBadgeProps) {
  const [internalRepos, setInternalRepos] = useState<Array<{ analysis_status: string; created_at?: string | null }>>([]);
  const [loading, setLoading] = useState(!propRepos);
  const [showTooltip, setShowTooltip] = useState(false);
  const [, setTick] = useState(0);

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

  // Live timer tick for accurate comeback countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const activeRepos = propRepos ?? internalRepos;
  const { total, used, remaining, formattedResetTime, formattedCountdown } = computeAnalysisCredits(activeRepos, 4);

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
            width: 250,
            borderRadius: 14,
            padding: "12px 14px",
            background: "var(--surface-container-high, #201f1f)",
            border: "1px solid var(--outline-variant, #464653)",
            boxShadow: "0 14px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)",
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
              ? "Each analyzed repo consumes 1 credit (5 per 4-hour window)."
              : `Used ${used} credit${used > 1 ? "s" : ""} for ${used} analyzed repo${used > 1 ? "s" : ""}.`}
          </p>

          {isExhausted && (
            <div
              className="my-2 p-2 rounded-xl text-[11px]"
              style={{
                background: "color-mix(in srgb, #f43f5e 10%, transparent)",
                border: "1px solid color-mix(in srgb, #f43f5e 30%, transparent)",
              }}
            >
              <div className="flex items-center gap-1.5 font-semibold text-rose-400">
                <Clock size={12} />
                <span>Limit reached</span>
              </div>
              <p className="mt-1 text-[11px] leading-tight m-0 text-rose-300/90">
                Credits refresh at <strong>{formattedResetTime || "soon"}</strong>
                {formattedCountdown ? ` (~${formattedCountdown} remaining)` : ""}.
              </p>
            </div>
          )}

          <div
            className="my-2.5 p-2 rounded-xl flex items-center gap-2 text-[11px]"
            style={{
              background: "color-mix(in srgb, #10b981 10%, transparent)",
              border: "1px solid color-mix(in srgb, #10b981 35%, transparent)",
              color: "#34d399",
            }}
          >
            <Lightbulb size={13} className="shrink-0 text-amber-500 fill-amber-300/30" />
            <span className="leading-tight">
              Once analyzed, Q&A chat is <strong>100% free & unlimited</strong>.
            </span>
          </div>

          <div
            className="mt-2.5 pt-2 border-t border-white/5 flex items-center gap-1.5 text-[10px]"
            style={{ color: "var(--on-surface-variant, #908f9f)" }}
          >
            <Clock size={11} className="shrink-0 opacity-80" />
            <span>5 analysis credits / 4-hour window</span>
          </div>
        </div>
      )}
    </div>
  );
}
