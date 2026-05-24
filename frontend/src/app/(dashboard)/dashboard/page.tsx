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
  Trash2
} from "lucide-react";

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
      const res = await fetch(`/api/repos/${repoId}`, {
        method: "DELETE"
      });
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
    return name.toLowerCase().includes(query) ||
           owner.toLowerCase().includes(query) ||
           githubUrl.toLowerCase().includes(query);
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "complete":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle size={12} />
            Complete
          </span>
        );
      case "running":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse">
            <Loader2 size={12} className="animate-spin" />
            Analyzing
          </span>
        );
      case "queued":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock size={12} />
            Queued
          </span>
        );
      case "failed":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertCircle size={12} />
            Failed
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen p-8 max-w-7xl mx-auto space-y-10">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 via-slate-700 to-slate-500 dark:from-white dark:via-slate-200 dark:to-slate-400 bg-clip-text text-transparent">
            Workspace
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2 text-sm font-medium">
            Manage and view architecture maps of your codebase repositories.
          </p>
        </div>
        
        {/* Refresh button */}
        <button 
          onClick={fetchRepos}
          disabled={loading}
          className="self-start md:self-auto flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-white hover:bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white active:scale-95 transition-all cursor-pointer shadow-sm"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Repositories List (Full Width) */}
      <div className="w-full space-y-6">
        
        {/* Search bar */}
        <div className="relative max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={16} />
          <input 
            type="text" 
            placeholder="Search repositories..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-100/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl pl-11 pr-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-slate-350 dark:focus:border-slate-700 transition-colors"
          />
        </div>

        {/* List/Grid of Repos */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 size={32} className="animate-spin text-blue-500" />
            <p className="text-slate-500 dark:text-slate-400 text-sm">Loading repositories...</p>
          </div>
        ) : filteredRepos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-8 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/10 text-center space-y-4">
            <GitBranch className="w-12 h-12 text-slate-400 dark:text-slate-600" />
            <div>
              <p className="text-slate-800 dark:text-slate-250 font-bold">No repositories found</p>
              <p className="text-slate-550 dark:text-slate-400 text-xs mt-1">Submit a GitHub URL via "New Repo" in the sidebar to create your first workspace.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRepos.map((repo) => (
              <div 
                key={repo.id}
                onClick={() => router.push(`/repo/${repo.id}`)}
                className="group relative p-5 rounded-2xl bg-white dark:bg-slate-900/30 hover:bg-slate-50 dark:hover:bg-slate-900/50 border border-slate-250/80 dark:border-slate-800/80 hover:border-slate-350 dark:hover:border-slate-700/80 shadow-sm hover:shadow-md dark:shadow-lg cursor-pointer transition-all duration-200 active:scale-99 hover:-translate-y-1"
              >
                <div className="flex justify-between items-start gap-4 mb-4">
                  <div className="space-y-1 min-w-0 flex-1">
                    <h3 className="font-bold text-slate-900 dark:text-white text-lg group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                      {repo.name || repo.github_url?.split("/").pop() || "Untitled"}
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold truncate">
                      {repo.owner || "Unknown"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {getStatusBadge(repo.analysis_status)}
                    {deletingRepoId === repo.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setDeletingRepoId(null);
                          }}
                          className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-all cursor-pointer border border-slate-200 dark:border-slate-700"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            performDelete(repo.id);
                          }}
                          className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-rose-500 hover:bg-rose-600 text-white transition-all cursor-pointer border border-rose-600"
                        >
                          Delete
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDeletingRepoId(repo.id);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-500/10 dark:hover:bg-rose-500/20 transition-all cursor-pointer"
                        title="Delete Repository"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-500 mt-6 pt-3 border-t border-slate-100 dark:border-slate-800/50">
                  <span className="flex items-center gap-1.5">
                    <Clock size={12} />
                    {repo.created_at ? new Date(repo.created_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric"
                    }) : "N/A"}
                  </span>
                  
                  <span className="flex items-center gap-1 opacity-0 group-hover:opacity-100 text-blue-500 dark:text-blue-400 transition-opacity font-semibold">
                    Open
                    <ExternalLink size={10} />
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
