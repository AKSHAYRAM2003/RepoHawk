"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, GitBranch, ShieldAlert } from "lucide-react";

export default function NewRepoPage() {
  const [repoUrl, setRepoUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl.trim() || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/repos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ github_url: repoUrl }),
      });
      if (!res.ok) throw new Error("Failed to start analysis");
      const data = await res.json();
      router.push(`/repo/${data.id}`);
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen p-8 max-w-4xl mx-auto flex items-center justify-center">
      <div className="w-full max-w-xl p-8 rounded-3xl bg-white dark:bg-slate-900/40 backdrop-blur-md border border-slate-200 dark:border-slate-800/80 shadow-xl dark:shadow-2xl flex flex-col gap-8">
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center text-blue-500 dark:text-blue-400">
            <GitBranch size={24} />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 via-slate-700 to-slate-500 dark:from-white dark:via-slate-200 dark:to-slate-400 bg-clip-text text-transparent">
            Analyze Codebase
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            Enter a public GitHub URL to map and analyze its codebase structure.
          </p>
        </div>

        {error && (
          <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 text-sm text-rose-500 dark:text-rose-400 flex items-start gap-2">
            <ShieldAlert size={16} className="mt-0.5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleAnalyze} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-350 tracking-wide uppercase">GitHub Repository URL</label>
            <input 
              type="url" 
              required
              placeholder="https://github.com/owner/repository" 
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 outline-none focus:border-blue-500 transition-colors shadow-inner"
            />
          </div>

          <button 
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-600 to-emerald-600 hover:opacity-90 active:scale-98 transition-all disabled:opacity-50 cursor-pointer shadow-lg shadow-blue-900/20"
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Initializing Pipeline...
              </>
            ) : (
              <>
                <Plus size={16} />
                Run Codebase Analysis
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
