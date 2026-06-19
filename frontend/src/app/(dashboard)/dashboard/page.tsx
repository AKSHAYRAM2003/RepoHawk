"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  GitBranch, 
  Search, 
  ExternalLink, 
  RefreshCw, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  Trash2,
  Plus
} from "lucide-react";
import Link from "next/link";

interface Repo {
  id: string;
  github_url: string;
  name: string;
  owner: string;
  analysis_status: "queued" | "running" | "complete" | "failed";
  created_at: string;
}

export default function DashboardPage() {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingRepoId, setDeletingRepoId] = useState<string | null>(null);
  const router = useRouter();

  const fetchRepos = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/repos");
      if (res.ok) {
        const data = await res.json();
        setRepos(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRepos();
  }, []);

  const performDelete = async (repoId: string) => {
    try {
      const res = await fetch(`/api/repos/${repoId}`, { method: "DELETE" });
      if (res.ok) {
        setDeletingRepoId(null);
        fetchRepos();
      } else {
        alert("Failed to delete repository.");
      }
    } catch (err) {
      console.error(err);
      alert("Error deleting repository.");
    }
  };

  const filteredRepos = repos.filter(repo => {
    if (!repo) return false;
    const name = repo.name || "";
    const owner = repo.owner || "";
    const githubUrl = repo.github_url || "";
    const query = searchQuery.toLowerCase();
    return (
      name.toLowerCase().includes(query) ||
      owner.toLowerCase().includes(query) ||
      githubUrl.toLowerCase().includes(query)
    );
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "complete":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
            style={{ background: "color-mix(in srgb, #10b981 12%, transparent)", color: "#10b981", border: "1px solid color-mix(in srgb, #10b981 25%, transparent)" }}>
            <CheckCircle size={11} /> Complete
          </span>
        );
      case "running":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold animate-pulse"
            style={{ background: "color-mix(in srgb, var(--primary) 12%, transparent)", color: "var(--primary)", border: "1px solid color-mix(in srgb, var(--primary) 25%, transparent)" }}>
            <Loader2 size={11} className="animate-spin" /> Analyzing
          </span>
        );
      case "queued":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
            style={{ background: "color-mix(in srgb, #f59e0b 12%, transparent)", color: "#f59e0b", border: "1px solid color-mix(in srgb, #f59e0b 25%, transparent)" }}>
            <Clock size={11} /> Queued
          </span>
        );
      case "failed":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
            style={{ background: "color-mix(in srgb, #f43f5e 12%, transparent)", color: "#f43f5e", border: "1px solid color-mix(in srgb, #f43f5e 25%, transparent)" }}>
            <AlertCircle size={11} /> Failed
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen p-6 md:p-10 max-w-7xl mx-auto space-y-10">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-outline-variant">
        <div>
          <p className="text-[11px] uppercase font-bold tracking-[0.12em] text-on-surface-variant opacity-60 mb-1">
            Workspace
          </p>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-on-surface">
            My Repositories
          </h1>
          <p className="text-on-surface-variant mt-1.5 text-sm">
            Manage and explore architecture maps of your indexed codebases.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto">
          <button
            onClick={fetchRepos}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl text-on-surface-variant border border-outline-variant hover-surface transition-all cursor-pointer"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
          <Link
            href="/new-repo"
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl text-on-primary bg-primary-accent hover:opacity-90 transition-all"
          >
            <Plus size={13} />
            New Repo
          </Link>
        </div>
      </div>

      {/* Repositories list */}
      <div className="w-full space-y-6">

        {/* Search bar */}
        <div className="relative max-w-sm">
          <Search
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant"
            size={15}
          />
          <input
            type="text"
            placeholder="Search repositories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface-low border border-outline-variant rounded-xl pl-10 pr-4 py-2.5 text-sm text-on-surface placeholder-on-surface-variant/60 outline-none focus:border-primary-color transition-colors"
          />
        </div>

        {/* Loading state */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-10 h-10 border-2 rounded-full animate-spin" style={{ borderColor: "color-mix(in srgb, var(--primary) 25%, transparent)", borderTopColor: "var(--primary)" }} />
            <p className="text-on-surface-variant text-sm font-medium">Loading repositories...</p>
          </div>

        ) : filteredRepos.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-24 px-8 rounded-3xl border-2 border-dashed border-outline-variant bg-surface-low text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "color-mix(in srgb, var(--on-surface) 6%, transparent)" }}>
              <GitBranch className="w-6 h-6 text-on-surface-variant" />
            </div>
            <div>
              <p className="text-on-surface font-bold text-base">No repositories found</p>
              <p className="text-on-surface-variant text-xs mt-1.5 max-w-xs mx-auto leading-relaxed">
                {searchQuery
                  ? `No results for "${searchQuery}". Try a different search.`
                  : 'Submit a GitHub URL via "New Repo" to create your first workspace.'
                }
              </p>
            </div>
            {!searchQuery && (
              <Link
                href="/new-repo"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-on-primary bg-primary-accent hover:opacity-90 transition-all mt-2"
              >
                <Plus size={13} /> Add Repository
              </Link>
            )}
          </div>

        ) : (
          /* Repo cards grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRepos.map((repo) => (
              <div
                key={repo.id}
                onClick={() => router.push(`/repo/${repo.id}`)}
                className="group relative p-5 rounded-2xl border border-outline-variant bg-surface-low hover:bg-surface-mid cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
              >
                {/* Status indicator line */}
                <div
                  className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl transition-all"
                  style={{
                    background: repo.analysis_status === "complete"
                      ? "#10b981"
                      : repo.analysis_status === "running"
                        ? "var(--primary)"
                        : repo.analysis_status === "queued"
                          ? "#f59e0b"
                          : "#f43f5e",
                    opacity: 0.7,
                  }}
                />

                <div className="flex justify-between items-start gap-3 mb-4">
                  <div className="space-y-1 min-w-0 flex-1">
                    <h3 className="font-bold text-on-surface text-base group-hover:text-primary-color transition-colors truncate">
                      {repo.name || repo.github_url?.split("/").pop() || "Untitled"}
                    </h3>
                    <p className="text-on-surface-variant text-xs font-medium truncate">
                      {repo.owner || "Unknown"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {getStatusBadge(repo.analysis_status)}

                    {deletingRepoId === repo.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeletingRepoId(null); }}
                          className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-outline-variant text-on-surface-variant hover-surface transition-all cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); performDelete(repo.id); }}
                          className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-rose-500 hover:bg-rose-600 text-white transition-all cursor-pointer"
                        >
                          Delete
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeletingRepoId(repo.id); }}
                        className="p-1.5 rounded-lg text-on-surface-variant opacity-0 group-hover:opacity-100 hover:text-rose-500 hover:bg-rose-500/10 transition-all cursor-pointer"
                        title="Delete Repository"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-on-surface-variant mt-4 pt-3 border-t border-outline-variant">
                  <span className="flex items-center gap-1.5">
                    <Clock size={11} />
                    {repo.created_at
                      ? new Date(repo.created_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "N/A"}
                  </span>

                  <span className="flex items-center gap-1 opacity-0 group-hover:opacity-100 text-primary-color transition-opacity font-semibold">
                    Open <ExternalLink size={10} />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
