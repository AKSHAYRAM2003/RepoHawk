"use client";

import React, { useState, useEffect, useMemo } from "react";
import { FileCode2, Search, X, RefreshCw, AlertCircle, File, FileText, ChevronRight } from "lucide-react";

interface RepoFile {
  path: string;
  language: string;
  chunk_count: number;
}

const LANG_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  python:     { bg: "rgba(59,130,246,0.12)", text: "#60a5fa", dot: "#3b82f6" },
  typescript: { bg: "rgba(99,102,241,0.12)", text: "#818cf8", dot: "#6366f1" },
  javascript: { bg: "rgba(234,179,8,0.12)",  text: "#facc15", dot: "#eab308" },
  go:         { bg: "rgba(6,182,212,0.12)",  text: "#22d3ee", dot: "#06b6d4" },
  rust:       { bg: "rgba(249,115,22,0.12)", text: "#fb923c", dot: "#f97316" },
  java:       { bg: "rgba(239,68,68,0.12)",  text: "#f87171", dot: "#ef4444" },
  unknown:    { bg: "rgba(100,116,139,0.12)",text: "#94a3b8", dot: "#64748b" },
};

function getLangColor(lang: string) {
  return LANG_COLORS[lang.toLowerCase()] ?? LANG_COLORS.unknown;
}

function getFileIcon(lang: string) {
  const code = ["python", "typescript", "javascript", "go", "rust", "java", "c", "cpp", "cs", "php", "ruby", "swift"];
  if (code.includes(lang.toLowerCase())) return <FileCode2 size={13} />;
  if (["md", "txt", "rst"].includes(lang.toLowerCase())) return <FileText size={13} />;
  return <File size={13} />;
}

// Build a tree structure from flat file paths
function buildTree(files: RepoFile[]) {
  const root: Record<string, any> = {};
  for (const f of files) {
    const parts = f.path.split("/");
    let node = root;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!node[parts[i]]) node[parts[i]] = { __children: {} };
      node = node[parts[i]].__children;
    }
    const fname = parts[parts.length - 1];
    node[fname] = { __file: f };
  }
  return root;
}

