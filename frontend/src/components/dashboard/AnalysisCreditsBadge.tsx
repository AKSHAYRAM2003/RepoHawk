"use client";

import React, { useState } from "react";
import { Zap, Clock, Lightbulb } from "lucide-react";
import { useCredits } from "@/hooks/useCredits";

export interface CreditInfo {
  total: number;
  used: number;
  remaining: number;
  resetSecondsRemaining: number;
  nextRefreshDate: Date | null;
  formattedResetTime: string;
  formattedCountdown: string;
}

function parseUtcTime(dateStr?: string | null): number {
  if (!dateStr) return 0;
  const str = dateStr.trim();
  // Ensure ISO timestamp without timezone offset is parsed as UTC
  const normalized = str.endsWith("Z") || /[+-]\d{2}(:\d{2})?$/.test(str)
    ? str
    : str.replace(" ", "T") + "Z";
  const parsed = new Date(normalized).getTime();
  return isNaN(parsed) ? new Date(str).getTime() : parsed;
}

/**
 * Legacy helper — kept for backwards compatibility with AnalyzeModal
 * which computes credits client-side from the repo list.
 * Prefer using useCredits() hook for server-authoritative values.
 */
export function computeAnalysisCredits(
  repos: Array<{ analysis_status: string; created_at?: string | null }>,
  windowHours: number = 4
): CreditInfo {
  const TOTAL_CREDITS = 5;
  const WINDOW_MS = windowHours * 60 * 60 * 1000;
  const now = Date.now();

  const windowRepos = repos
    .filter((r) => {
      if (r.analysis_status === "failed") return false;
      if (!r.created_at) return true;
      const createdTime = parseUtcTime(r.created_at);
      return !isNaN(createdTime) && now - createdTime < WINDOW_MS;
    })
    .sort((a, b) => {
      const timeA = parseUtcTime(a.created_at);
      const timeB = parseUtcTime(b.created_at);
      return timeA - timeB;
    });

  const used = Math.min(TOTAL_CREDITS, windowRepos.length);
  const remaining = Math.max(0, TOTAL_CREDITS - used);

  let resetSecondsRemaining = 0;
  let nextRefreshDate: Date | null = null;

  if (remaining === 0 && windowRepos.length > 0) {
    const oldestTime = windowRepos[0].created_at
      ? parseUtcTime(windowRepos[0].created_at)
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
  /**
   * Optional repo list for optimistic initial display while server credits load.
   */
  repos?: Array<{ analysis_status: string; created_at?: string | null }>;
  className?: string;
}

export default function AnalysisCreditsBadge({
  repos: propRepos,
  className = "",
}: AnalysisCreditsBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  // Always use the server-authoritative hook for the real count
  const serverCredits = useCredits();

  // Prefer server-authoritative credits from the API/database
  let total = serverCredits.total;
  let remaining = serverCredits.remaining;
  let used = serverCredits.used;
  let formattedResetTime = serverCredits.formattedResetTime;
  let formattedCountdown = serverCredits.formattedCountdown;
  let isLoading = serverCredits.isLoading;

  // Only fallback to client-side compute if serverCredits is still loading and repos are provided
  if (serverCredits.isLoading && propRepos && propRepos.length > 0) {
    const computed = computeAnalysisCredits(propRepos, 4);
    total = computed.total;
    remaining = computed.remaining;
    used = computed.used;
    formattedResetTime = computed.formattedResetTime;
    formattedCountdown = computed.formattedCountdown;
    isLoading = false;
  }

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
            {isLoading ? "—" : remaining}
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
            width: 268,
            borderRadius: 14,
            padding: "12px 14px",
            background: "var(--surface-container-high, #201f1f)",
            border: "1px solid var(--outline-variant, #464653)",
            boxShadow:
              "0 14px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)",
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
                border: `1px solid ${
                  isExhausted
                    ? "rgba(244, 63, 94, 0.3)"
                    : "rgba(245, 158, 11, 0.3)"
                }`,
              }}
            >
              <Zap size={10} fill="currentColor" />
              {remaining} of {total} left
            </span>
          </div>

          {/* Credit pips */}
          <div className="flex items-center gap-1 mb-3">
            {Array.from({ length: total }).map((_, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: 6,
                  borderRadius: 999,
                  background:
                    i < used
                      ? "linear-gradient(90deg, #f43f5e, #fb923c)"
                      : "#10b981",
                  opacity: i < used ? 0.9 : 0.85,
                  boxShadow: i < used
                    ? "0 0 4px rgba(244,63,94,0.4)"
                    : "0 0 4px rgba(16,185,129,0.4)",
                }}
              />
            ))}
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
              className="my-2 p-2.5 rounded-xl text-[11px]"
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
                Credits refresh at{" "}
                <strong>{formattedResetTime || "soon"}</strong>
                {formattedCountdown ? ` (~${formattedCountdown} remaining)` : ""}
                .
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
            <Lightbulb
              size={13}
              className="shrink-0 text-amber-500 fill-amber-300/30"
            />
            <span className="leading-tight">
              Once analyzed, Q&amp;A chat is{" "}
              <strong>100% free &amp; unlimited</strong>.
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
