"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, UploadCloud, FileArchive, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "../ThemeProvider";

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // ✅ Read the actual resolved theme from our ThemeProvider (not OS preference)
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  useEffect(() => setMounted(true), []);

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

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

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

  const canSubmit = ((activeTab === "url" && repoUrl.length > 0) || (activeTab === "upload" && uploadedFile !== null)) && !isLoading;
  const formatFileSize = (bytes: number) => bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

  if (animState === "closed" || !mounted) return null;

  const isVisible = animState === "open";

  // ────────────────────────────────────────────
  // Theme tokens — all resolved from resolvedTheme
  // ────────────────────────────────────────────
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
              <span>{isLoading ? "Launching RepoHawk..." : "Run RepoHawk"}</span>
              {!isLoading && <span style={{ fontSize: 20 }}>→</span>}
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