function TreeNode({
  name,
  node,
  depth = 0,
  searchActive,
}: {
  name: string;
  node: any;
  depth?: number;
  searchActive: boolean;
}) {
  const isFile = !!node.__file;
  const [open, setOpen] = useState(!searchActive && depth < 2);

  useEffect(() => {
    if (searchActive) setOpen(true);
  }, [searchActive]);

  if (isFile) {
    const f: RepoFile = node.__file;
    const lc = getLangColor(f.language);
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "5px 10px 5px " + (12 + depth * 16) + "px",
          borderRadius: 7,
          transition: "background 0.12s",
          cursor: "default",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "color-mix(in srgb, var(--on-surface) 5%, transparent)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <span style={{ color: lc.dot, flexShrink: 0 }}>{getFileIcon(f.language)}</span>
        <span style={{ fontSize: 12, color: "var(--on-surface)", flex: 1, fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {name}
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            padding: "1px 6px",
            borderRadius: 5,
            background: lc.bg,
            color: lc.text,
            flexShrink: 0,
            fontFamily: "monospace",
          }}
        >
          {f.language}
        </span>
        {f.chunk_count > 0 && (
          <span style={{ fontSize: 10, color: "var(--on-surface-variant)", flexShrink: 0, whiteSpace: "nowrap" }}>
            {f.chunk_count} chunk{f.chunk_count !== 1 ? "s" : ""}
          </span>
        )}
      </div>
    );
  }

  const children = node.__children ?? node;
  const childKeys = Object.keys(children).filter((k) => k !== "__children");

  return (
    <div>
      <div
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "5px 10px 5px " + (10 + depth * 16) + "px",
          borderRadius: 7,
          cursor: "pointer",
          transition: "background 0.12s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "color-mix(in srgb, var(--on-surface) 5%, transparent)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <ChevronRight
          size={12}
          style={{
            color: "var(--on-surface-variant)",
            transition: "transform 0.15s",
            transform: open ? "rotate(90deg)" : "rotate(0deg)",
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: open ? "var(--on-surface)" : "var(--on-surface-variant)",
            fontFamily: "monospace",
          }}
        >
          {name}/
        </span>
        <span style={{ fontSize: 10, color: "var(--on-surface-variant)", marginLeft: "auto", opacity: 0.5 }}>
          {childKeys.length}
        </span>
      </div>
      {open && (
        <div>
          {childKeys.sort((a, b) => {
            const aDir = !children[a].__file;
            const bDir = !children[b].__file;
            if (aDir && !bDir) return -1;
            if (!aDir && bDir) return 1;
            return a.localeCompare(b);
          }).map((k) => (
            <TreeNode key={k} name={k} node={children[k]} depth={depth + 1} searchActive={searchActive} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function SourceFilesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const [data, setData] = useState<{ files: RepoFile[]; total: number; status: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [langFilter, setLangFilter] = useState<string>("all");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/repos/${id}/files`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => setData(d))
      .catch(() => setError("Failed to load file list."))
      .finally(() => setLoading(false));
  }, [id]);

  const filteredFiles = useMemo(() => {
    if (!data?.files) return [];
    return data.files.filter((f) => {
      const matchLang = langFilter === "all" || f.language === langFilter;
      const matchSearch = !search || f.path.toLowerCase().includes(search.toLowerCase());
      return matchLang && matchSearch;
    });
  }, [data, search, langFilter]);

  const languages = useMemo(() => {
    if (!data?.files) return [];
    const langs = [...new Set(data.files.map((f) => f.language))].sort();
    return langs;
  }, [data]);

  const langCounts = useMemo(() => {
    const m: Record<string, number> = {};
    (data?.files ?? []).forEach((f) => {
      m[f.language] = (m[f.language] ?? 0) + 1;
    });
    return m;
  }, [data]);

  const tree = useMemo(() => buildTree(filteredFiles), [filteredFiles]);
  const treeKeys = Object.keys(tree).sort((a, b) => {
    const aDir = !tree[a].__file;
    const bDir = !tree[b].__file;
    if (aDir && !bDir) return -1;
    if (!aDir && bDir) return 1;
    return a.localeCompare(b);
  });

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-surface">
        <RefreshCw className="w-6 h-6 animate-spin text-primary-color" />
        <span className="ml-3 text-sm text-on-surface-variant">Loading file index…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-8">
        <AlertCircle className="w-10 h-10 text-rose-400 opacity-70" />
        <p className="text-sm text-on-surface-variant">{error}</p>
      </div>
    );
  }

  if (data?.status !== "complete") {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-8 text-center">
        <FileCode2 className="w-10 h-10 opacity-30 text-on-surface-variant" />
        <p className="text-sm font-semibold text-on-surface">Files not available yet</p>
        <p className="text-xs text-on-surface-variant max-w-xs">
          {data?.status === "running" || data?.status === "queued"
            ? "Analysis is in progress. Files will appear once it completes."
            : "Run the analysis first to index the source files."}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-surface overflow-hidden">
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 20px",
          borderBottom: "1px solid var(--outline-variant)",
          background: "var(--surface-low)",
          flexShrink: 0,
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(99,102,241,0.12)",
              color: "#818cf8",
            }}
          >
            <FileCode2 size={16} />
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--on-surface)" }}>Source Files</p>
            <p style={{ fontSize: 11, color: "var(--on-surface-variant)" }}>
              {data?.total ?? 0} indexed files
            </p>
          </div>
        </div>

        {/* Search bar */}
        <div style={{ position: "relative", flex: 1, maxWidth: 280 }}>
          <Search
            size={12}
            style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#475569", pointerEvents: "none" }}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search file paths…"
            style={{
              width: "100%",
              paddingLeft: 28,
              paddingRight: search ? 28 : 10,
              paddingTop: 6,
              paddingBottom: 6,
              fontSize: 12,
              background: "var(--surface-container-highest)",
              border: "1px solid var(--outline-variant)",
              borderRadius: 8,
              color: "var(--on-surface)",
              outline: "none",
            }}
            onFocus={(e) => (e.target.style.borderColor = "rgba(99,102,241,0.5)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--outline-variant)")}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#475569" }}
            >
              <X size={10} />
            </button>
          )}
        </div>
      </div>

      {/* Lang filter chips */}
      <div
        style={{
          display: "flex",
          gap: 6,
          padding: "8px 16px",
          flexWrap: "wrap",
          borderBottom: "1px solid var(--outline-variant)",
          flexShrink: 0,
          background: "var(--surface-low)",
        }}
      >
        <button
          onClick={() => setLangFilter("all")}
          style={{
            padding: "3px 10px",
            borderRadius: 20,
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
            border: "1px solid",
            background: langFilter === "all" ? "rgba(99,102,241,0.15)" : "transparent",
            borderColor: langFilter === "all" ? "rgba(99,102,241,0.4)" : "var(--outline-variant)",
            color: langFilter === "all" ? "#818cf8" : "var(--on-surface-variant)",
            transition: "all 0.12s",
          }}
        >
          All ({data?.total ?? 0})
        </button>
        {languages.map((lang) => {
          const lc = getLangColor(lang);
          const active = langFilter === lang;
          return (
            <button
              key={lang}
              onClick={() => setLangFilter(active ? "all" : lang)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "3px 10px",
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                border: "1px solid",
                background: active ? lc.bg : "transparent",
                borderColor: active ? lc.dot + "60" : "var(--outline-variant)",
                color: active ? lc.text : "var(--on-surface-variant)",
                transition: "all 0.12s",
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: lc.dot, flexShrink: 0 }} />
              {lang} ({langCounts[lang] ?? 0})
            </button>
          );
        })}
      </div>

      {/* File tree */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 6px", scrollbarWidth: "thin", scrollbarColor: "rgba(99,102,241,0.2) transparent" }}>
        {filteredFiles.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <FileCode2 size={24} style={{ margin: "0 auto 8px", opacity: 0.4, color: "var(--on-surface-variant)" }} />
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--on-surface)" }}>No files match</p>
            <p style={{ fontSize: 11, marginTop: 4, color: "var(--on-surface-variant)" }}>Try a different search or filter</p>
          </div>
        ) : (
          treeKeys.map((k) => (
            <TreeNode key={k} name={k} node={tree[k]} depth={0} searchActive={!!search} />
          ))
        )}
      </div>

      {/* Footer stats */}
      <div
        style={{
          display: "flex",
          gap: 16,
          padding: "8px 16px",
          borderTop: "1px solid var(--outline-variant)",
          background: "var(--surface-low)",
          flexShrink: 0,
        }}
      >
        {[
          { label: "Showing", val: filteredFiles.length },
          { label: "Languages", val: languages.length },
          { label: "Chunks", val: (data?.files ?? []).reduce((s, f) => s + f.chunk_count, 0) },
        ].map(({ label, val }) => (
          <div key={label} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--on-surface-variant)", opacity: 0.6 }}>{label}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--on-surface)" }}>{val.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
