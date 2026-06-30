"use client";

import React, { useState, useEffect, useMemo } from "react";
import { PackageCheck, RefreshCw, AlertCircle, Search, X, Package, ExternalLink } from "lucide-react";
import DependencyCanvas from "@/components/dashboard/DependencyCanvas";

interface Dep {
  name: string;
  version: string;
  type: "runtime" | "dev" | "peer" | "indirect" | string;
}

interface Manifest {
  file: string;
  ecosystem: string;
  name?: string;
  version?: string;
  dependencies: Dep[];
}

const ECOSYSTEM_META: Record<string, { label: string; color: string; bg: string; registryUrl: (name: string) => string }> = {
  npm:  { label: "npm",    color: "#f59e0b", bg: "rgba(245,158,11,0.1)",  registryUrl: (n) => `https://www.npmjs.com/package/${n}` },
  pip:  { label: "PyPI",   color: "#3b82f6", bg: "rgba(59,130,246,0.1)",  registryUrl: (n) => `https://pypi.org/project/${n}` },
  go:   { label: "Go",     color: "#06b6d4", bg: "rgba(6,182,212,0.1)",   registryUrl: (n) => `https://pkg.go.dev/${n}` },
};

const TYPE_META: Record<string, { label: string; color: string; bg: string }> = {
  runtime:  { label: "Runtime",  color: "#10b981", bg: "rgba(16,185,129,0.1)" },
  dev:      { label: "Dev",      color: "#6366f1", bg: "rgba(99,102,241,0.1)" },
  peer:     { label: "Peer",     color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  indirect: { label: "Indirect", color: "#64748b", bg: "rgba(100,116,139,0.1)" },
};

function DepRow({ dep, ecosystem }: { dep: Dep; ecosystem: string }) {
  const typeMeta = TYPE_META[dep.type] ?? TYPE_META.runtime;
  const ecoMeta = ECOSYSTEM_META[ecosystem];
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "7px 14px",
        borderBottom: "1px solid color-mix(in srgb, var(--on-surface) 5%, transparent)",
        transition: "background 0.1s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "color-mix(in srgb, var(--on-surface) 4%, transparent)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <Package size={12} style={{ color: "var(--on-surface-variant)", flexShrink: 0 }} />

      <span
        style={{
          flex: 1,
          fontSize: 12,
          fontWeight: 600,
          fontFamily: "monospace",
          color: "var(--on-surface)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {dep.name}
      </span>

      {dep.version && (
        <span
          style={{
            fontSize: 10,
            fontFamily: "monospace",
            color: "var(--on-surface-variant)",
            background: "color-mix(in srgb, var(--on-surface) 6%, transparent)",
            border: "1px solid var(--outline-variant)",
            borderRadius: 5,
            padding: "1px 6px",
            flexShrink: 0,
            whiteSpace: "nowrap",
          }}
        >
          {dep.version}
        </span>
      )}

      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          padding: "1px 6px",
          borderRadius: 5,
          background: typeMeta.bg,
          color: typeMeta.color,
          border: `1px solid ${typeMeta.color}30`,
          flexShrink: 0,
        }}
      >
        {typeMeta.label}
      </span>

      {ecoMeta && (
        <a
          href={ecoMeta.registryUrl(dep.name)}
          target="_blank"
          rel="noopener noreferrer"
          title={`View on ${ecoMeta.label}`}
          style={{ color: "var(--on-surface-variant)", opacity: 0.4, flexShrink: 0, display: "flex", alignItems: "center" }}
          onClick={(e) => e.stopPropagation()}
          onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.opacity = "1"; (e.currentTarget as HTMLAnchorElement).style.color = "var(--on-surface)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.opacity = "0.4"; (e.currentTarget as HTMLAnchorElement).style.color = "var(--on-surface-variant)"; }}
        >
          <ExternalLink size={11} />
        </a>
      )}
    </div>
  );
}

