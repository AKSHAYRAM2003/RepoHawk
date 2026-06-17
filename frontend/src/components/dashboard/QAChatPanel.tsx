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
  ChevronRight, Copy, Check, RefreshCw, Sparkles, ChevronDown, ChevronUp
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

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

// ── Markdown Components ───────────────────────────────────────────────────────

function CollapsibleCodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  
  const copy = () => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lineCount = code.split("\n").length;
  const isLarge = lineCount > 15;

  return (
    <div
      style={{
        margin: "8px 0",
        borderRadius: 10,
        background: "var(--surface-container-highest)",
        border: "1px solid var(--outline-variant)",
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
          borderBottom: "1px solid var(--outline-variant)",
          background: "color-mix(in srgb, var(--on-surface) 5%, transparent)",
        }}
      >
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: "var(--on-surface-variant)",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
          }}
        >
          {lang || "code"}
        </span>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {isLarge && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--on-surface-variant)",
                fontSize: 10,
                fontWeight: 600,
                transition: "color 0.2s",
                padding: "2px 0",
              }}
            >
              {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              {isExpanded ? "Collapse" : "Expand"}
            </button>
          )}
          <button
            onClick={copy}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              background: "none",
              border: "none",
              cursor: "pointer",
              color: copied ? "#10b981" : "var(--on-surface-variant)",
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
      </div>
      
      {/* Code content */}
      <div 
        style={{ 
          maxHeight: isExpanded ? (isLarge ? "400px" : "none") : "0", 
          overflowY: "auto",
          transition: "max-height 0.3s ease-in-out",
          display: isExpanded ? "block" : "none",
        }}
      >
        <SyntaxHighlighter
          style={vscDarkPlus as any}
          language={lang || "text"}
          PreTag="div"
          customStyle={{
            margin: 0,
            padding: "10px 14px",
            background: "transparent",
            fontSize: 11,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          }}
        >
          {code}
        </SyntaxHighlighter>
      </div>
      
      {isLarge && !isExpanded && (
        <div 
          style={{ 
            padding: "8px 14px", 
            fontSize: 11, 
            color: "var(--on-surface-variant)",
            fontStyle: "italic" 
          }}
        >
          {lineCount} lines hidden...
        </div>
      )}
    </div>
  );
}

