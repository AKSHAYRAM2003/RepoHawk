"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Search, X, FileCode, Copy, Check, Sparkles, AlertCircle, CornerDownLeft
} from "lucide-react";

interface SearchResult {
  file_path: string;
  content: string;
  line_start: number;
  line_end: number;
  score: number;
}

interface SearchModalProps {
  repoId: string;
  onClose: () => void;
}

export default function SearchModal({ repoId, onClose }: SearchModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Debounced search fetch
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/repos/${repoId}/search?q=${encodeURIComponent(searchQuery)}`);
      if (!res.ok) {
        throw new Error("Failed to fetch search results");
      }
      const data = await res.json();
      setResults(data.results || []);
      setSelectedIndex(0);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Something went wrong during search.");
    } finally {
      setLoading(false);
    }
  }, [repoId]);

  // Handle typing & debouncing
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceTimer.current = setTimeout(() => {
      performSearch(query);
    }, 250);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [query, performSearch]);

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Handle clicking outside modal
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [onClose]);

  // Copy code handler
  const handleCopy = (code: string, index: number) => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Ask AI handler
  const handleAskAI = (result: SearchResult) => {
    const aiQuestion = `Regarding the file "${result.file_path}" (lines ${result.line_start}-${result.line_end}):\n\n\`\`\`\n${result.content}\n\`\`\`\n\nCan you explain what this code snippet does, its significance, and how it fits into the system?`;
    
    // Dispatch custom event to auto-populate QA Chat
    window.dispatchEvent(
      new CustomEvent("repohawk-ask-ai-about-node", {
        detail: {
          nodeId: "",
          nodeLabel: "",
          question: aiQuestion
        }
      })
    );
    onClose();
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (results.length ? (prev + 1) % results.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (results.length ? (prev - 1 + results.length) % results.length : 0));
    } else if (e.key === "Enter" && results.length > 0) {
      e.preventDefault();
      // Ask AI about the selected item on Enter
      handleAskAI(results[selectedIndex]);
    }
  };

  // Auto-scroll selected result into view
  useEffect(() => {
    if (resultsRef.current) {
      const selectedEl = resultsRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIndex]);

  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/60 backdrop-blur-sm pt-[8vh] px-4">
      <div
        ref={modalRef}
        onKeyDown={handleKeyDown}
        className="w-full max-w-2xl flex flex-col rounded-2xl border border-outline-variant shadow-2xl overflow-hidden focus:outline-none"
        style={{
          background: "var(--surface-container)",
          maxHeight: "75vh",
        }}
        tabIndex={0}
      >
        {/* Search Input Area */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-outline-variant">
          <Search className="w-5 h-5 text-on-surface-variant opacity-60" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a semantic query (e.g. 'auth middleware' or 's3 image upload')..."
            className="flex-1 bg-transparent text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="p-1 rounded-lg hover:bg-surface-high transition-colors"
            >
              <X className="w-4 h-4 text-on-surface-variant" />
            </button>
          )}
        </div>

        {/* Results Area */}
        <div
          ref={resultsRef}
          className="flex-1 overflow-y-auto min-h-0"
          style={{ scrollbarWidth: "thin" }}
        >
          {loading && !results.length && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <span className="w-6 h-6 border-2 border-primary-color border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-on-surface-variant">Searching code semantic index...</p>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2.5 m-4 p-3.5 rounded-xl border border-rose-500/20 bg-rose-500/5 text-rose-400 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!loading && !query && (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <Sparkles className="w-8 h-8 text-primary-color opacity-50 mb-3 animate-pulse" />
              <h3 className="text-sm font-semibold text-on-surface">Semantic Code Search</h3>
              <p className="text-xs text-on-surface-variant max-w-sm mt-1 leading-relaxed">
                Enter natural language queries to search the codebase semantically. RepoHawk will retrieve and highlight matching code chunks using vector similarity.
              </p>
              <div className="flex items-center gap-3 mt-6 text-[10px] text-on-surface-variant font-mono">
                <span className="px-1.5 py-0.5 rounded border border-outline-variant bg-surface-low">↑↓</span> Navigate
                <span className="px-1.5 py-0.5 rounded border border-outline-variant bg-surface-low">Enter</span> Ask AI
                <span className="px-1.5 py-0.5 rounded border border-outline-variant bg-surface-low">Esc</span> Close
              </div>
            </div>
          )}

          {!loading && query && !results.length && (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <p className="text-sm font-semibold text-on-surface">No matches found</p>
              <p className="text-xs text-on-surface-variant mt-1">Try phrasing your query differently or using key terms.</p>
            </div>
          )}

          {results.length > 0 && (
            <div className="p-2 space-y-2">
              {results.map((result, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <div
                    key={idx}
                    data-index={idx}
                    onClick={() => setSelectedIndex(idx)}
                    className={`group border rounded-xl overflow-hidden transition-all duration-150 cursor-pointer ${
                      isSelected
                        ? "border-[#6366f1]/40 bg-[#6366f1]/5 shadow-md shadow-[#6366f1]/2"
                        : "border-outline-variant hover:border-on-surface-variant/30 hover:bg-surface-low"
                    }`}
                  >
                    {/* Header bar */}
                    <div className="flex items-center justify-between px-3 py-2 border-b border-outline-variant/50 bg-surface-low/30">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileCode className="w-3.5 h-3.5 text-[#818cf8] flex-shrink-0" />
                        <span className="text-[11px] font-mono font-semibold text-on-surface truncate">
                          {result.file_path}
                        </span>
                        <span className="text-[10px] text-on-surface-variant opacity-60">
                          (lines {result.line_start}-{result.line_end})
                        </span>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span
                          className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                          style={{
                            background: `rgba(16, 185, 129, ${result.score * 0.15})`,
                            color: result.score > 0.7 ? "#10b981" : "#a8a29e"
                          }}
                        >
                          {Math.round(result.score * 100)}% Match
                        </span>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            title="Copy code snippet"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopy(result.content, idx);
                            }}
                            className="p-1 rounded hover:bg-surface-high text-on-surface-variant hover:text-on-surface"
                          >
                            {copiedIndex === idx ? (
                              <Check className="w-3 h-3 text-green-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                          <button
                            title="Ask AI about this code snippet"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAskAI(result);
                            }}
                            className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#6366f1]/15 border border-[#6366f1]/30 hover:bg-[#6366f1]/25 text-[#818cf8] text-[9px] font-bold"
                          >
                            <Sparkles className="w-2.5 h-2.5" />
                            Ask AI
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Code Snippet Box */}
                    <div className="p-3 overflow-x-auto bg-[#0d0e16]">
                      <pre className="text-[11.5px] font-mono leading-relaxed text-slate-300 whitespace-pre">
                        <code>{result.content}</code>
                      </pre>
                    </div>

                    {/* Bottom Selected Action Bar (Only shows when selected) */}
                    {isSelected && (
                      <div className="flex items-center justify-between px-3 py-1.5 border-t border-outline-variant bg-[#6366f1]/5 text-[10px] text-on-surface-variant font-mono">
                        <span>Navigate or click options to interact</span>
                        <button
                          onClick={() => handleAskAI(result)}
                          className="flex items-center gap-1 text-[#818cf8] font-bold"
                        >
                          Send to QA Chat
                          <CornerDownLeft className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
