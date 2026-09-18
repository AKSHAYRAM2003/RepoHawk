"use client";

/**
 * CreditStatusPanel — Full-screen credit limit gate
 *
 * Displayed when a user has exhausted their analysis credits.
 * Inspired by Claude / ChatGPT usage limit screens.
 * Features:
 *  - Animated live countdown clock
 *  - Visual credit meter (filled/empty pips)
 *  - Reassurance that Q&A chat stays 100% free
 *  - Action buttons: browse repos, refresh quota, enter URL anyway
 */

import React, { useState, useEffect } from "react";
import {
  Clock,
  Zap,
  Lightbulb,
  RefreshCw,
  FolderGit2,
  ArrowRight,
  MessageSquare,
  Lock,
  Unlock,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/components/ThemeProvider";

export interface CreditStatusPanelProps {
  used: number;
  total: number;
  remaining: number;
  formattedResetTime: string;
  formattedCountdown: string;
  retryAfterSeconds: number | null;
  onRefresh?: () => void;
  onEnterAnyway?: () => void;
  className?: string;
}

/** Five pip indicators — filled/empty based on credits used */
function CreditPips({ total, used }: { total: number; used: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => {
        const isUsed = i < used;
        return (
          <div
            key={i}
            style={{
              width: 28,
              height: 10,
              borderRadius: 999,
              background: isUsed
                ? "linear-gradient(90deg, #f43f5e, #fb923c)"
                : "rgba(16,185,129,0.85)",
              boxShadow: isUsed
                ? "0 0 6px rgba(244,63,94,0.5)"
                : "0 0 6px rgba(16,185,129,0.5)",
              transition: "all 0.3s ease",
            }}
          />
        );
      })}
    </div>
  );
}

/** Animated ring countdown — shows pie-chart style progress for time remaining */
function CountdownRing({
  retryAfterSeconds,
  windowSeconds,
  isDark,
}: {
  retryAfterSeconds: number;
  windowSeconds: number;
  isDark: boolean;
}) {
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(1, retryAfterSeconds / windowSeconds));
  const dashOffset = circumference * (1 - progress);

  return (
    <div style={{ position: "relative", width: 96, height: 96 }}>
      <svg width="96" height="96" style={{ transform: "rotate(-90deg)" }}>
        {/* Background track */}
        <circle
          cx="48"
          cy="48"
          r={radius}
          fill="none"
          stroke={isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}
          strokeWidth="8"
        />
        {/* Progress arc */}
        <circle
          cx="48"
          cy="48"
          r={radius}
          fill="none"
          stroke="url(#creditGradient)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: "stroke-dashoffset 1s linear" }}
        />
        <defs>
          <linearGradient id="creditGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f43f5e" />
            <stop offset="100%" stopColor="#fb923c" />
          </linearGradient>
        </defs>
      </svg>
      {/* Center content */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Clock
          size={18}
          style={{ color: "#f43f5e", marginBottom: 2 }}
          className="animate-pulse"
        />
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            color: isDark ? "#fb7185" : "#e11d48",
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "-0.02em",
          }}
        >
          waiting
        </span>
      </div>
    </div>
  );
}