const MarkdownComponents: import("react-markdown").Components = {
  p: ({ children }) => (
    <p style={{ fontSize: 12.5, color: "var(--on-surface-variant)", lineHeight: 1.7, margin: "4px 0" }}>
      {children}
    </p>
  ),
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer" style={{ color: "var(--primary)", textDecoration: "underline" }}>
      {children}
    </a>
  ),
  ul: ({ children }) => (
    <ul style={{ margin: "5px 0", paddingLeft: 16, listStyle: "none" }}>
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol style={{ margin: "5px 0", paddingLeft: 20 }}>
      {children}
    </ol>
  ),
  li: ({ children, className }) => {
    // Basic detection for unordered list items to add custom bullet
    const isOrdered = className?.includes("ordered");
    return (
      <li style={{ fontSize: 12.5, color: "var(--on-surface-variant)", lineHeight: 1.65, marginBottom: 3, display: "flex", alignItems: "flex-start", gap: 6 }}>
        {!isOrdered && <span style={{ color: "var(--primary)", marginTop: 2, flexShrink: 0 }}>▸</span>}
        <span style={{flex: 1}}>{children}</span>
      </li>
    );
  },
  h1: ({ children }) => <div style={{ fontSize: 16, fontWeight: 600, color: "var(--on-surface)", marginTop: 14, marginBottom: 6, borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: 4 }}>{children}</div>,
  h2: ({ children }) => <div style={{ fontSize: 15, fontWeight: 600, color: "var(--on-surface)", marginTop: 14, marginBottom: 6, borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: 4 }}>{children}</div>,
  h3: ({ children }) => <div style={{ fontSize: 14, fontWeight: 600, color: "var(--on-surface)", marginTop: 14, marginBottom: 6 }}>{children}</div>,
  h4: ({ children }) => <div style={{ fontSize: 13, fontWeight: 600, color: "var(--on-surface)", marginTop: 14, marginBottom: 6 }}>{children}</div>,
  strong: ({ children }) => <strong style={{ color: "var(--on-surface)", fontWeight: 700 }}>{children}</strong>,
  code({ node, inline, className, children, ...props }: any) {
    const match = /language-(\w+)/.exec(className || "");
    const lang = match ? match[1] : "";
    const code = String(children).replace(/\n$/, "");
    
    if (!inline && match) {
      return <CollapsibleCodeBlock lang={lang} code={code} />;
    }
    
    return (
      <code
        style={{
          background: "color-mix(in srgb, var(--primary) 15%, transparent)",
          color: "var(--primary)",
          padding: "1px 5px",
          borderRadius: 4,
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          fontSize: 11.5,
        }}
        {...props}
      >
        {children}
      </code>
    );
  },
};

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
            background: "var(--primary)",
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
        background: "color-mix(in srgb, var(--primary) 10%, transparent)",
        border: "1px solid color-mix(in srgb, var(--primary) 22%, transparent)",
        borderRadius: 5,
        color: "var(--primary)",
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
        el.style.color = "color-mix(in srgb, var(--primary) 60%, white)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.background = "rgba(99,102,241,0.1)";
        el.style.borderColor = "rgba(99,102,241,0.22)";
        el.style.color = "color-mix(in srgb, var(--primary) 80%, white)";
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
        background: "color-mix(in srgb, var(--primary) 15%, transparent)",
        border: "1px solid color-mix(in srgb, var(--primary) 40%, transparent)",
        borderRadius: 20,
        color: "var(--primary)",
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
            background: "linear-gradient(135deg, color-mix(in srgb, var(--primary) 22%, transparent), color-mix(in srgb, var(--secondary) 15%, transparent))",
            border: "1px solid color-mix(in srgb, var(--primary) 28%, transparent)",
            borderRadius: "13px 13px 4px 13px",
            padding: "8px 13px",
          }}
        >
          <p
            style={{
              fontSize: 12.5,
              color: "var(--on-surface)",
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
            background: "color-mix(in srgb, var(--primary) 18%, transparent)",
            border: "1px solid color-mix(in srgb, var(--primary) 30%, transparent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Bot size={12} style={{ color: "var(--primary)" }} />
        </div>
        <span
          style={{
            fontSize: 9.5,
            fontWeight: 800,
            color: "var(--on-surface-variant)",
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
          background: "var(--surface-container-high)",
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
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={MarkdownComponents}
            >
              {message.content}
            </ReactMarkdown>
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

export default function QAChatPanel({
  repoId,
  validNodeIds = [],
}: {
  repoId: string;
  validNodeIds?: string[];
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  // Session ID is now server-issued. We start with the localStorage value
  // (if any) and replace it on the first SSE `session` event.
  const [sessionId, setSessionId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem(`repohawk:chat:session:${repoId}`);
    } catch {
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [metricsOpen, setMetricsOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasMessages = messages.length > 0;

  // Persist the session_id to localStorage whenever it changes
  useEffect(() => {
    if (typeof window === "undefined" || !sessionId) return;
    try {
      window.localStorage.setItem(`repohawk:chat:session:${repoId}`, sessionId);
    } catch {}
  }, [sessionId, repoId]);

  // Load existing history on mount (commit 8)
  useEffect(() => {
    let cancelled = false;
    async function loadHistory() {
      if (!sessionId) {
        setIsLoadingHistory(false);
        return;
      }
      try {
        const r = await fetch(
          `/api/chat/sessions/${repoId}/${sessionId}/messages`
        );
        if (!r.ok) {
          if (!cancelled) setIsLoadingHistory(false);
          return;
        }
        const data = await r.json();
        const msgs = (data.messages || []).map((m: any) => ({
          id: m.created_at || crypto.randomUUID(),
          role: m.role as "user" | "assistant",
          content: m.content || "",
          sourceFiles: m.source_files || undefined,
          highlightNodeId: m.highlight_node_id || undefined,
          codeRef: m.code_ref || undefined,
          timestamp: new Date(m.created_at || Date.now()),
        }));
        if (!cancelled) setMessages(msgs);
      } catch (err) {
        console.warn("Failed to load chat history:", err);
      } finally {
        if (!cancelled) setIsLoadingHistory(false);
      }
    }
    loadHistory();
    return () => { cancelled = true; };
  }, [repoId, sessionId]);

  // Smooth scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Start a new conversation: clear the session id and messages
  const startNewSession = useCallback(() => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(`repohawk:chat:session:${repoId}`);
      } catch {}
    }
    setSessionId(null);
    setMessages([]);
  }, [repoId]);

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
            session_id: sessionId,    // null = server will create one
            query: query.trim(),
            valid_node_ids: validNodeIds,
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

            // SSE frames are separated by double newlines
            const frames = buffer.split(/\r?\n\r?\n/);
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

              if (event.type === "session" && event.session_id) {
                // Server-issued session id; persist it
                if (!sessionId) {
                  setSessionId(event.session_id);
                }
              } else if (event.type === "token" && event.delta) {
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
        {/* ── Loading history on mount ─────────────────────────── */}
        {isLoadingHistory && !hasMessages && (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--on-surface-variant)",
              fontSize: 11.5,
            }}
          >
            <RefreshCw
              size={12}
              style={{ animation: "rh-spin 1s linear infinite", marginRight: 8 }}
            />
            Loading previous conversation…
          </div>
        )}

        {/* ── Empty state / Suggestions ─────────────────────────── */}
        {!isLoadingHistory && !hasMessages && (
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
                background: "linear-gradient(135deg, color-mix(in srgb, var(--primary) 28%, transparent), color-mix(in srgb, var(--secondary) 14%, transparent))",
                border: "1px solid color-mix(in srgb, var(--primary) 38%, transparent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 28px color-mix(in srgb, var(--primary) 20%, transparent)",
              }}
            >
              <Sparkles size={22} style={{ color: "var(--primary)" }} />
            </div>

            <div style={{ textAlign: "center", maxWidth: 230 }}>
              <p
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "var(--on-surface)",
                  margin: "0 0 5px",
                }}
              >
                Ask about the codebase
              </p>
              <p
                style={{
                  fontSize: 11.5,
                  color: "var(--on-surface-variant)",
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
                  type="button"
                  onClick={(e) => { e.preventDefault(); sendMessage(s); }}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "7px 11px",
                    background: "color-mix(in srgb, var(--on-surface) 5%, transparent)",
                    border: "1px solid var(--outline-variant)",
                    borderRadius: 9,
                    color: "var(--on-surface-variant)",
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
                    el.style.color = "color-mix(in srgb, var(--primary) 40%, white)";
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget as HTMLButtonElement;
                    el.style.background = "rgba(255,255,255,0.03)";
                    el.style.borderColor = "rgba(255,255,255,0.07)";
                    el.style.color = "var(--on-surface-variant)";
                  }}
                >
                  <ChevronRight
                    size={10}
                    style={{ flexShrink: 0, color: "var(--primary)" }}
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
            borderTop: "1px solid var(--outline-variant)",
            background: "color-mix(in srgb, var(--surface-container) 70%, transparent)",
            backdropFilter: "blur(12px)",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              background: "var(--surface-container-highest)",
              border: "1px solid var(--outline-variant)",
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
                color: "var(--on-surface)",
                fontSize: 12.5,
                lineHeight: 1.6,
                fontFamily: "inherit",
                minHeight: 20,
                maxHeight: 110,
                overflowY: "auto",
                caretColor: "var(--primary)",
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
                style={{ fontSize: 9.5, color: "var(--on-surface-variant)", fontFamily: "monospace" }}
              >
                {repoId.slice(0, 8)}…
              </span>

              {/* Send / Stop button */}
              {isLoading ? (
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); stopGeneration(); }}
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
                    color: "white",
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
                  <Square size={10} fill="currentColor" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); sendMessage(input); }}
                  disabled={!input.trim()}
                  title="Send message (Enter)"
                  aria-label="Send message"
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: input.trim()
                      ? "var(--primary)"
                      : "color-mix(in srgb, var(--on-surface) 5%, transparent)",
                    border: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: input.trim() ? "pointer" : "not-allowed",
                    transition: "all 0.15s",
                    color: input.trim() ? "var(--on-primary)" : "var(--on-surface-variant)",
                    flexShrink: 0,
                    boxShadow: input.trim()
                      ? "0 0 12px color-mix(in srgb, var(--primary) 40%, transparent)"
                      : "none",
                  }}
                  onMouseEnter={(e) => {
                    if (input.trim()) {
                      (e.currentTarget as HTMLButtonElement).style.background =
                        "color-mix(in srgb, var(--primary) 85%, white)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (input.trim()) {
                      (e.currentTarget as HTMLButtonElement).style.background =
                        "var(--primary)";
                    }
                  }}
                >
                  <Send size={11} />
                </button>
              )}
            </div>
          </div>

          {/* Keyboard hint + toolbar */}
          <div
            style={{
              margin: "5px 0 0",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 9.5,
                color: "var(--on-surface-variant)",
                textAlign: "center",
                flex: 1,
              }}
            >
              ↵ send · ⇧↵ new line · click pills to highlight canvas
            </p>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {sessionId && messages.length > 0 && (
                <button
                  onClick={startNewSession}
                  title="Start a new conversation"
                  aria-label="Start a new conversation"
                  style={{
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--on-surface-variant)",
                    fontSize: 9.5,
                    display: "flex",
                    alignItems: "center",
                    gap: 3,
                    padding: 0,
                    transition: "color 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.color = "var(--on-surface-variant)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.color = "var(--on-surface-variant)";
                  }}
                >
                  <RefreshCw size={9} /> new
                </button>
              )}
              {sessionId && (
                <button
                  onClick={() => setMetricsOpen(true)}
                  title="Show query metrics"
                  aria-label="Show query metrics"
                  style={{
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--on-surface-variant)",
                    fontSize: 9.5,
                    display: "flex",
                    alignItems: "center",
                    gap: 3,
                    padding: 0,
                    transition: "color 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.color = "var(--on-surface-variant)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.color = "var(--on-surface-variant)";
                  }}
                >
                  📊 metrics
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Metrics modal (commit 8) */}
      {metricsOpen && (
        <MetricsModal
          sessionId={sessionId}
          onClose={() => setMetricsOpen(false)}
        />
      )}
    </>
  );
}

