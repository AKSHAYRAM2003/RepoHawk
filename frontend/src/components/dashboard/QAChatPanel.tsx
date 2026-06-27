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
  ArrowUp, Bot, FileCode, Zap, AlertCircle, Square,
  ChevronRight, Copy, Check, RefreshCw, ChevronDown, ChevronUp,
  History, Plus, Trash2, Search
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/cjs/styles/prism";

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
        background: "#1e1e1e",
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
          borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
          background: "rgba(0, 0, 0, 0.2)",
        }}
      >
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: "rgba(255, 255, 255, 0.7)",
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
                color: "rgba(255, 255, 255, 0.7)",
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
              color: copied ? "#10b981" : "rgba(255, 255, 255, 0.7)",
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
            color: "#e2e8f0",
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
            color: "rgba(255, 255, 255, 0.5)",
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
  // Hooks must be declared before any conditional return (Rules of Hooks)
  const [isCopied, setIsCopied] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const handleCopy = useCallback(() => {
    if (!message.content) return;
    navigator.clipboard.writeText(message.content).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 1500);
    }).catch(() => {
      // Fallback for browsers without clipboard API
      const el = document.createElement("textarea");
      el.value = message.content;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 1500);
    });
  }, [message.content]);

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
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        marginBottom: 4,
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

      {/* Content bubble */}
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

      {/* ── Action bar below bubble (Claude / ChatGPT style) ── */}
      {!message.isLoading && !message.isError && message.content && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            paddingLeft: 2,
            height: 24,
            opacity: isHovered || isCopied ? 1 : 0,
            transition: "opacity 0.15s",
          }}
        >
          <button
            onClick={handleCopy}
            title={isCopied ? "Copied!" : "Copy response"}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "3px 8px",
              borderRadius: 6,
              border: "1px solid",
              borderColor: isCopied
                ? "rgba(16,185,129,0.35)"
                : "color-mix(in srgb, var(--on-surface) 12%, transparent)",
              background: isCopied
                ? "rgba(16,185,129,0.10)"
                : "color-mix(in srgb, var(--on-surface) 5%, transparent)",
              color: isCopied ? "#10b981" : "var(--on-surface-variant)",
              cursor: "pointer",
              fontSize: 10,
              fontWeight: 600,
              transition: "background 0.15s, color 0.15s, border-color 0.15s",
            }}
            onMouseEnter={(e) => {
              if (!isCopied) {
                e.currentTarget.style.background = "color-mix(in srgb, var(--on-surface) 10%, transparent)";
                e.currentTarget.style.color = "var(--on-surface)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isCopied) {
                e.currentTarget.style.background = "color-mix(in srgb, var(--on-surface) 5%, transparent)";
                e.currentTarget.style.color = "var(--on-surface-variant)";
              }
            }}
          >
            {isCopied ? <Check size={11} /> : <Copy size={11} />}
            <span>{isCopied ? "Copied!" : "Copy"}</span>
          </button>
        </div>
      )}

      {/* Node highlight pill */}
      {!message.isLoading && message.highlightNodeId && (
        <div style={{ paddingLeft: 2 }}>
          <NodeHighlightPill
            nodeId={message.highlightNodeId}
            onClick={() => onHighlightNode(message.highlightNodeId!)}
          />
        </div>
      )}

      {/* Source file pills — intentionally hidden per UX decision */}
    </div>
  );
}


// ── Main QA Chat Panel ────────────────────────────────────────────────────────