export default function CreditStatusPanel({
  used,
  total,
  remaining,
  formattedResetTime,
  formattedCountdown,
  retryAfterSeconds,
  onRefresh,
  onEnterAnyway,
  className = "",
}: CreditStatusPanelProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    await onRefresh?.();
    setTimeout(() => setIsRefreshing(false), 1500);
  };

  // Theme tokens
  const bg = isDark ? "rgba(18,18,22,0.0)" : "rgba(255,255,255,0.0)";
  const titleColor = isDark ? "#ffffff" : "#0f172a";
  const subtitleColor = isDark ? "#9ca3af" : "#64748b";
  const borderColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";
  const panelBg = isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)";
  const windowSeconds = (total > 0 ? 4 : 4) * 3600;

  return (
    <div
      className={`flex flex-col gap-6 ${className}`}
      style={{ background: bg }}
    >
      {/* ── Status Pill ─────────────────────────── */}
      <div className="flex items-center gap-2">
        <span
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
          style={{
            background: isDark
              ? "rgba(244, 63, 94, 0.15)"
              : "rgba(244, 63, 94, 0.08)",
            border: "1px solid rgba(244, 63, 94, 0.3)",
            color: isDark ? "#fb7185" : "#e11d48",
          }}
        >
          <Lock size={11} />
          Quota Limit Reached · {remaining} of {total} Credits Left
        </span>
      </div>

      {/* ── Header ──────────────────────────────── */}
      <div className="pr-8">
        <h2
          className="m-0 text-2xl sm:text-[28px] font-extrabold tracking-tight"
          style={{ color: titleColor }}
        >
          Analysis Limit Reached
        </h2>
        <p
          className="mt-1.5 text-sm leading-relaxed m-0"
          style={{ color: subtitleColor }}
        >
          You&apos;ve analyzed {used} repositor{used === 1 ? "y" : "ies"} in
          this 4-hour window. Credits refresh automatically — no action needed.
        </p>
      </div>

      {/* ── Credit Meter ────────────────────────── */}
      <div
        className="p-4 sm:p-5 rounded-2xl border flex flex-col gap-4"
        style={{ background: panelBg, borderColor }}
      >
        {/* Pips + ring row */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex flex-col gap-2">
            <p
              className="text-[10px] font-bold uppercase tracking-wider m-0"
              style={{ color: subtitleColor }}
            >
              Credits Used This Window
            </p>
            <CreditPips total={total} used={used} />
            <p className="text-xs m-0" style={{ color: subtitleColor }}>
              <span
                className="font-bold"
                style={{ color: isDark ? "#fb7185" : "#e11d48" }}
              >
                {used}/{total}
              </span>{" "}
              used · resets every 4 hours
            </p>
          </div>

          {retryAfterSeconds !== null && retryAfterSeconds > 0 && (
            <CountdownRing
              retryAfterSeconds={retryAfterSeconds}
              windowSeconds={windowSeconds}
              isDark={isDark}
            />
          )}
        </div>

        {/* Next unlock time */}
        <div
          className="pt-3 border-t flex items-center justify-between gap-3 flex-wrap"
          style={{ borderColor }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{
                background: isDark
                  ? "rgba(251,191,36,0.12)"
                  : "rgba(251,191,36,0.1)",
                border: "1px solid rgba(251,191,36,0.25)",
              }}
            >
              <Clock size={15} className="text-amber-500" />
            </div>
            <div>
              <p
                className="text-[10px] font-bold uppercase tracking-wider m-0"
                style={{ color: subtitleColor }}
              >
                Next Credit Available
              </p>
              <p
                className="text-base font-extrabold m-0 tracking-tight"
                style={{ color: titleColor }}
              >
                {formattedResetTime || "Within 4 hours"}
              </p>
            </div>
          </div>

          {formattedCountdown && (
            <div
              className="px-3 py-1.5 rounded-full text-xs font-mono font-bold flex items-center gap-2"
              style={{
                background: isDark
                  ? "rgba(251,191,36,0.1)"
                  : "rgba(251,191,36,0.08)",
                border: "1px solid rgba(251,191,36,0.3)",
                color: isDark ? "#fbbf24" : "#b45309",
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping shrink-0"
                style={{ display: "inline-block" }}
              />
              ~{formattedCountdown} remaining
            </div>
          )}
        </div>

        <p
          className="text-[11px] leading-relaxed m-0"
          style={{ color: subtitleColor, opacity: 0.8 }}
        >
          Quota resets in a rolling 4-hour sliding window (5 repositories max).
          The oldest analyzed repo&apos;s credit slot unlocks first.
        </p>
      </div>

      {/* ── Free Chat Reassurance ────────────────── */}
      <div
        className="p-4 rounded-2xl flex items-start gap-3"
        style={{
          background: "color-mix(in srgb, #10b981 10%, transparent)",
          border: "1px solid color-mix(in srgb, #10b981 30%, transparent)",
        }}
      >
        <Lightbulb
          size={20}
          className="shrink-0 text-amber-500 fill-amber-300/30 mt-0.5"
        />
        <div>
          <p
            className="text-sm font-bold m-0 mb-0.5"
            style={{ color: isDark ? "#34d399" : "#065f46" }}
          >
            💬 Once analyzed, Q&amp;A chat is 100% free &amp; unlimited!
          </p>
          <p
            className="text-xs leading-relaxed m-0"
            style={{
              color: isDark ? "#a7f3d0" : "#047857",
              opacity: 0.9,
            }}
          >
            You can freely ask questions, explore architecture maps, inspect
            dependencies, and generate READMEs for all your existing indexed
            repositories — no credits required.
          </p>
        </div>
      </div>

      {/* ── Action Buttons ───────────────────────── */}
      <div className="flex flex-col gap-3 pt-1">
        {/* Primary: Browse repos */}
        <button
          type="button"
          onClick={() => {
            router.push(`/dashboard/${user?.id || ""}`);
          }}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            width: "100%",
            height: 52,
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.15)",
            fontSize: 15,
            fontWeight: 700,
            cursor: "pointer",
            color: "white",
            background: "linear-gradient(to bottom, #4a50c5, #00b08a)",
            boxShadow:
              "0 8px 24px rgba(74,80,197,0.3), inset 0 2px 1px rgba(255,255,255,0.35), inset 0 -2px 2px rgba(0,0,0,0.2)",
            transition: "all 200ms ease",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.transform = "translateY(-2px)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.transform = "translateY(0)")
          }
        >
          <FolderGit2 size={18} />
          <span>Browse My Repositories</span>
          <ArrowRight size={16} />
        </button>

        {/* Secondary actions row */}
        <div
          className="flex items-center justify-between text-xs px-1"
          style={{ color: subtitleColor }}
        >
          <button
            type="button"
            onClick={handleRefresh}
            className="flex items-center gap-1.5 font-semibold cursor-pointer bg-transparent border-0 p-0 hover:underline"
            style={{ color: "inherit" }}
          >
            <RefreshCw
              size={12}
              className={isRefreshing ? "animate-spin" : ""}
            />
            <span>Check if credit unlocked</span>
          </button>

          {onEnterAnyway && (
            <button
              type="button"
              onClick={onEnterAnyway}
              className="font-medium cursor-pointer bg-transparent border-0 p-0 hover:underline opacity-70 hover:opacity-100"
              style={{ color: "inherit" }}
            >
              Enter URL anyway
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
