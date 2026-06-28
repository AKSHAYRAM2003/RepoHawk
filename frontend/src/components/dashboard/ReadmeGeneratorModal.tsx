"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  X, FileText, Copy, Check, Download, Loader2,
  RefreshCw, ChevronDown, ChevronUp, Sparkles,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ReadmeGeneratorModalProps {
  repoId: string;
  repoName?: string;
  onClose: () => void;
}

type Phase = "idle" | "generating" | "done" | "error";

export default function ReadmeGeneratorModal({
  repoId,
  repoName,
  onClose,
}: ReadmeGeneratorModalProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [content, setContent] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [copied, setCopied] = useState(false);
  const [previewMode, setPreviewMode] = useState<"preview" | "raw">("preview");
  const abortRef = useRef<() => void>(() => {});
  const scrollRef = useRef<HTMLDivElement>(null);

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8003";

  const startGeneration = useCallback(() => {
    setPhase("generating");
    setContent("");
    setErrorMsg("");

    // Use fetch streaming via the Next.js API proxy
    let closed = false;
    const controller = new AbortController();
    abortRef.current = () => {
      closed = true;
      controller.abort();
    };

    fetch(`/api/repos/${repoId}/generate-readme`, {
      headers: {
        Accept: "text/event-stream",
      },
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: "Failed to start generation" }));
          throw new Error(err.detail || "Failed to start generation");
        }
        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response body");
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done || closed) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (line.startsWith("event: token")) continue;
            if (line.startsWith("event: done")) {
              setPhase("done");
              continue;
            }
            if (line.startsWith("event: error")) continue;
            if (line.startsWith("data: ")) {
              try {
                const parsed = JSON.parse(line.slice(6));
                if (parsed.token) {
                  setContent((prev) => prev + parsed.token);
                } else if (parsed.status === "complete") {
                  setPhase("done");
                } else if (parsed.error) {
                  setErrorMsg(parsed.error);
                  setPhase("error");
                }
              } catch {
                /* non-JSON line, skip */
              }
            }
          }
        }
        if (!closed) setPhase("done");
      })
      .catch((err) => {
        if (err.name === "AbortError" || closed) return;
        setErrorMsg(err.message || "Generation failed");
        setPhase("error");
      });
  }, [repoId, API_BASE]);

  // Auto-scroll while streaming
  useEffect(() => {
    if (phase === "generating" && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [content, phase]);

  // Start generation on mount
  useEffect(() => {
    startGeneration();
    return () => abortRef.current?.();
  }, [startGeneration]);

  const handleCopy = () => {
    navigator.clipboard.writeText(content).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `README-${repoName ?? repoId}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-full max-w-4xl flex flex-col rounded-2xl border border-outline-variant shadow-2xl overflow-hidden"
        style={{
          background: "var(--surface-container)",
          maxHeight: "90vh",
        }}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b border-outline-variant flex-shrink-0"
          style={{ background: "var(--surface-container-low)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{
                background: "color-mix(in srgb, #6366f1 15%, transparent)",
                color: "#818cf8",
              }}
            >
              <FileText size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-on-surface">
                README Generator
              </h2>
              <p className="text-xs text-on-surface-variant">
                {repoName ?? repoId} — AI-powered documentation
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Phase badge */}
            {phase === "generating" && (
              <div
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold animate-pulse"
                style={{
                  background: "color-mix(in srgb, #6366f1 12%, transparent)",
                  color: "#818cf8",
                  border: "1px solid rgba(99,102,241,0.3)",
                }}
              >
                <Sparkles size={11} />
                Generating…
              </div>
            )}
            {phase === "done" && (
              <div
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                style={{
                  background: "color-mix(in srgb, #10b981 12%, transparent)",
                  color: "#10b981",
                  border: "1px solid rgba(16,185,129,0.3)",
                }}
              >
                <Check size={11} />
                Ready
              </div>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-on-surface-variant hover:text-on-surface transition-colors"
              style={{ background: "color-mix(in srgb, var(--on-surface) 6%, transparent)" }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── Toolbar ────────────────────────────────────────────────────── */}
        {(phase === "generating" || phase === "done") && (
          <div
            className="flex items-center justify-between px-6 py-2.5 border-b border-outline-variant flex-shrink-0"
            style={{ background: "var(--surface-container)" }}
          >
            {/* View toggle */}
            <div
              className="flex p-1 rounded-lg gap-1"
              style={{ background: "color-mix(in srgb, var(--on-surface) 6%, transparent)" }}
            >
              <button
                onClick={() => setPreviewMode("preview")}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                  previewMode === "preview"
                    ? "bg-surface text-on-surface shadow-sm"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                Preview
              </button>
              <button
                onClick={() => setPreviewMode("raw")}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                  previewMode === "raw"
                    ? "bg-surface text-on-surface shadow-sm"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                Raw Markdown
              </button>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={startGeneration}
                disabled={phase === "generating"}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-outline-variant text-on-surface-variant hover:text-on-surface hover:bg-surface-high transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <RefreshCw size={12} className={phase === "generating" ? "animate-spin" : ""} />
                Regenerate
              </button>
              <button
                onClick={handleCopy}
                disabled={!content}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-outline-variant text-on-surface-variant hover:text-on-surface hover:bg-surface-high transition-all disabled:opacity-40"
              >
                {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                {copied ? "Copied!" : "Copy"}
              </button>
              <button
                onClick={handleDownload}
                disabled={!content || phase === "generating"}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
                style={{
                  background: "linear-gradient(135deg, #4a50c5, #00b08a)",
                  color: "white",
                }}
              >
                <Download size={12} />
                Download .md
              </button>
            </div>
          </div>
        )}

        {/* ── Content area ───────────────────────────────────────────────── */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto"
          style={{ minHeight: 0, scrollbarWidth: "thin" }}
        >
          {/* Error state */}
          {phase === "error" && (
            <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ background: "rgba(244,63,94,0.1)", color: "#f43f5e" }}
              >
                <X size={24} />
              </div>
              <div className="text-center">
                <p className="font-semibold text-on-surface">Generation Failed</p>
                <p className="text-sm text-on-surface-variant mt-1">{errorMsg}</p>
              </div>
              <button
                onClick={startGeneration}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-white transition-all"
                style={{ background: "linear-gradient(135deg, #4a50c5, #00b08a)" }}
              >
                <RefreshCw size={14} />
                Try Again
              </button>
            </div>
          )}

          {/* Loading / streaming state with no content yet */}
          {phase === "generating" && !content && (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <Loader2 size={28} className="animate-spin" style={{ color: "#818cf8" }} />
              <p className="text-sm text-on-surface-variant">
                Analyzing your codebase and generating README…
              </p>
            </div>
          )}

          {/* Content — preview or raw */}
          {content && (
            <div className="p-6">
              {previewMode === "preview" ? (
                <div
                  className="prose prose-sm max-w-none"
                  style={{
                    color: "var(--on-surface)",
                    "--tw-prose-body": "var(--on-surface)",
                    "--tw-prose-headings": "var(--on-surface)",
                    "--tw-prose-code": "var(--on-surface)",
                  } as React.CSSProperties}
                >
                  <ReadmeMarkdown content={content} />
                </div>
              ) : (
                <pre
                  className="text-xs leading-relaxed font-mono whitespace-pre-wrap break-words"
                  style={{
                    color: "var(--on-surface)",
                    background: "var(--surface-lowest, var(--surface))",
                    padding: "16px",
                    borderRadius: 10,
                    border: "1px solid var(--outline-variant)",
                  }}
                >
                  {content}
                </pre>
              )}

              {/* Streaming cursor */}
              {phase === "generating" && (
                <span
                  style={{
                    display: "inline-block",
                    width: 2,
                    height: "1em",
                    background: "#818cf8",
                    marginLeft: 2,
                    borderRadius: 1,
                    animation: "blink 0.8s ease-in-out infinite",
                    verticalAlign: "middle",
                  }}
                />
              )}
            </div>
          )}
        </div>

        {/* blink keyframe */}
        <style>{`
          @keyframes blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0; }
          }
        `}</style>
      </div>
    </div>
  );
}

// ── Internal rich markdown renderer ─────────────────────────────────────────
function ReadmeMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => (
          <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8, color: "var(--on-surface)", borderBottom: "1px solid var(--outline-variant)", paddingBottom: 8 }}>
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 style={{ fontSize: 17, fontWeight: 700, marginTop: 22, marginBottom: 8, color: "var(--on-surface)" }}>
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 style={{ fontSize: 14, fontWeight: 700, marginTop: 16, marginBottom: 6, color: "var(--on-surface)" }}>
            {children}
          </h3>
        ),
        p: ({ children }) => (
          <p style={{ fontSize: 13, lineHeight: 1.7, color: "var(--on-surface-variant)", marginBottom: 10 }}>
            {children}
          </p>
        ),
        ul: ({ children }) => (
          <ul style={{ paddingLeft: 20, marginBottom: 10 }}>{children}</ul>
        ),
        ol: ({ children }) => (
          <ol style={{ paddingLeft: 20, marginBottom: 10 }}>{children}</ol>
        ),
        li: ({ children }) => (
          <li style={{ fontSize: 13, color: "var(--on-surface-variant)", marginBottom: 4 }}>
            {children}
          </li>
        ),
        table: ({ children }) => (
          <div style={{ overflowX: "auto", marginBottom: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              {children}
            </table>
          </div>
        ),
        th: ({ children }) => (
          <th style={{ textAlign: "left", padding: "6px 12px", borderBottom: "1px solid var(--outline-variant)", color: "var(--on-surface)", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", background: "color-mix(in srgb, var(--on-surface) 4%, transparent)" }}>
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td style={{ padding: "6px 12px", borderBottom: "1px solid var(--outline-variant)", color: "var(--on-surface-variant)" }}>
            {children}
          </td>
        ),
        code: ({ children, className }) => {
          const isBlock = className?.startsWith("language-");
          if (isBlock) {
            return (
              <pre style={{ background: "color-mix(in srgb, var(--on-surface) 5%, transparent)", border: "1px solid var(--outline-variant)", borderRadius: 8, padding: "12px 14px", overflowX: "auto", margin: "8px 0" }}>
                <code style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: 11.5, color: "var(--on-surface)", lineHeight: 1.6 }}>
                  {children}
                </code>
              </pre>
            );
          }
          return (
            <code style={{ fontFamily: "monospace", fontSize: 11.5, background: "color-mix(in srgb, var(--on-surface) 8%, transparent)", padding: "1px 5px", borderRadius: 4, color: "var(--on-surface)" }}>
              {children}
            </code>
          );
        },
        blockquote: ({ children }) => (
          <blockquote style={{ borderLeft: "3px solid #6366f1", paddingLeft: 12, margin: "10px 0", color: "var(--on-surface-variant)", fontStyle: "italic" }}>
            {children}
          </blockquote>
        ),
        a: ({ children, href }) => (
          <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: "#818cf8", textDecoration: "none" }}>
            {children}
          </a>
        ),
        hr: () => <hr style={{ border: "none", borderTop: "1px solid var(--outline-variant)", margin: "16px 0" }} />,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