// ── Metrics Modal (commit 8) ──────────────────────────────────────────────────

interface MetricsRow {
  id: string;
  question: string;
  num_chunks_retrieved: number;
  num_chunks_kept: number;
  answer_length_chars: number;
  highlight_node_id: string | null;
  highlight_hit: boolean;
  latency_total_ms: number;
  latency_retrieval_ms: number;
  latency_llm_ms: number;
  created_at: string | null;
  error: string | null;
}

function MetricsModal({
  sessionId,
  onClose,
}: {
  sessionId: string | null;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<MetricsRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(
          `/api/chat/metrics?session_id=${encodeURIComponent(sessionId)}`
        );
        if (!r.ok) return;
        const data = await r.json();
        if (!cancelled) setRows(data.metrics || []);
      } catch (err) {
        console.warn("Failed to load metrics:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sessionId]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--surface-container-high)",
          border: "1px solid var(--outline-variant)",
          borderRadius: 14,
          maxWidth: 600,
          width: "100%",
          maxHeight: "85vh",
          overflow: "auto",
          padding: 18,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 14,
          }}
        >
          <h3 style={{ margin: 0, fontSize: 14, color: "var(--on-surface)", fontWeight: 700 }}>
            Query Telemetry
          </h3>
          <button
            onClick={onClose}
            aria-label="Close metrics"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--on-surface-variant)",
              cursor: "pointer",
              fontSize: 18,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {loading ? (
          <p style={{ color: "var(--on-surface-variant)", fontSize: 12, textAlign: "center", padding: 24 }}>
            Loading…
          </p>
        ) : rows.length === 0 ? (
          <p style={{ color: "var(--on-surface-variant)", fontSize: 12, textAlign: "center", padding: 24 }}>
            No metrics yet. Send a message to record telemetry.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {rows.map((r) => (
              <div
                key={r.id}
                style={{
                  background: "color-mix(in srgb, var(--on-surface) 5%, transparent)",
                  border: "1px solid var(--outline-variant)",
                  borderRadius: 8,
                  padding: "9px 11px",
                }}
              >
                <p
                  style={{
                    margin: "0 0 4px",
                    fontSize: 11.5,
                    color: "var(--on-surface-variant)",
                    fontWeight: 600,
                    lineHeight: 1.4,
                  }}
                >
                  {r.question.length > 80 ? r.question.slice(0, 80) + "…" : r.question}
                </p>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                    fontSize: 10,
                    color: "var(--on-surface-variant)",
                  }}
                >
                  <span>🕒 {r.latency_total_ms}ms</span>
                  <span>📥 {r.num_chunks_kept}/{r.num_chunks_retrieved} chunks</span>
                  <span>📤 {r.answer_length_chars}c</span>
                  {r.highlight_hit && <span style={{ color: "#10b981" }}>🎯 hit</span>}
                  {r.error && <span style={{ color: "#f87171" }}>⚠ err</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
