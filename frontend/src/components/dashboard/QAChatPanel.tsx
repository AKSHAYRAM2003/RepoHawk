"use client";

/**
 * QAChatPanel — Premium RAG-powered chat interface for RepoHawk
 *
 * Features:
 *  - Dark glassmorphic design with indigo accent
 *  - Lightweight markdown renderer (code blocks, bold, lists, inline code)
 *  - Typing indicator with staggered bounce animation
 *  - Suggestion chips for onboarding (shown when chat is empty)
 *  - Source file pills → click to dispatch repohawk-highlight-node event
 *  - Node highlight pill → automatically fires on AI response with node ID
 *  - Auto-scroll, auto-resize textarea, keyboard shortcuts
 *  - Honest fallback: shows error messages cleanly without panic
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Send, Bot, FileCode, Zap, AlertCircle, Square,
  ChevronRight, Copy, Check, RefreshCw, Sparkles,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sourceFiles?: string[];
  highlightNodeId?: string;
  codeRef?: { file: string; line_start: number; line_end: number };
  isLoading?: boolean;
  isStreaming?: boolean;        // True while tokens are still arriving
  isStopped?: boolean;          // True if user pressed Stop mid-stream
  isError?: boolean;
  timestamp: Date;
}

// ── Suggestion Chips ──────────────────────────────────────────────────────────

const SUGGESTIONS = [
  "What is the main entry point?",
  "Explain the core services layer",
  "What databases are used?",
  "How does authentication work?",
  "What external APIs are integrated?",
  "Describe the overall tech stack",
];

// ── Lightweight Markdown Renderer ─────────────────────────────────────────────

function renderInline(text: string): React.ReactNode[] {
  // Parse bold (**text**) and inline code (`text`) within a line
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} style={{ color: "#f1f5f9", fontWeight: 700 }}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code
          key={i}
          style={{
            background: "rgba(99,102,241,0.15)",
            color: "#a5b4fc",
            padding: "1px 5px",
            borderRadius: 4,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            fontSize: 11.5,
          }}
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{
        margin: "8px 0",
        borderRadius: 10,
        background: "rgba(5,6,12,0.85)",
        border: "1px solid rgba(255,255,255,0.06)",
        overflow: "hidden",
      }}
    >
      {/* Header bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "4px 12px",
          borderBottom: "1px solid rgba(255,255,255,0.04)",
          background: "rgba(255,255,255,0.02)",
        }}
      >
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: "#334155",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
          }}
        >
          {lang || "code"}
        </span>
        <button
          onClick={copy}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: copied ? "#10b981" : "#475569",
            fontSize: 10,
            fontWeight: 600,
            transition: "color 0.2s",
            padding: "2px 0",
          }}
        >
          {copied ? <Check size={9} /> : <Copy size={9} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {/* Code content */}
      <pre
        style={{
          padding: "10px 14px",
          margin: 0,
          overflowX: "auto",
          fontSize: 11,
          lineHeight: 1.7,
          color: "#a5b4fc",
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {code}
      </pre>
    </div>
  );
}