export default function QAChatPanel({
  repoId,
  validNodeIds = [],
  pendingQuestion,
  onPendingQuestionConsumed,
}: {
  repoId: string;
  validNodeIds?: string[];
  pendingQuestion?: string | null;
  onPendingQuestionConsumed?: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [repoName, setRepoName] = useState<string | null>(null);
  const [repoOwner, setRepoOwner] = useState<string | null>(null);
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
  const [historyOpen, setHistoryOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Incremented when we explicitly want to reload the current session's messages
  // (e.g. user clicked the same session again in history). Acts as a dependency
  // trigger without mangling sessionId.
  const reloadCounter = useRef(0);
  const [reloadTick, setReloadTick] = useState(0);
  const autoResumedRepos = useRef<Set<string>>(new Set());
  // Tracks session IDs that were just issued by the server during an active
  // streaming request. We must NOT load history for these because the answer
  // hasn't been persisted yet and would overwrite the optimistic UI.
  const streamingIssuedSessionId = useRef<string | null>(null);
  // Set to true when the user explicitly clicks "New Chat" (+ button).
  // Prevents the loadHistory effect from showing a loading spinner or
  // auto-resuming the previous session on that single run.
  const explicitNewSessionRef = useRef(false);
  const hasMessages = messages.length > 0;

  // Fetch repo metadata for the context chip above the input
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/repos/${repoId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!cancelled && data) {
          setRepoName(data.name || null);
          setRepoOwner(data.owner || null);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [repoId]);

  // Persist the session_id to localStorage whenever it changes
  useEffect(() => {
    if (typeof window === "undefined" || !sessionId) return;
    try {
      window.localStorage.setItem(`repohawk:chat:session:${repoId}`, sessionId);
    } catch {}
  }, [sessionId, repoId]);

  // Load existing history on mount and when sessionId changes
  useEffect(() => {
    let cancelled = false;
    async function loadHistory() {
      if (!sessionId) {
        // If the user explicitly started a new session (clicked +), skip
        // auto-resume and immediately show the empty state.
        if (explicitNewSessionRef.current) {
          explicitNewSessionRef.current = false; // consume the flag
          if (!cancelled) setIsLoadingHistory(false);
          return;
        }
        if (!autoResumedRepos.current.has(repoId)) {
          autoResumedRepos.current.add(repoId);
          // Auto-resume logic: if no session is active, fetch the latest one for this repo
          try {
            const r = await fetch(`/api/chat/sessions?repo_id=${encodeURIComponent(repoId)}`);
            if (r.ok) {
              const data = await r.json();
              if (!cancelled && data.sessions && data.sessions.length > 0) {
                setSessionId(data.sessions[0].id);
                return; // The effect will re-run with the new sessionId
              }
            }
          } catch (err) {
            console.warn("Failed to auto-resume session:", err);
          }
        }
        if (!cancelled) setIsLoadingHistory(false);
        return;
      }

      // Bug fix: If this sessionId was just issued by the server during an
      // active streaming request, the answer hasn't been persisted yet.
      // Loading history now would overwrite the optimistic streaming messages
      // with an incomplete server snapshot. Skip and let the stream finish.
      if (streamingIssuedSessionId.current === sessionId) {
        if (!cancelled) setIsLoadingHistory(false);
        return;
      }

      try {
        const r = await fetch(
          `/api/chat/sessions/${repoId}/${sessionId}/messages`
        );
        if (!r.ok) {
          console.warn(`Failed to load messages for session ${sessionId}: ${r.status}`);
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
    setIsLoadingHistory(true);
    loadHistory();
    return () => { cancelled = true; };
  }, [repoId, sessionId, reloadTick]);

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
    // Reset the streaming-issued session tracker so future streams work correctly
    streamingIssuedSessionId.current = null;
    // Signal loadHistory to skip auto-resume and loading spinner on the next run
    explicitNewSessionRef.current = true;
    // Remove from autoResumedRepos so the next "new session" state is clean
    autoResumedRepos.current.delete(repoId);
    setSessionId(null);
    setMessages([]);
    // Immediately mark history as not loading — we're starting fresh, no
    // server data needed. This fixes the two-click bug where the loading
    // overlay hid the suggestions panel after the first click.
    setIsLoadingHistory(false);
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

  // Auto-fire pending question from Properties panel "Ask AI" button
  useEffect(() => {
    if (!pendingQuestion || isLoading) return;
    sendMessage(pendingQuestion);
    onPendingQuestionConsumed?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingQuestion]);

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
                // Server-issued session id; persist it.
                // Mark it as streaming-issued so loadHistory skips overwriting
                // the optimistic messages while the stream is still in flight.
                if (!sessionId) {
                  streamingIssuedSessionId.current = event.session_id;
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
                      m.content + (m.content
                        ? "\n\n---\n*⬜ Generation stopped — the response above may be incomplete. Ask again to continue.*"
                        : "*⬜ Generation was stopped before any content arrived. Please try your question again.*"),
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
        // Stream is done — clear the streaming-issued guard so subsequent
        // history loads (e.g. clicking the session in history panel) work normally.
        streamingIssuedSessionId.current = null;
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
        {/* ── Top Header ────────────────────────────────────────────── */}
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "8px 12px 0", gap: 12 }}>
          <button
            onClick={startNewSession}
            title="New Chat"
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--on-surface-variant)",
              transition: "color 0.15s",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "var(--primary)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "var(--on-surface-variant)";
            }}
          >
            <Plus size={16} />
          </button>
          <button
            onClick={() => setHistoryOpen(true)}
            title="Chat History"
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--on-surface-variant)",
              transition: "color 0.15s",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "var(--primary)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "var(--on-surface-variant)";
            }}
          >
            <History size={16} />
          </button>
        </div>

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
            {/* Logo avatar — RepoHawk house icon */}
           
        <div className="flex items-center gap-1 text-on-surface mb-0">
          <div className="h-10 w-auto text-primary">
            <svg
              width="34"
              height="36"
              viewBox="0 0 49 40"
              fill="none"
              className="h-full w-auto"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient id="logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#4a50c5" />
                  <stop offset="100%" stopColor="#00b08a" />
                </linearGradient>
              </defs>
              <g id="logomark">
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M17 0C17.5523 0 18 0.447715 18 1V8.39648C18 8.61918 18.2693 8.7307 18.4268 8.57324L26.4141 0.585938C26.7891 0.210936 27.2978 7.97938e-05 27.8281 0H36.5859C36.8511 4.04019e-05 37.1055 0.105468 37.293 0.292969L40.293 3.29297C40.6834 3.68347 40.6834 4.31653 40.293 4.70703L36.4268 8.57324C36.2693 8.73073 36.3808 8.99997 36.6035 9H44.5859C44.8511 9.00004 45.1055 9.10547 45.293 9.29297L48.293 12.293C48.6834 12.6835 48.6834 13.3165 48.293 13.707L44.3535 17.6465C44.1583 17.8417 44.1583 18.1583 44.3535 18.3535L47.5859 21.5859C48.4914 22.4914 49 23.7195 49 25C49 26.2805 48.4913 27.5086 47.5859 28.4141L36.5859 39.4141C36.2109 39.7891 35.7022 39.9999 35.1719 40H32C31.4477 40 31 39.5523 31 39V31.6035C31 31.3808 30.7307 31.2693 30.5732 31.4268L22.5859 39.4141C22.2109 39.7891 21.7022 39.9999 21.1719 40H12.4141C12.1489 40 11.8945 39.8945 11.707 39.707L8.70703 36.707C8.31661 36.3165 8.31661 35.6835 8.70703 35.293L12.5732 31.4268C12.7307 31.2693 12.6192 31 12.3965 31H4.41406C4.1489 31 3.89453 30.8945 3.70703 30.707L0.707031 27.707C0.316606 27.3165 0.316607 26.6835 0.707031 26.293L4.64648 22.3535C4.8417 22.1583 4.8417 21.8417 4.64648 21.6465L1.41406 18.4141C0.508652 17.5086 0 16.2805 0 15C0 13.7195 0.508651 12.4914 1.41406 11.5859L12.4141 0.585938C12.7891 0.210936 13.2978 8.00463e-05 13.8281 0H17ZM20.0713 9C18.7452 9 17.4728 9.52716 16.5352 10.4648L5.85352 21.1465C5.53861 21.4615 5.76165 21.9999 6.20703 22H20.793C21.2383 22.0001 21.4613 22.5386 21.1465 22.8535L13.8535 30.1465C13.5386 30.4615 13.7616 30.9999 14.207 31H28.9287C30.2548 31 31.5272 30.4728 32.4648 29.5352L43.1465 18.8535C43.4417 18.5583 43.2642 18.0663 42.874 18.0059L42.793 18H28.207C27.7616 18 27.5386 17.4615 27.8535 17.1465L35.1465 9.85352C35.4614 9.53855 35.2384 9.00006 34.793 9H20.0713Z"
                  fill="url(#logo-gradient)"
                />
              </g>
            </svg>
          </div>
          <h2 className="text-on-surface text-2xl font-headline font-extrabold leading-tight tracking-[-0.02em]">
            RepoHawk
          </h2>
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
              gap: 0,
              background: "var(--surface-container-highest)",
              border: "1px solid var(--outline-variant)",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            {/* Repo context chip — shows which repo is indexed */}
            {(repoName || repoOwner) && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "7px 11px 6px",
                  borderBottom: "1px solid var(--outline-variant)",
                  background: "color-mix(in srgb, var(--on-surface) 3%, transparent)",
                }}
              >
                {/* GitHub logo */}
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="var(--on-surface-variant)"
                  style={{ flexShrink: 0 }}
                >
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
                </svg>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--on-surface-variant)",
                    letterSpacing: "0.01em",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    flex: 1,
                  }}
                >
                  {repoOwner && repoName
                    ? `${repoOwner}/${repoName}`
                    : repoName || repoOwner || "Repository"}
                </span>
                {/* <span
                  style={{
                    fontSize: 9,
                    color: "var(--on-surface-variant)",
                    opacity: 0.5,
                    flexShrink: 0,
                    background: "color-mix(in srgb, var(--primary) 12%, transparent)",
                    color: "var(--primary)",
                    padding: "1px 6px",
                    borderRadius: 20,
                    fontWeight: 700,
                    letterSpacing: "0.05em",
                  }}
                >
                  indexed
                </span> */}
              </div>
            )}
            <div style={{ padding: "9px 11px 7px" }}>
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
                marginTop: 6,
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
                      "rgba(189, 51, 67)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background =
                      "rgba(189, 51, 67)";
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
                  <ArrowUp size={12} strokeWidth={2.5} />
                </button>
              )}
            </div>
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
              {/* {sessionId && messages.length > 0 && (
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
              )} */}
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

      {/* History modal */}
      {historyOpen && (
        <ChatHistoryModal
          repoId={repoId}
          repoName={repoName}
          repoOwner={repoOwner}
          currentSessionId={sessionId}
          onClose={() => setHistoryOpen(false)}
          onSelectSession={(id) => {
            // Persist selected session to localStorage so reloads resume correctly
            try {
              window.localStorage.setItem(`repohawk:chat:session:${repoId}`, id);
            } catch {}
            if (id === sessionId) {
              // Same session clicked — bump reloadTick to force the useEffect to
              // re-fetch messages without mangling sessionId (avoids auto-resume race).
              setMessages([]);
              reloadCounter.current += 1;
              setReloadTick(reloadCounter.current);
            } else {
              setSessionId(id);
              setMessages([]);
              setIsLoadingHistory(true);
            }
            setHistoryOpen(false);
          }}
          onDeleteSession={(deletedId) => {
            // If user deleted the currently active session, reset to a clean state
            if (deletedId === sessionId) {
              startNewSession();
            }
          }}
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

// ── Chat History Modal ────────────────────────────────────────────────────────

interface ChatSession {
  id: string;
  repo_id: string;
  created_at: string;
  updated_at: string;
  title?: string;
}

function ChatHistoryModal({
  repoId,
  repoName,
  repoOwner,
  currentSessionId,
  onClose,
  onSelectSession,
  onDeleteSession,
}: {
  repoId: string;
  repoName: string | null;
  repoOwner: string | null;
  currentSessionId: string | null;
  onClose: () => void;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
}) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/chat/sessions?repo_id=${encodeURIComponent(repoId)}`);
      if (r.ok) {
        const data = await r.json();
        setSessions(data.sessions || []);
      }
    } catch (err) {
      console.warn("Failed to load sessions:", err);
    } finally {
      setLoading(false);
    }
  }, [repoId]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const deleteSession = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    try {
      const r = await fetch(`/api/chat/sessions/${repoId}/${sessionId}`, {
        method: "DELETE",
      });
      if (r.ok) {
        onDeleteSession(sessionId);
        fetchSessions();
      } else {
        console.warn("Failed to delete session:", r.status);
      }
    } catch (err) {
      console.error("Delete session error:", err);
    }
  };

  const filteredSessions = sessions.filter((s) => {
    const q = searchQuery.toLowerCase();
    const title = s.title || "Untitled Conversation";
    return title.toLowerCase().includes(q) || s.id.toLowerCase().includes(q);
  });

  const timeAgo = (dateStr: string) => {
    const msPerMinute = 60 * 1000;
    const msPerHour = msPerMinute * 60;
    const msPerDay = msPerHour * 24;
    const msPerMonth = msPerDay * 30;

    // Backend stores UTC — parse correctly regardless of trailing Z
    const utcDateStr = dateStr.endsWith('Z') || dateStr.endsWith('+00:00') ? dateStr : dateStr + 'Z';
    const elapsed = Date.now() - new Date(utcDateStr).getTime();

    if (elapsed < 0) return "just now";
    if (elapsed < msPerMinute) return "just now";
    if (elapsed < msPerHour) return Math.round(elapsed / msPerMinute) + "m ago";
    if (elapsed < msPerDay) return Math.round(elapsed / msPerHour) + "h ago";
    if (elapsed < msPerMonth) return Math.round(elapsed / msPerDay) + "d ago";
    return Math.round(elapsed / msPerMonth) + "mo ago";
  };

  const displayRepo = repoOwner && repoName ? `${repoOwner}/${repoName}` : repoName || "RepoHawk";

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
          background: "var(--surface-container)",
          border: "1px solid var(--outline-variant)",
          borderRadius: 16,
          maxWidth: 700,
          width: "100%",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Search Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--outline-variant)" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              background: "var(--surface-container-highest)",
              border: "1px solid var(--outline)",
              borderRadius: 8,
              padding: "8px 12px",
              gap: 10,
            }}
          >
            <Search size={18} color="var(--on-surface-variant)" />
            <input
              type="text"
              placeholder="Search all convos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: "transparent",
                border: "none",
                outline: "none",
                color: "var(--on-surface)",
                fontSize: 14,
                width: "100%",
              }}
            />
          </div>
        </div>

        {/* List Body */}
        <div style={{ padding: "16px 20px", overflowY: "auto", flex: 1 }}>
          {loading ? (
             <p style={{ color: "var(--on-surface-variant)", fontSize: 13, textAlign: "center", padding: 24 }}>
               Loading history...
             </p>
          ) : filteredSessions.length === 0 ? (
             <p style={{ color: "var(--on-surface-variant)", fontSize: 13, textAlign: "center", padding: 24 }}>
               No conversations found.
             </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {(() => {
                // Group sessions by date
                const groups: Record<string, typeof filteredSessions> = {
                  "Today": [],
                  "Yesterday": [],
                  "Previous 7 Days": [],
                  "Older": []
                };

                const today = new Date();
                const yesterday = new Date(today);
                yesterday.setDate(yesterday.getDate() - 1);
                const sevenDaysAgo = new Date(today);
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

                filteredSessions.forEach((s) => {
                  const raw = s.updated_at || s.created_at;
                  const utcStr = raw.endsWith('Z') || raw.endsWith('+00:00') ? raw : raw + 'Z';
                  const d = new Date(utcStr);
                  if (d.toDateString() === today.toDateString()) {
                    groups["Today"].push(s);
                  } else if (d.toDateString() === yesterday.toDateString()) {
                    groups["Yesterday"].push(s);
                  } else if (d > sevenDaysAgo) {
                    groups["Previous 7 Days"].push(s);
                  } else {
                    groups["Older"].push(s);
                  }
                });

                return Object.entries(groups).map(([groupName, groupSessions]) => {
                  if (groupSessions.length === 0) return null;
                  return (
                    <div key={groupName} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <p style={{ fontSize: 12, color: "var(--on-surface-variant)", fontWeight: 600, margin: "0 0 8px 8px" }}>
                        {groupName}
                      </p>
                      {groupSessions.map((s) => (
                        <div
                          key={s.id}
                          onClick={() => onSelectSession(s.id)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "12px 16px",
                            borderRadius: 8,
                            cursor: "pointer",
                            transition: "background 0.15s",
                            background: currentSessionId === s.id
                              ? "color-mix(in srgb, var(--primary) 12%, transparent)"
                              : "transparent",
                            borderLeft: currentSessionId === s.id
                              ? "3px solid var(--primary)"
                              : "3px solid transparent",
                          }}
                          onMouseEnter={(e) => {
                            if (currentSessionId !== s.id) {
                              (e.currentTarget as HTMLDivElement).style.background = "var(--surface-container-highest)";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (currentSessionId !== s.id) {
                              (e.currentTarget as HTMLDivElement).style.background = "transparent";
                            }
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 12, overflow: "hidden" }}>
                            <p style={{ margin: 0, fontSize: 14, color: "var(--on-surface)", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {s.title || "Untitled Conversation"}
                            </p>
                            <span style={{ fontSize: 12, color: "var(--on-surface-variant)", whiteSpace: "nowrap" }}>
                              {displayRepo}
                            </span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                            <span style={{ fontSize: 12, color: "var(--on-surface-variant)", whiteSpace: "nowrap" }}>
                              {timeAgo(s.updated_at || s.created_at)}
                            </span>
                            <button
                              onClick={(e) => deleteSession(e, s.id)}
                              title="Delete Conversation"
                              style={{
                                background: "transparent",
                                border: "none",
                                cursor: "pointer",
                                color: "var(--on-surface-variant)",
                                padding: 0,
                              }}
                              onMouseEnter={(e) => {
                                (e.currentTarget as HTMLButtonElement).style.color = "rgba(244,63,94,1)";
                              }}
                              onMouseLeave={(e) => {
                                (e.currentTarget as HTMLButtonElement).style.color = "var(--on-surface-variant)";
                              }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