function ManifestSection({ manifest, search }: { manifest: Manifest; search: string }) {
  const [open, setOpen] = useState(true);
  const ecoMeta = ECOSYSTEM_META[manifest.ecosystem] ?? { label: manifest.ecosystem, color: "#94a3b8", bg: "rgba(148,163,184,0.1)" };

  const filteredDeps = useMemo(
    () =>
      search
        ? manifest.dependencies.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()))
        : manifest.dependencies,
    [manifest.dependencies, search]
  );

  const typeSummary = useMemo(() => {
    const m: Record<string, number> = {};
    manifest.dependencies.forEach((d) => {
      m[d.type] = (m[d.type] ?? 0) + 1;
    });
    return m;
  }, [manifest.dependencies]);

  return (
    <div
      style={{
        border: "1px solid var(--outline-variant)",
        borderRadius: 14,
        overflow: "hidden",
        marginBottom: 16,
        background: "color-mix(in srgb, var(--on-surface) 2%, transparent)",
      }}
    >
      {/* Section header */}
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 16px",
          background: "color-mix(in srgb, var(--on-surface) 3%, transparent)",
          border: "none",
          borderBottom: open ? "1px solid var(--outline-variant)" : "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div
          style={{
            padding: "3px 10px",
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 700,
            background: ecoMeta.bg,
            color: ecoMeta.color,
            border: `1px solid ${ecoMeta.color}40`,
            flexShrink: 0,
          }}
        >
          {ecoMeta.label}
        </div>

        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--on-surface)", fontFamily: "monospace" }}>
            {manifest.file}
          </p>
          {manifest.name && (
            <p style={{ fontSize: 11, color: "var(--on-surface-variant)", marginTop: 1 }}>
              {manifest.name} {manifest.version ? `v${manifest.version}` : ""}
            </p>
          )}
        </div>

        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {Object.entries(typeSummary).map(([type, count]) => {
            const tm = TYPE_META[type] ?? TYPE_META.runtime;
            return (
              <span
                key={type}
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "2px 7px",
                  borderRadius: 20,
                  background: tm.bg,
                  color: tm.color,
                }}
              >
                {count} {tm.label}
              </span>
            );
          })}
        </div>

        <span style={{ fontSize: 10, color: "var(--on-surface-variant)", marginLeft: 4, opacity: 0.5 }}>
          {open ? "▲" : "▼"}
        </span>
      </button>

      {/* Deps list */}
      {open && (
        <div>
          {filteredDeps.length === 0 ? (
            <p style={{ padding: "16px", fontSize: 12, color: "var(--on-surface-variant)", textAlign: "center" }}>
              No dependencies match your search.
            </p>
          ) : (
            filteredDeps.map((dep) => (
              <DepRow key={dep.name + dep.type} dep={dep} ecosystem={manifest.ecosystem} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function DependenciesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const [data, setData] = useState<{ manifests: Manifest[]; status: string; total_manifests: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "graph">("list");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/repos/${id}/dependencies`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => setData(d))
      .catch(() => setError("Failed to load dependencies."))
      .finally(() => setLoading(false));
  }, [id]);

  const totalDeps = useMemo(
    () => (data?.manifests ?? []).reduce((s, m) => s + m.dependencies.length, 0),
    [data]
  );

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <RefreshCw className="w-6 h-6 animate-spin text-primary-color" />
        <span className="ml-3 text-sm text-on-surface-variant">Scanning manifests…</span>
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

  if (data?.status === "clone_missing" || data?.status === "no_manifests_found") {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-8 text-center">
        <PackageCheck className="w-10 h-10 opacity-30 text-on-surface-variant" />
        <p className="text-sm font-semibold text-on-surface">No manifest files found</p>
        <p className="text-xs text-on-surface-variant max-w-xs leading-relaxed">
          {data?.status === "clone_missing"
            ? "The cloned repo is no longer on disk. Re-run the analysis to restore it."
            : "This repo doesn't have a package.json, requirements.txt, pyproject.toml, or go.mod file in its root."}
        </p>
      </div>
    );
  }

  if (data?.status !== "complete") {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-8 text-center">
        <PackageCheck className="w-10 h-10 opacity-30 text-on-surface-variant" />
        <p className="text-sm font-semibold text-on-surface">Analysis in progress</p>
        <p className="text-xs text-on-surface-variant max-w-xs">
          Dependencies will be shown once the analysis completes.
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
              background: "rgba(16,185,129,0.12)",
              color: "#10b981",
            }}
          >
            <PackageCheck size={16} />
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--on-surface)" }}>Dependencies</p>
            <p style={{ fontSize: 11, color: "var(--on-surface-variant)" }}>
              {totalDeps} packages across {data?.total_manifests} manifest{data?.total_manifests !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {/* View toggle & Search */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, justifyContent: "flex-end" }}>
          {/* Segmented control for List / Graph */}
          <div
            style={{
              display: "flex",
              background: "color-mix(in srgb, var(--on-surface) 6%, transparent)",
              padding: 3,
              borderRadius: 8,
              gap: 2,
            }}
          >
            <button
              onClick={() => setViewMode("list")}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
                border: "none",
                background: viewMode === "list" ? "var(--surface)" : "transparent",
                color: viewMode === "list" ? "var(--on-surface)" : "var(--on-surface-variant)",
                transition: "all 0.12s",
              }}
            >
              List
            </button>
            <button
              onClick={() => setViewMode("graph")}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
                border: "none",
                background: viewMode === "graph" ? "var(--surface)" : "transparent",
                color: viewMode === "graph" ? "var(--on-surface)" : "var(--on-surface-variant)",
                transition: "all 0.12s",
              }}
            >
              Graph
            </button>
          </div>

        <div style={{ position: "relative", flex: 1, maxWidth: 280 }}>
          <Search
            size={12}
            style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#475569", pointerEvents: "none" }}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search packages…"
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
            onFocus={(e) => (e.target.style.borderColor = "rgba(16,185,129,0.5)")}
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
      </div>

      {/* Manifests List or Graph */}
      {viewMode === "graph" ? (
        <div style={{ flex: 1, minHeight: 0 }}>
          <DependencyCanvas
            manifests={data?.manifests || []}
            search={search}
            repoId={id}
          />
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: "auto", padding: "16px", scrollbarWidth: "thin", scrollbarColor: "rgba(16,185,129,0.2) transparent" }}>
          {(data?.manifests ?? []).map((manifest) => (
            <ManifestSection key={manifest.file} manifest={manifest} search={search} />
          ))}
        </div>
      )}

      {/* Footer */}
      <div
        style={{
          display: "flex",
          gap: 20,
          padding: "8px 20px",
          borderTop: "1px solid var(--outline-variant)",
          background: "var(--surface-low)",
          flexShrink: 0,
        }}
      >
        {Object.values(TYPE_META).map(({ label, color, bg }) => {
          const count = (data?.manifests ?? [])
            .flatMap((m) => m.dependencies)
            .filter((d) => d.type === label.toLowerCase()).length;
          return (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: "var(--on-surface-variant)" }}>{label}: <strong style={{ color: "var(--on-surface)" }}>{count}</strong></span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
