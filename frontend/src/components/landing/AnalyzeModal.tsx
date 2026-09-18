"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  X,
  UploadCloud,
  FileArchive,
  CheckCircle2,
  Clock,
  Lightbulb,
  FolderGit2,
  ArrowRight,
  RefreshCw,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "../ThemeProvider";
import { useAuth } from "@/contexts/AuthContext";
import { computeAnalysisCredits, CreditInfo } from "@/components/dashboard/AnalysisCreditsBadge";

interface AnalyzeModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  inline?: boolean;
}

export default function AnalyzeModal({ isOpen = true, onClose, inline = false }: AnalyzeModalProps) {
  const [repoUrl, setRepoUrl] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [activeTab, setActiveTab] = useState<"url" | "upload">("url");
  const [animState, setAnimState] = useState<"closed" | "opening" | "open" | "closing">("closed");
  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [credits, setCredits] = useState<CreditInfo | null>(null);
  const [rateLimitError, setRateLimitError] = useState<{
    retryAfterSeconds: number;
    message: string;
  } | null>(null);
  const [showInputFormOverride, setShowInputFormOverride] = useState(false);
  const [, setTick] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { user } = useAuth();

  // Theme tokens
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  useEffect(() => setMounted(true), []);

  // Fetch repos and evaluate credits
  const fetchQuota = useCallback(() => {
    fetch("/api/repos", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data)) {
          const computed = computeAnalysisCredits(data, 4);
          setCredits(computed);
          if (computed.remaining > 0) {
            setRateLimitError(null);
          }
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchQuota();
  }, [fetchQuota, isOpen]);

  // Live timer tick for countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (inline) {
      setAnimState("open");
      return;
    }
    if (isOpen) {
      setAnimState("opening");
      const t = setTimeout(() => setAnimState("open"), 20);
      return () => clearTimeout(t);
    } else {
      if (animState === "open" || animState === "opening") {
        setAnimState("closing");
        const t = setTimeout(() => {
          setAnimState("closed");
          setRepoUrl("");
          setUploadedFile(null);
          setIsDragging(false);
          setActiveTab("url");
          setShowInputFormOverride(false);
          setRateLimitError(null);
        }, 280);
        return () => clearTimeout(t);
      }
    }
  }, [isOpen, inline]);

  useEffect(() => {
    if (inline) return;
    if (animState !== "closed") {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
    return () => { document.body.style.overflow = "auto"; };
  }, [animState, inline]);

  const handleFile = useCallback((file: File) => {
    const valid = [".zip", ".tar.gz", ".tar"].some(ext => file.name.toLowerCase().endsWith(ext));
    if (valid) { setUploadedFile(file); setActiveTab("upload"); }
    else alert("Please upload a .zip or .tar.gz file.");
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (file) handleFile(file);
  };

  // Determine limit status
  const isLimitReached = (credits !== null && credits.remaining === 0) || rateLimitError !== null;

  let resetTimeStr = credits?.formattedResetTime || "";
  let countdownStr = credits?.formattedCountdown || "";

  if (rateLimitError) {
    const resetDate = new Date(Date.now() + rateLimitError.retryAfterSeconds * 1000);
    resetTimeStr = resetDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    const h = Math.floor(rateLimitError.retryAfterSeconds / 3600);
    const m = Math.floor((rateLimitError.retryAfterSeconds % 3600) / 60);
    const s = rateLimitError.retryAfterSeconds % 60;
    countdownStr = h > 0 ? `${h}h ${m}m` : (m > 0 ? `${m}m ${s}s` : `${s}s`);
  }

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    if (isLimitReached && !showInputFormOverride) {
      return;
    }

    if (activeTab === "url" && repoUrl) {
      setIsLoading(true);
      try {
        const res = await fetch("/api/repos", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ github_url: repoUrl }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          if (res.status === 429 || errData.retryAfter) {
            const retrySecs = Number(errData.retryAfter) || 14400;
            setRateLimitError({
              retryAfterSeconds: retrySecs,
              message: errData.error || errData.detail || "Analysis credit limit reached for this window.",
            });
            setShowInputFormOverride(false);
            return;
          }
          throw new Error(errData.detail || errData.error || `Error ${res.status}: Failed to start analysis`);
        }
        const data = await res.json();
        router.push(`/repo/${data.id}`);
        if (!inline && onClose) onClose();
      } catch (err: any) {
        alert(err.message || "Something went wrong starting the analysis.");
      } finally {
        setIsLoading(false);
      }
    } else if (activeTab === "upload" && uploadedFile) {
      alert("Local uploads are not supported yet. Please paste a public GitHub repository URL.");
    }
  };

  const canSubmit = ((activeTab === "url" && repoUrl.length > 0) || (activeTab === "upload" && uploadedFile !== null)) && !isLoading && !isLimitReached;
  const formatFileSize = (bytes: number) => bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

  if (animState === "closed" || !mounted) return null;

  const isVisible = animState === "open";

  // Theme tokens
  const t = {
    backdrop:    isDark ? "rgba(0,0,0,0.55)"             : "rgba(0,0,0,0.25)",
    cardBg:      isDark ? "rgba(18,18,22,0.88)"          : "rgba(255,255,255,1)",
    cardBorder:  isDark ? "rgba(255,255,255,0.08)"       : "rgba(0,0,0,0.06)",
    cardShadow:  isDark
      ? "0 32px 64px rgba(0,0,0,0.6), inset 0 2px 2px rgba(255,255,255,0.06), inset 0 -2px 2px rgba(0,0,0,0.3)"
      : "0 32px 64px rgba(0,0,0,0.08), 0 8px 16px rgba(0,0,0,0.04), inset 0 2px 2px rgba(255,255,255,1)",
    cardShadowInline: isDark
      ? "0 16px 48px rgba(0,0,0,0.4), inset 0 1px 1px rgba(255,255,255,0.05)"
      : "0 16px 48px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.03), inset 0 1px 1px rgba(255,255,255,1)",
    title:       isDark ? "#ffffff"                       : "#0f172a",
    subtitle:    isDark ? "#9ca3af"                       : "#64748b",
    tabBg:       isDark ? "rgba(255,255,255,0.06)"        : "#f1f5f9",
    tabBorder:   isDark ? "rgba(255,255,255,0.06)"        : "#e2e8f0",
    tabPill:     isDark ? "rgba(255,255,255,0.12)"        : "#ffffff",
    tabActive:   isDark ? "#ffffff"                       : "#0f172a",
    tabInactive: isDark ? "#555555"                       : "#64748b",
    label:       isDark ? "#d1d5db"                       : "#334155",
    inputBg:     isDark ? "rgba(0,0,0,0.35)"              : "#f8fafc",
    inputBorder: isDark ? "rgba(255,255,255,0.1)"         : "#cbd5e1",
    inputText:   isDark ? "#ffffff"                       : "#0f172a",
    inputHolder: isDark ? "#4b5563"                       : "#94a3b8",
    dropzoneBg:  isDark ? "rgba(255,255,255,0.04)"        : "#f8fafc",
    dropzoneBdr: isDark ? "rgba(255,255,255,0.15)"        : "#cbd5e1",
    dropzoneTxt: isDark ? "#6b7280"                       : "#64748b",
    closeBtn:    isDark ? "rgba(255,255,255,0.1)"         : "#f1f5f9",
    closeBtnHov: isDark ? "rgba(255,255,255,0.18)"        : "#e2e8f0",
    closeIcon:   isDark ? "#9ca3af"                       : "#64748b",
    divider:     isDark ? "rgba(255,255,255,0.08)"        : "#e2e8f0",
  };

  const cardStyles = {
    position: "relative" as const,
    width: "100%",
    maxWidth: "560px",
    borderRadius: "32px",
    background: t.cardBg,
    backdropFilter: inline ? "none" : "blur(40px) saturate(160%)",
    WebkitBackdropFilter: inline ? "none" : "blur(40px) saturate(160%)",
    border: `1px solid ${t.cardBorder}`,
    boxShadow: inline ? t.cardShadowInline : t.cardShadow,
    opacity: isVisible ? 1 : 0,
    transform: isVisible ? "scale(1) translateY(0)" : "scale(0.95) translateY(16px)",
    transition: "opacity 280ms cubic-bezier(0.16,1,0.3,1), transform 280ms cubic-bezier(0.16,1,0.3,1)",
  };

  // ─────────────────────────────────────────────────────────────
  // Claude / ChatGPT-style Limit Exceeded Guidance Screen
  // ─────────────────────────────────────────────────────────────
  if (isLimitReached && !showInputFormOverride) {
    const limitGuidanceContent = (
      <div style={cardStyles} className="p-6 sm:p-8">
        {/* Close button */}
        {(!inline || onClose) && (
          <button
            onClick={onClose}
            style={{
              position: "absolute", top: 24, right: 24,
              padding: 8, borderRadius: "50%",
              background: t.closeBtn,
              color: t.closeIcon,
              border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 150ms",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = t.closeBtnHov)}
            onMouseLeave={e => (e.currentTarget.style.background = t.closeBtn)}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        )}

        <div className="flex flex-col gap-5 sm:gap-6">
          {/* Top Quota Pill */}
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
              style={{
                background: isDark ? "rgba(244, 63, 94, 0.15)" : "rgba(244, 63, 94, 0.1)",
                border: "1px solid rgba(244, 63, 94, 0.3)",
                color: isDark ? "#fb7185" : "#e11d48",
              }}
            >
              <Clock size={12} />
              Quota Limit Reached · 0 of 5 Credits Left
            </span>
          </div>

          {/* Header */}
          <div className="pr-8">
            <h2 className="m-0 text-2xl sm:text-[28px] font-extrabold tracking-tight" style={{ color: t.title }}>
              Analysis Limit Reached
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed m-0" style={{ color: t.subtitle }}>
              You have analyzed 5 repositories in this 4-hour window. New analysis credits refresh automatically once earlier analyses age out.
            </p>
          </div>

          {/* Claude / ChatGPT Signature Comeback Guidance Box */}
          <div
            className="p-4 sm:p-5 rounded-2xl border flex flex-col gap-3"
            style={{
              background: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.02)",
              borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)",
            }}
          >
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    background: isDark ? "rgba(251, 191, 36, 0.15)" : "rgba(251, 191, 36, 0.12)",
                    border: "1px solid rgba(251, 191, 36, 0.25)",
                  }}
                >
                  <Clock size={20} className="text-amber-500 animate-pulse" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider m-0" style={{ color: t.subtitle }}>
                    Next Credit Available At
                  </p>
                  <p className="text-lg sm:text-xl font-extrabold m-0 tracking-tight" style={{ color: t.title }}>
                    {resetTimeStr || "Within 3–4 hours"}
                  </p>
                </div>
              </div>

              {countdownStr && (
                <div
                  className="px-3 py-1.5 rounded-full text-xs font-mono font-bold flex items-center gap-1.5 shrink-0"
                  style={{
                    background: isDark ? "rgba(251, 191, 36, 0.12)" : "rgba(251, 191, 36, 0.1)",
                    border: "1px solid rgba(251, 191, 36, 0.3)",
                    color: isDark ? "#fbbf24" : "#b45309",
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                  ~{countdownStr} remaining
                </div>
              )}
            </div>

            <div
              className="pt-2.5 border-t text-[11px] leading-relaxed"
              style={{
                borderColor: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.06)",
                color: t.subtitle,
              }}
            >
              Quota resets in a rolling 4-hour window (5 repositories max). No action needed—your quota refreshes in the background.
            </div>
          </div>

          {/* Reassurance Banner: Free Unlimited Q&A Chat */}
          <div
            className="p-4 rounded-2xl flex items-start gap-3 text-xs leading-relaxed"
            style={{
              background: "color-mix(in srgb, #10b981 10%, transparent)",
              border: "1px solid color-mix(in srgb, #10b981 35%, transparent)",
              color: isDark ? "#a7f3d0" : "#065f46",
            }}
          >
            <Lightbulb size={18} className="shrink-0 text-amber-500 fill-amber-300/30 mt-0.5" />
            <div>
              <strong className="block text-sm font-bold text-emerald-600 dark:text-emerald-400 mb-0.5">
                Once analyzed, Q&A chat is 100% free & unlimited!
              </strong>
              <span>
                You do not need credits to ask questions, explore architecture maps, or inspect dependencies on any of your existing indexed repositories.
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 pt-1">
            <button
              type="button"
              onClick={() => {
                if (onClose) onClose();
                router.push(`/dashboard/${user?.id || ""}`);
              }}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                gap: 8, width: "100%", height: 52, borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.2)",
                fontSize: 15, fontWeight: 700, cursor: "pointer",
                color: "white",
                background: "linear-gradient(to bottom, #4a50c5, #00b08a)",
                boxShadow: "0 8px 24px rgba(74,80,197,0.3), inset 0 2px 1px rgba(255,255,255,0.4), inset 0 -2px 2px rgba(0,0,0,0.2)",
                transition: "all 200ms ease",
              }}
              onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-2px)")}
              onMouseLeave={e => (e.currentTarget.style.transform = "translateY(0)")}
            >
              <FolderGit2 size={18} />
              <span>Browse My Repositories</span>
              <ArrowRight size={16} />
            </button>

            <div className="flex items-center justify-between text-xs px-2" style={{ color: t.subtitle }}>
              <button
                type="button"
                onClick={fetchQuota}
                className="hover:underline flex items-center gap-1.5 cursor-pointer bg-transparent border-0 p-0 text-inherit font-medium"
              >
                <RefreshCw size={12} />
                <span>Check if credit unlocked</span>
              </button>

              <button
                type="button"
                onClick={() => setShowInputFormOverride(true)}
                className="hover:underline cursor-pointer bg-transparent border-0 p-0 text-inherit font-medium opacity-70 hover:opacity-100"
              >
                Enter URL anyway
              </button>
            </div>
          </div>
        </div>
      </div>
    );

    if (inline) {
      return (
        <div className="w-full flex items-center justify-center p-4">
          {limitGuidanceContent}
        </div>
      );
    }

    return mounted ? createPortal(
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div
          onClick={onClose}
          style={{
            position: "absolute", inset: 0,
            backgroundColor: t.backdrop,
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            opacity: isVisible ? 1 : 0,
            transition: "opacity 300ms ease-out",
          }}
        />
        {limitGuidanceContent}
      </div>,
      document.body
    ) : null;
  }

  // ─────────────────────────────────────────────────────────────
  // Standard Form Content (or overridden view)
  // ─────────────────────────────────────────────────────────────
  const cardContent = (
    <div style={cardStyles} className="p-6 sm:p-8">
      {/* Close button - only show if not inline or if inline has onClose */}
      {(!inline || onClose) && (
        <button
          onClick={onClose}
          style={{
            position: "absolute", top: 24, right: 24,
            padding: 8, borderRadius: "50%",
            background: t.closeBtn,
            color: t.closeIcon,
            border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "background 150ms",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = t.closeBtnHov)}
          onMouseLeave={e => (e.currentTarget.style.background = t.closeBtn)}
          aria-label="Close"
        >
          <X size={20} />
        </button>
      )}

      <div className="flex flex-col gap-6 sm:gap-7">
        {/* Header */}
        <div className="pr-10">
          <h2 className="m-0 text-2xl sm:text-[28px] font-extrabold tracking-tight" style={{ color: t.title }}>
            Analyze Codebase
          </h2>
          <p className="mt-1 sm:mt-1.5 text-sm" style={{ color: t.subtitle }}>
            Paste a GitHub URL or upload a local repository zip file.
          </p>
        </div>

        {/* If user opted to view form while at limit, show warning banner */}
        {isLimitReached && (
          <div
            className="p-3.5 rounded-2xl flex items-center justify-between gap-3 text-xs"
            style={{
              background: isDark ? "rgba(244, 63, 94, 0.12)" : "rgba(244, 63, 94, 0.08)",
              border: "1px solid rgba(244, 63, 94, 0.25)",
              color: isDark ? "#fb7185" : "#e11d48",
            }}
          >
            <div className="flex items-center gap-2">
              <Clock size={14} className="shrink-0" />
              <span>
                Quota reached (0/5 credits). Resets at <strong>{resetTimeStr || "soon"}</strong> (~{countdownStr}).
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowInputFormOverride(false)}
              className="font-bold underline shrink-0 cursor-pointer bg-transparent border-0 text-inherit text-xs"
            >
              View Guide
            </button>
          </div>
        )}

        {/* Tab Switcher */}
        <div style={{
          position: "relative", display: "flex", gap: 4, padding: 4,
          borderRadius: 18, background: t.tabBg,
          border: `1px solid ${t.tabBorder}`,
        }}>
          {/* Sliding pill */}
          <div style={{
            position: "absolute", top: 4, bottom: 4,
            width: "calc(50% - 6px)",
            borderRadius: 14,
            background: t.tabPill,
            boxShadow: isDark ? "none" : "0 1px 4px rgba(0,0,0,0.1)",
            transform: activeTab === "url" ? "translateX(0)" : "translateX(calc(100% + 4px))",
            transition: "transform 300ms cubic-bezier(0.34,1.56,0.64,1)",
          }} />
          {(["url", "upload"] as const).map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1, position: "relative", zIndex: 1,
                padding: "10px 0", borderRadius: 14,
                border: "none", background: "transparent", cursor: "pointer",
                fontSize: 14, fontWeight: 700,
                color: activeTab === tab ? t.tabActive : t.tabInactive,
                transition: "color 200ms ease",
              }}
            >
              {tab === "url" ? "GitHub URL" : "Upload .zip"}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleAnalyze} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Content panels — always rendered for smooth CSS transition */}
          <div style={{ position: "relative", minHeight: 132 }}>
            {/* GitHub URL panel */}
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", flexDirection: "column", gap: 12,
              opacity: activeTab === "url" ? 1 : 0,
              transform: activeTab === "url" ? "translateX(0) scale(1)" : "translateX(-14px) scale(0.98)",
              pointerEvents: activeTab === "url" ? "auto" : "none",
              transition: "opacity 250ms cubic-bezier(0.16,1,0.3,1), transform 250ms cubic-bezier(0.16,1,0.3,1)",
            }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: t.label, display: "flex", alignItems: "center", gap: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.02c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A4.8 4.8 0 0 0 8 18v4" />
                </svg>
                GitHub Repository URL
              </label>
              <input
                type="url"
                placeholder="https://github.com/organization/project"
                value={repoUrl}
                onChange={e => setRepoUrl(e.target.value)}
                tabIndex={activeTab === "url" ? 0 : -1}
                style={{
                  width: "100%", height: 56, padding: "0 20px",
                  borderRadius: 18,
                  background: t.inputBg,
                  border: `1px solid ${t.inputBorder}`,
                  color: t.inputText,
                  fontSize: 15, outline: "none",
                  boxSizing: "border-box",
                  boxShadow: "inset 0 2px 6px rgba(0,0,0,0.06)",
                  transition: "border-color 150ms, box-shadow 150ms",
                }}
                onFocus={e => { e.currentTarget.style.borderColor = "rgba(74,80,197,0.6)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(74,80,197,0.15), inset 0 2px 6px rgba(0,0,0,0.06)"; }}
                onBlur={e => { e.currentTarget.style.borderColor = t.inputBorder; e.currentTarget.style.boxShadow = "inset 0 2px 6px rgba(0,0,0,0.06)"; }}
              />
              <p style={{ fontSize: 12, color: t.label, opacity: 0.8, margin: "2px 0 0 4px" }}>
                Please ensure the repository is public. Private repositories are not supported yet.
              </p>
            </div>

            {/* Upload .zip panel */}
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", flexDirection: "column", gap: 12,
              opacity: activeTab === "upload" ? 1 : 0,
              transform: activeTab === "upload" ? "translateX(0) scale(1)" : "translateX(14px) scale(0.98)",
              pointerEvents: activeTab === "upload" ? "auto" : "none",
              transition: "opacity 250ms cubic-bezier(0.16,1,0.3,1), transform 250ms cubic-bezier(0.16,1,0.3,1)",
            }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: t.label, display: "flex", alignItems: "center", gap: 6 }}>
                <UploadCloud size={14} /> Local Repository
              </label>

              <input ref={fileInputRef} type="file"
                accept=".zip,.tar,.tar.gz,application/zip,application/x-tar,application/gzip"
                onChange={handleFileInput} style={{ display: "none" }} />

              {uploadedFile ? (
                <div style={{
                  display: "flex", alignItems: "center", gap: 14, padding: 16,
                  borderRadius: 18,
                  background: isDark ? "rgba(74,80,197,0.1)" : "rgba(74,80,197,0.06)",
                  border: "1px solid rgba(74,80,197,0.2)",
                  transition: "all 200ms",
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 14, flexShrink: 0,
                    background: "linear-gradient(to bottom, #4a50c5, #00b08a)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: "0 4px 12px rgba(74,80,197,0.3)",
                  }}>
                    <FileArchive size={20} color="white" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: t.title, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{uploadedFile.name}</p>
                    <p style={{ margin: "3px 0 0", fontSize: 12, color: t.subtitle }}>{formatFileSize(uploadedFile.size)}</p>
                  </div>
                  <CheckCircle2 size={20} color="#00b08a" style={{ flexShrink: 0 }} />
                  <button type="button"
                    onClick={() => { setUploadedFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                    style={{ fontSize: 12, fontWeight: 700, color: t.subtitle, background: "none", border: "none", cursor: "pointer", flexShrink: 0, transition: "color 150ms" }}
                    onMouseEnter={e => (e.currentTarget.style.color = t.title)}
                    onMouseLeave={e => (e.currentTarget.style.color = t.subtitle)}
                  >
                    Change
                  </button>
                </div>
              ) : (
                <button type="button"
                  onClick={() => fileInputRef.current?.click()}
                  onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}
                  tabIndex={activeTab === "upload" ? 0 : -1}
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    gap: 8, width: "100%", height: 88, borderRadius: 18,
                    border: `2px dashed ${isDragging ? "#4a50c5" : t.dropzoneBdr}`,
                    background: isDragging ? "rgba(74,80,197,0.06)" : t.dropzoneBg,
                    cursor: "pointer",
                    transform: isDragging ? "scale(0.99)" : "scale(1)",
                    transition: "all 200ms ease",
                  }}
                  onMouseEnter={e => { if (!isDragging) { e.currentTarget.style.borderColor = "rgba(74,80,197,0.4)"; e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.7)"; }}}
                  onMouseLeave={e => { if (!isDragging) { e.currentTarget.style.borderColor = t.dropzoneBdr; e.currentTarget.style.background = t.dropzoneBg; }}}
                >
                  <UploadCloud size={24} color={isDragging ? "#4a50c5" : t.dropzoneTxt} style={{ transition: "color 200ms" }} />
                  <div style={{ textAlign: "center" }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: t.label }}>
                      {isDragging ? "Drop it here!" : "Click to browse or drag & drop"}
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: t.dropzoneTxt }}>
                      Supports .zip or .tar.gz · Max 50 MB
                    </p>
                  </div>
                </button>
              )}
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={!canSubmit}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              gap: 8, width: "100%", height: 56, borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.2)",
              fontSize: 16, fontWeight: 700, cursor: canSubmit ? "pointer" : "not-allowed",
              color: canSubmit ? "white" : (isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.4)"),
              background: canSubmit
                ? "linear-gradient(to bottom, #4a50c5, #00b08a)"
                : isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
              opacity: canSubmit ? 1 : 1,
              boxShadow: canSubmit ? "0 8px 24px rgba(74,80,197,0.3), inset 0 2px 1px rgba(255,255,255,0.4), inset 0 -2px 2px rgba(0,0,0,0.2)" : "none",
              transform: "translateY(0) scale(1)",
              transition: "all 200ms ease",
            }}
            onMouseEnter={e => { if (canSubmit) e.currentTarget.style.transform = "translateY(-2px)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; }}
            onMouseDown={e => { if (canSubmit) e.currentTarget.style.transform = "scale(0.98)"; }}
            onMouseUp={e => { if (canSubmit) e.currentTarget.style.transform = "translateY(-2px)"; }}
          >
            <span>
              {isLimitReached
                ? `Limit Reached · Resets at ${resetTimeStr || "soon"}`
                : isLoading
                ? "Launching RepoHawk..."
                : "Run RepoHawk"}
            </span>
            {!isLoading && !isLimitReached && <span style={{ fontSize: 20 }}>→</span>}
          </button>
        </form>
      </div>
    </div>
  );

  if (inline) {
    return (
      <div className="w-full flex items-center justify-center p-4">
        {cardContent}
      </div>
    );
  }

  const modalOverlay = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "absolute", inset: 0,
          backgroundColor: t.backdrop,
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          opacity: isVisible ? 1 : 0,
          transition: "opacity 300ms ease-out",
        }}
      />
      {cardContent}
    </div>
  );

  return mounted ? createPortal(modalOverlay, document.body) : null;
}