function renderMarkdown(text: string): React.ReactNode {
  // Split on fenced code blocks first
  const segments = text.split(/(```[\s\S]*?```)/g);

  return (
    <>
      {segments.map((seg, si) => {
        // Code block
        if (seg.startsWith("```")) {
          const lines = seg.slice(3).split("\n");
          const lang = lines[0].trim();
          const code = lines.slice(1, -1).join("\n");
          return <CodeBlock key={si} lang={lang} code={code} />;
        }

        // Regular text — split into paragraphs
        const paragraphs = seg.split(/\n{2,}/);
        return (
          <React.Fragment key={si}>
            {paragraphs.map((para, pi) => {
              const lines = para.split("\n");

              // Bullet list detection
              const allBullets = lines.every((l) => /^[\-\*•]\s/.test(l.trim()));
              if (allBullets && lines.length > 0 && lines[0].trim()) {
                return (
                  <ul
                    key={pi}
                    style={{ margin: "5px 0", paddingLeft: 16, listStyle: "none" }}
                  >
                    {lines.map((l, li) => (
                      <li
                        key={li}
                        style={{
                          fontSize: 12.5,
                          color: "#cbd5e1",
                          lineHeight: 1.65,
                          marginBottom: 3,
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 6,
                        }}
                      >
                        <span style={{ color: "#6366f1", marginTop: 2, flexShrink: 0 }}>▸</span>
                        {renderInline(l.replace(/^[\-\*•]\s/, "").trim())}
                      </li>
                    ))}
                  </ul>
                );
              }

              // Numbered list detection
              const allNumbered = lines.every((l) => /^\d+\.\s/.test(l.trim()));
              if (allNumbered && lines.length > 0 && lines[0].trim()) {
                return (
                  <ol
                    key={pi}
                    style={{ margin: "5px 0", paddingLeft: 20 }}
                  >
                    {lines.map((l, li) => (
                      <li
                        key={li}
                        style={{
                          fontSize: 12.5,
                          color: "#cbd5e1",
                          lineHeight: 1.65,
                          marginBottom: 3,
                        }}
                      >
                        {renderInline(l.replace(/^\d+\.\s/, "").trim())}
                      </li>
                    ))}
                  </ol>
                );
              }

              // Regular paragraph — preserve single newlines
              return (
                <p
                  key={pi}
                  style={{
                    fontSize: 12.5,
                    color: "#cbd5e1",
                    lineHeight: 1.7,
                    margin: "4px 0",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {renderInline(para)}
                </p>
              );
            })}
          </React.Fragment>
        );
      })}
    </>
  );
}

// ── Typing Indicator ──────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 0" }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "#6366f1",
            animation: `rh-typingBounce 1.3s ease-in-out ${i * 0.22}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

// ── Source File Pill ──────────────────────────────────────────────────────────

function SourcePill({
  file,
  onClick,
}: {
  file: string;
  onClick: () => void;
}) {
  const name = file.split("/").pop() || file;
  return (
    <button
      onClick={onClick}
      title={`Click to focus ${file} on the canvas`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 8px",
        background: "rgba(99,102,241,0.1)",
        border: "1px solid rgba(99,102,241,0.22)",
        borderRadius: 5,
        color: "#818cf8",
        fontSize: 10.5,
        fontFamily: "'JetBrains Mono', monospace",
        cursor: "pointer",
        transition: "all 0.15s",
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.background = "rgba(99,102,241,0.22)";
        el.style.borderColor = "rgba(99,102,241,0.5)";
        el.style.color = "#a5b4fc";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.background = "rgba(99,102,241,0.1)";
        el.style.borderColor = "rgba(99,102,241,0.22)";
        el.style.color = "#818cf8";
      }}
    >
      <FileCode size={9} />
      {name}
    </button>
  );
}

// ── Node Highlight Pill ───────────────────────────────────────────────────────

function NodeHighlightPill({
  nodeId,
  onClick,
}: {
  nodeId: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={`Focus '${nodeId}' on the architecture canvas`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 11px",
        background: "rgba(99,102,241,0.15)",
        border: "1px solid rgba(99,102,241,0.4)",
        borderRadius: 20,
        color: "#a5b4fc",
        fontSize: 11,
        fontWeight: 600,
        cursor: "pointer",
        transition: "all 0.2s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background =
          "rgba(99,102,241,0.3)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background =
          "rgba(99,102,241,0.15)";
      }}
    >
      <Zap size={10} />
      Focus: {nodeId}
    </button>
  );
}

// ── Message Bubble ────────────────────────────────────────────────────────────

function MessageBubble({
  message,
  onHighlightNode,
  onHighlightFile,
}: {
  message: ChatMessage;
  onHighlightNode: (id: string) => void;
  onHighlightFile: (file: string) => void;
}) {
  if (message.role === "user") {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginBottom: 10,
          animation: "rh-fadeInUp 0.18s ease",
        }}
      >
        <div
          style={{
            maxWidth: "86%",
            background:
              "linear-gradient(135deg, rgba(99,102,241,0.22), rgba(139,92,246,0.15))",
            border: "1px solid rgba(99,102,241,0.28)",
            borderRadius: "13px 13px 4px 13px",
            padding: "8px 13px",
          }}
        >
          <p
            style={{
              fontSize: 12.5,
              color: "#e2e8f0",
              lineHeight: 1.55,
              margin: 0,
            }}
          >
            {message.content}
          </p>
        </div>
      </div>
    );
  }

  // Assistant bubble
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        marginBottom: 12,
        animation: "rh-fadeInUp 0.18s ease",
      }}
    >
      {/* Bot header row */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: 7,
            background: "rgba(99,102,241,0.18)",
            border: "1px solid rgba(99,102,241,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Bot size={12} style={{ color: "#6366f1" }} />
        </div>
        <span
          style={{
            fontSize: 9.5,
            fontWeight: 800,
            color: "#334155",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          RepoHawk
        </span>
      </div>

      {/* Content area */}
      <div
        style={{
          background: "rgba(12,14,22,0.85)",
          border: `1px solid ${message.isError ? "rgba(248,113,113,0.2)" : "rgba(255,255,255,0.06)"}`,
          borderRadius: "4px 13px 13px 13px",
          padding: "10px 13px",
          backdropFilter: "blur(10px)",
        }}
      >
        {message.isLoading && !message.content ? (
          <TypingIndicator />
        ) : message.isError ? (
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              color: "#f87171",
            }}
          >
            <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 2 }} />
            <p style={{ fontSize: 12.5, margin: 0, lineHeight: 1.6 }}>
              {message.content}
            </p>
          </div>
        ) : (
          <div style={{ position: "relative" }}>
            {renderMarkdown(message.content)}
            {message.isStreaming && message.content && (
              <span
                aria-hidden
                style={{
                  display: "inline-block",
                  width: 7,
                  height: 13,
                  marginLeft: 2,
                  verticalAlign: "-2px",
                  background: "rgba(165,180,252,0.85)",
                  borderRadius: 1,
                  animation: "rh-blink 1s steps(2) infinite",
                }}
              />
            )}
          </div>
        )}
      </div>

      {/* Node highlight pill */}
      {!message.isLoading && message.highlightNodeId && (
        <div style={{ paddingLeft: 2 }}>
          <NodeHighlightPill
            nodeId={message.highlightNodeId}
            onClick={() => onHighlightNode(message.highlightNodeId!)}
          />
        </div>
      )}

      {/* Source file pills */}
      {!message.isStreaming &&
        message.sourceFiles &&
        message.sourceFiles.length > 0 && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 5,
              paddingLeft: 2,
            }}
          >
            {message.sourceFiles.slice(0, 6).map((f) => (
              <SourcePill key={f} file={f} onClick={() => onHighlightFile(f)} />
            ))}
          </div>
        )}
    </div>
  );
}

// ── Main QA Chat Panel ────────────────────────────────────────────────────────

export default function QAChatPanel({ repoId }: { repoId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sessionId] = useState(() =>
    typeof crypto !== "undefined" ? crypto.randomUUID() : Math.random().toString(36)
  );
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasMessages = messages.length > 0;

  // Smooth scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea as user types
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 110) + "px";
  };

  // Dispatch canvas highlight event
  const handleHighlightNode = useCallback((nodeId: string) => {
    window.dispatchEvent(
      new CustomEvent("repohawk-highlight-node", { detail: { nodeId } })
    );
  }, []);

  // Guess node ID from a file path for source pill clicks
  const handleHighlightFile = useCallback(
    (file: string) => {
      const base = file.split("/").pop()?.replace(/\.[^.]+$/, "") || file;
      handleHighlightNode(base);
    },
    [handleHighlightNode]
  );

  // Send a message to the QA API (streaming version, commit 7).
  // Reads SSE frames from /api/chat and incrementally appends tokens to the
  // assistant bubble. Cancellable via AbortController.
  const abortRef = useRef<AbortController | null>(null);
  const sendMessage = useCallback(
    async (query: string) => {
      if (!query.trim() || isLoading) return;

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: query.trim(),
        timestamp: new Date(),
      };

      const assistantId = crypto.randomUUID();
      const loadingMsg: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        isLoading: true,
        isStreaming: true,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg, loadingMsg]);
      setInput("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
      setIsLoading(true);

      // Cancel any in-flight request
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      // Collect sources/highlight as they arrive
      let collectedHighlight = "";
      let collectedCodeRef: any = undefined;
      let collectedSourceFiles: string[] = [];

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            repo_id: repoId,
            session_id: sessionId,
            query: query.trim(),
            valid_node_ids: [],   // populated by commit 8
          }),
          signal: ctrl.signal,
        });

        if (!res.ok || !res.body) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.error || `Server error ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let done = false;

        while (!done) {
          const { value, done: streamDone } = await reader.read();
          done = streamDone;
          if (value) {
            buffer += decoder.decode(value, { stream: true });

            // SSE frames are separated by "\n\n"
            const frames = buffer.split("\n\n");
            buffer = frames.pop() || "";   // last partial frame stays in buffer

            for (const frame of frames) {
              // Each frame is "data: <json>" or just a keep-alive ping
              const line = frame
                .split("\n")
                .find((l) => l.startsWith("data: "));
              if (!line) continue;
              const payload = line.slice(6).trim();
              if (!payload) continue;
              let event: any;
              try {
                event = JSON.parse(payload);
              } catch {
                continue;
              }

              if (event.type === "token" && event.delta) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? {
                          ...m,
                          content: m.content + event.delta,
                          isLoading: false,
                          isStreaming: true,
                        }
                      : m
                  )
                );
              } else if (event.type === "sources") {
                collectedHighlight = event.highlight_node_id || "";
                collectedCodeRef = event.code_ref;
                collectedSourceFiles = event.files || [];
              } else if (event.type === "done") {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? {
                          ...m,
                          isLoading: false,
                          isStreaming: false,
                          sourceFiles: collectedSourceFiles,
                          highlightNodeId: collectedHighlight || undefined,
                          codeRef: collectedCodeRef,
                        }
                      : m
                  )
                );
                if (collectedHighlight) {
                  setTimeout(() => handleHighlightNode(collectedHighlight), 200);
                }
              } else if (event.type === "error") {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? {
                          ...m,
                          isLoading: false,
                          isStreaming: false,
                          isError: true,
                          content:
                            m.content ||
                            event.message ||
                            "Something went wrong during streaming.",
                        }
                      : m
                  )
                );
              }
            }
          }
        }
      } catch (err: any) {
        if (err?.name === "AbortError") {
          // User pressed Stop — mark the bubble as stopped
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    isLoading: false,
                    isStreaming: false,
                    isStopped: true,
                    content:
                      m.content + (m.content ? "\n\n_[stopped]_" : "_[stopped]_"),
                  }
                : m
            )
          );
          return;
        }
        const errorMsg: ChatMessage = {
          id: assistantId,
          role: "assistant",
          content:
            err?.message ||
            "Something went wrong. Please check that the backend is running.",
          isError: true,
          timestamp: new Date(),
        };
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? errorMsg : m))
        );
      } finally {
        setIsLoading(false);
      }
    },
    [repoId, sessionId, isLoading, handleHighlightNode]
  );

  // Stop the in-flight request (commit 7)
  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <>
      {/* Injected keyframe animations */}
      <style>{`
        @keyframes rh-typingBounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.35; }
          30% { transform: translateY(-6px); opacity: 1; }
        }
        @keyframes rh-fadeInUp {
          from { opacity: 0; transform: translateY(5px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes rh-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes rh-blink {
          0%, 50% { opacity: 0.85; }
          50.01%, 100% { opacity: 0; }
        }
      `}</style>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          overflow: "hidden",
        }}
      >
        {/* ── Empty state / Suggestions ─────────────────────────── */}
        {!hasMessages && (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "16px 14px",
              gap: 18,
              overflowY: "auto",
            }}
          >
            {/* Avatar */}
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 16,
                background:
                  "linear-gradient(135deg, rgba(99,102,241,0.28), rgba(139,92,246,0.14))",
                border: "1px solid rgba(99,102,241,0.38)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 28px rgba(99,102,241,0.2)",
              }}
            >
              <Sparkles size={22} style={{ color: "#6366f1" }} />
            </div>

            <div style={{ textAlign: "center", maxWidth: 230 }}>
              <p
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#e2e8f0",
                  margin: "0 0 5px",
                }}
              >
                Ask about the codebase
              </p>
              <p
                style={{
                  fontSize: 11.5,
                  color: "#475569",
                  lineHeight: 1.6,
                  margin: 0,
                }}
              >
                RepoHawk searches the indexed source code and gives you grounded,
                cited answers.
              </p>
            </div>

            {/* Suggestion chips */}
            <div
              style={{
                width: "100%",
                display: "flex",
                flexDirection: "column",
                gap: 5,
              }}
            >
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "7px 11px",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: 9,
                    color: "#64748b",
                    fontSize: 11.5,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget as HTMLButtonElement;
                    el.style.background = "rgba(99,102,241,0.08)";
                    el.style.borderColor = "rgba(99,102,241,0.22)";
                    el.style.color = "#c7d2fe";
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget as HTMLButtonElement;
                    el.style.background = "rgba(255,255,255,0.03)";
                    el.style.borderColor = "rgba(255,255,255,0.07)";
                    el.style.color = "#64748b";
                  }}
                >
                  <ChevronRight
                    size={10}
                    style={{ flexShrink: 0, color: "#6366f1" }}
                  />
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Messages list ─────────────────────────────────────── */}
        {hasMessages && (
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "12px 13px 4px",
              scrollbarWidth: "thin",
              scrollbarColor: "rgba(99,102,241,0.2) transparent",
            }}
          >
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                onHighlightNode={handleHighlightNode}
                onHighlightFile={handleHighlightFile}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* ── Input area ────────────────────────────────────────── */}
        <div
          style={{
            padding: "8px 12px 12px",
            borderTop: "1px solid rgba(255,255,255,0.04)",
            background: "rgba(6,7,14,0.7)",
            backdropFilter: "blur(12px)",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              background: "rgba(14,16,26,0.95)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 12,
              padding: "9px 11px 7px",
            }}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Ask about the architecture…  (↵ send · ⇧↵ new line)"
              rows={1}
              style={{
                width: "100%",
                background: "transparent",
                border: "none",
                outline: "none",
                resize: "none",
                color: "#e2e8f0",
                fontSize: 12.5,
                lineHeight: 1.6,
                fontFamily: "inherit",
                minHeight: 20,
                maxHeight: 110,
                overflowY: "auto",
                caretColor: "#6366f1",
              }}
            />
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              {/* Session hint */}
              <span
                style={{ fontSize: 9.5, color: "#1e293b", fontFamily: "monospace" }}
              >
                {repoId.slice(0, 8)}…
              </span>

              {/* Send / Stop button */}
              {isLoading ? (
                <button
                  onClick={stopGeneration}
                  title="Stop generating"
                  aria-label="Stop generating"
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: "rgba(244,63,94,0.9)",
                    border: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    transition: "all 0.15s",
                    color: "#fff",
                    flexShrink: 0,
                    boxShadow: "0 0 12px rgba(244,63,94,0.4)",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background =
                      "rgba(244,63,94,1)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background =
                      "rgba(244,63,94,0.9)";
                  }}
                >
                  <Square size={10} fill="#fff" />
                </button>
              ) : (
                <button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim()}
                  title="Send message (Enter)"
                  aria-label="Send message"
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: input.trim()
                      ? "rgba(99,102,241,0.9)"
                      : "rgba(255,255,255,0.05)",
                    border: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: input.trim() ? "pointer" : "not-allowed",
                    transition: "all 0.15s",
                    color: input.trim() ? "#fff" : "#1e293b",
                    flexShrink: 0,
                    boxShadow: input.trim()
                      ? "0 0 12px rgba(99,102,241,0.4)"
                      : "none",
                  }}
                  onMouseEnter={(e) => {
                    if (input.trim()) {
                      (e.currentTarget as HTMLButtonElement).style.background =
                        "rgba(99,102,241,1)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (input.trim()) {
                      (e.currentTarget as HTMLButtonElement).style.background =
                        "rgba(99,102,241,0.9)";
                    }
                  }}
                >
                  <Send size={11} />
                </button>
              )}
            </div>
          </div>

          {/* Keyboard hint */}
          <p
            style={{
              margin: "5px 0 0",
              fontSize: 9.5,
              color: "#1e293b",
              textAlign: "center",
            }}
          >
            ↵ send · ⇧↵ new line · click pills to highlight canvas
          </p>
        </div>
      </div>
    </>
  );
}
