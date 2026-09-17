"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
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
  Plus,
  Flame,
  ShieldAlert,
  CheckCircle2,
  Sparkles
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { sileo } from "sileo";

interface Repo {
  id: string;
  github_url: string;
  name: string;
  owner: string;
  analysis_status: "queued" | "running" | "complete" | "failed";
  created_at: string;
}

export default function DashboardPage() {
  const { user, isLoading: authLoading } = useAuth();
  const params = useParams();
  const router = useRouter();
  const urlUserId = params?.userId as string;

  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingRepoId, setDeletingRepoId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [githubConnected, setGithubConnected] = useState<boolean | null>(null);
  const [rateLimitCooldown, setRateLimitCooldown] = useState<number>(0);

  // Live countdown timer for rate limit cooldown
  useEffect(() => {
    if (rateLimitCooldown <= 0) return;
    const timer = setInterval(() => {
      setRateLimitCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [rateLimitCooldown]);

  // Redirect if userId doesn't match authenticated user
  useEffect(() => {
    if (!authLoading && user && urlUserId && user.id !== urlUserId) {
      router.replace(`/dashboard/${user.id}`);
    }
  }, [authLoading, user, urlUserId, router]);

  const fetchRepos = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/repos", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setRepos(data);
      } else {
        const errData = await res.json().catch(() => ({}));
        console.error("API error:", res.status, errData);
        setErrorMsg(`Error ${res.status}: ${errData.error || errData.detail || "Failed to fetch"}`);
      }
    } catch (err: any) {
      console.error("Network error:", err);
      setErrorMsg(err.message || "Network error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user) {
      fetchRepos();
      fetch("/api/github/status", { cache: "no-store" })
        .then(r => r.json())
        .then(d => setGithubConnected(d.connected === true))
        .catch(() => setGithubConnected(false));
    }
  }, [authLoading, user]);

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

  if (!authLoading && user && urlUserId && user.id !== urlUserId) {
    return null;
  }

  return (
    <div className="min-h-screen p-6 md:p-10 max-w-7xl mx-auto space-y-8">
      {/* Injected Fire & Heat Animations */}
      <style>{`
        @keyframes rh-fireGlow {
          0%, 100% {
            box-shadow: 0 0 20px rgba(249, 115, 22, 0.35), 0 0 45px rgba(239, 68, 68, 0.2), inset 0 0 15px rgba(245, 158, 11, 0.1);
            border-color: rgba(249, 115, 22, 0.55);
          }
          50% {
            box-shadow: 0 0 35px rgba(249, 115, 22, 0.6), 0 0 70px rgba(239, 68, 68, 0.35), inset 0 0 25px rgba(245, 158, 11, 0.2);
            border-color: rgba(239, 68, 68, 0.85);
          }
        }
        @keyframes rh-fireFlicker {
          0%, 100% {
            transform: scale(1) rotate(-1deg);
            filter: drop-shadow(0 0 6px #f97316) drop-shadow(0 0 12px #ef4444);
          }
          25% {
            transform: scale(1.1) rotate(1.5deg);
            filter: drop-shadow(0 0 10px #f59e0b) drop-shadow(0 0 18px #dc2626);
          }
          50% {
            transform: scale(0.95) rotate(-2deg);
            filter: drop-shadow(0 0 7px #ea580c) drop-shadow(0 0 14px #ef4444);
          }
          75% {
            transform: scale(1.08) rotate(2deg);
            filter: drop-shadow(0 0 12px #f97316) drop-shadow(0 0 20px #b91c1c);
          }
        }
        @keyframes rh-emberRise {
          0% {
            transform: translateY(0) translateX(0) scale(1);
            opacity: 0.95;
          }
          50% {
            transform: translateY(-26px) translateX(6px) scale(0.85);
            opacity: 0.7;
          }
          100% {
            transform: translateY(-56px) translateX(-4px) scale(0.2);
            opacity: 0;
          }
        }
        @keyframes rh-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

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

        <div className="flex items-center gap-3 self-start md:self-auto flex-wrap">
          {/* Fire Animation / Rate Limit Test Trigger */}
          <button
            onClick={() => {
              if (rateLimitCooldown > 0) {
                setRateLimitCooldown(0);
                sileo.success({
                  title: "System Cooled Down",
                  description: "Rate limit restriction lifted. Ready for analysis.",
                });
              } else {
                setRateLimitCooldown(60);
                sileo.warning({
                  title: "Rate Limit Triggered (429)",
                  description: "Simulating 60s cooldown with fire animation.",
                });
              }
            }}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer"
            style={{
              background: rateLimitCooldown > 0
                ? "rgba(239, 68, 68, 0.15)"
                : "rgba(249, 115, 22, 0.08)",
              borderColor: rateLimitCooldown > 0
                ? "rgba(239, 68, 68, 0.45)"
                : "rgba(249, 115, 22, 0.3)",
              color: rateLimitCooldown > 0 ? "#f87171" : "#fb923c",
              boxShadow: rateLimitCooldown > 0 ? "0 0 14px rgba(239, 68, 68, 0.3)" : "none",
            }}
            title="Toggle rate limit cooldown fire animation"
          >
            <Flame
              size={14}
              style={{
                color: rateLimitCooldown > 0 ? "#ef4444" : "#f97316",
                animation: rateLimitCooldown > 0 ? "rh-fireFlicker 1.2s infinite ease-in-out" : "none",
              }}
            />
            {rateLimitCooldown > 0 ? "Cool Down" : "Fire Test"}
          </button>

          <button
            onClick={fetchRepos}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl text-on-surface-variant border border-outline-variant hover-surface transition-all cursor-pointer"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>

          <a
            href="https://github.com/apps/repohawk/installations/new"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer"
            style={{
              background: githubConnected === true
                ? "color-mix(in srgb, #10b981 10%, transparent)"
                : "transparent",
              color: githubConnected === true ? "#10b981" : "var(--on-surface-variant)",
              border: githubConnected === true
                ? "1px solid color-mix(in srgb, #10b981 30%, transparent)"
                : "1px solid var(--outline-variant)",
            }}
          >
            {githubConnected === null ? (
              <div className="w-3 h-3 border-2 rounded-full animate-spin" style={{ borderColor: "color-mix(in srgb, var(--on-surface) 20%, transparent)", borderTopColor: "var(--on-surface)" }} />
            ) : githubConnected === true ? (
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#10b981" }} />
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
              </svg>
            )}
            {githubConnected === true ? "Connected" : "Connect GitHub"}
          </a>

          {/* New Repo button — throttles when rate limited */}
          {rateLimitCooldown > 0 ? (
            <button
              onClick={() => {
                sileo.warning({
                  title: "Rate Limit Active",
                  description: `Please wait ${rateLimitCooldown}s for worker cooldown before analyzing new repos.`,
                });
              }}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl text-yellow-300 border border-amber-500/40 cursor-not-allowed transition-all"
              style={{
                background: "linear-gradient(135deg, rgba(239, 68, 68, 0.25), rgba(249, 115, 22, 0.2))",
                boxShadow: "0 0 12px rgba(249, 115, 22, 0.3)",
              }}
              title={`Rate limit active: ${rateLimitCooldown}s remaining`}
            >
              <Flame size={13} style={{ color: "#f97316", animation: "rh-fireFlicker 1.2s infinite ease-in-out" }} />
              <span>Cooling ({rateLimitCooldown}s)</span>
            </button>
          ) : (
            <Link
              href={`/new-repo/${user?.id || ""}`}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl text-on-primary bg-primary-accent hover:opacity-90 transition-all cursor-pointer"
            >
              <Plus size={13} />
              New Repo
            </Link>
          )}
        </div>
      </div>

      {/* ── Rate Limit Overheat Fire Banner with Ember Animation ── */}
      {rateLimitCooldown > 0 && (
        <div
          style={{
            position: "relative",
            borderRadius: 20,
            padding: "20px 24px",
            background: "radial-gradient(ellipse at 50% -20%, rgba(239, 68, 68, 0.26), rgba(249, 115, 22, 0.12), rgba(20, 20, 26, 0.9))",
            border: "1px solid rgba(249, 115, 22, 0.6)",
            animation: "rh-fireGlow 2.5s infinite ease-in-out",
            overflow: "hidden",
            backdropFilter: "blur(14px)",
          }}
        >
          {/* Floating Animated Fire Embers */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              overflow: "hidden",
              borderRadius: "inherit",
            }}
          >
            {[
              { left: "7%", delay: "0s", dur: "2.2s", size: 4, bg: "#fde047" },
              { left: "21%", delay: "0.7s", dur: "2.5s", size: 3, bg: "#fb923c" },
              { left: "36%", delay: "1.4s", dur: "1.9s", size: 5, bg: "#ef4444" },
              { left: "52%", delay: "0.3s", dur: "2.4s", size: 4, bg: "#f59e0b" },
              { left: "68%", delay: "1.1s", dur: "2.7s", size: 3, bg: "#fde047" },
              { left: "81%", delay: "0.5s", dur: "2.1s", size: 5, bg: "#fb923c" },
              { left: "93%", delay: "1.5s", dur: "2.3s", size: 4, bg: "#ef4444" },
            ].map((ember, i) => (
              <span
                key={i}
                style={{
                  position: "absolute",
                  bottom: "6px",
                  left: ember.left,
                  width: ember.size,
                  height: ember.size,
                  borderRadius: "50%",
                  background: ember.bg,
                  boxShadow: `0 0 8px ${ember.bg}, 0 0 16px ${ember.bg}`,
                  animation: `rh-emberRise ${ember.dur} infinite ease-out`,
                  animationDelay: ember.delay,
                }}
              />
            ))}
          </div>

          {/* Content Row */}
          <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                {/* Flame Icon with burning flicker */}
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    background: "linear-gradient(135deg, rgba(239, 68, 68, 0.3), rgba(249, 115, 22, 0.2))",
                    border: "1px solid rgba(249, 115, 22, 0.5)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 0 20px rgba(249, 115, 22, 0.4)",
                    flexShrink: 0,
                  }}
                >
                  <Flame
                    size={24}
                    style={{
                      color: "#f97316",
                      animation: "rh-fireFlicker 1.4s infinite ease-in-out",
                    }}
                  />
                </div>

                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <h3
                      style={{
                        fontSize: 16,
                        fontWeight: 800,
                        letterSpacing: "-0.01em",
                        background: "linear-gradient(90deg, #fde047, #f97316, #ef4444)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        margin: 0,
                      }}
                    >
                      Rate Limit Cooldown Active — System Hot
                    </h3>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        textTransform: "uppercase",
                        letterSpacing: "0.1em",
                        padding: "2px 8px",
                        borderRadius: 20,
                        background: "rgba(239, 68, 68, 0.25)",
                        border: "1px solid rgba(239, 68, 68, 0.5)",
                        color: "#fca5a5",
                      }}
                    >
                      HTTP 429 Throttle
                    </span>
                  </div>
                  <p style={{ fontSize: 12, color: "var(--on-surface-variant)", margin: "4px 0 0", opacity: 0.9 }}>
                    Hourly analysis quota reached (5 repos / hour limit). Redis sliding-window queue is cooling down worker processes to preserve server memory.
                  </p>
                </div>
              </div>

              {/* Live Countdown Badge and Controls */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    padding: "6px 14px",
                    borderRadius: 24,
                    background: "rgba(239, 68, 68, 0.2)",
                    border: "1px solid rgba(249, 115, 22, 0.5)",
                    color: "#fbbf24",
                    fontFamily: "monospace",
                    fontSize: 13,
                    fontWeight: 800,
                    boxShadow: "0 0 15px rgba(249, 115, 22, 0.25)",
                  }}
                >
                  <Clock size={13} style={{ animation: "rh-spin 3s linear infinite" }} />
                  <span>{rateLimitCooldown}s remaining</span>
                </div>

                <button
                  onClick={() => {
                    setRateLimitCooldown(0);
                    sileo.success({
                      title: "System Cooled Down",
                      description: "Rate limit lifted manually.",
                    });
                  }}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 10,
                    background: "rgba(255, 255, 255, 0.08)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--on-surface)",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  Cool Down Now
                </button>
              </div>
            </div>

            {/* Fiery Animated Progress Bar */}
            <div
              style={{
                width: "100%",
                height: 6,
                borderRadius: 3,
                background: "rgba(255, 255, 255, 0.08)",
                overflow: "hidden",
                position: "relative",
                boxShadow: "inset 0 1px 2px rgba(0,0,0,0.5)",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${Math.max(0, Math.min(100, (rateLimitCooldown / 60) * 100))}%`,
                  background: "linear-gradient(90deg, #ef4444, #f97316, #fde047)",
                  borderRadius: 3,
                  boxShadow: "0 0 10px #f97316, 0 0 20px #ef4444",
                  transition: "width 1s linear",
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      {!loading && repos.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-5 rounded-2xl border border-outline-variant bg-surface-low flex flex-col justify-center">
            <p className="text-xs uppercase font-bold tracking-widest text-on-surface-variant opacity-70 mb-1.5">Total Indexed</p>
            <p className="text-3xl font-extrabold text-on-surface">{repos.length}</p>
          </div>
          <div className="p-5 rounded-2xl border border-outline-variant bg-surface-low flex flex-col justify-center">
            <p className="text-xs uppercase font-bold tracking-widest text-on-surface-variant opacity-70 mb-1.5">Successfully Analyzed</p>
            <p className="text-3xl font-extrabold" style={{ color: "#10b981" }}>
              {repos.filter(r => r.analysis_status === "complete").length}
            </p>
          </div>
          <div className="p-5 rounded-2xl border border-outline-variant bg-surface-low flex flex-col justify-center">
            <p className="text-xs uppercase font-bold tracking-widest text-on-surface-variant opacity-70 mb-1.5">Pending / Failed</p>
            <p className="text-3xl font-extrabold" style={{ color: "#f59e0b" }}>
              {repos.filter(r => r.analysis_status === "queued" || r.analysis_status === "running" || r.analysis_status === "failed").length}
            </p>
          </div>
        </div>
      )}

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

        ) : errorMsg ? (
          /* Error state */
          <div className="flex flex-col items-center justify-center py-24 px-8 rounded-3xl border-2 border-dashed border-rose-500/50 bg-rose-500/5 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-rose-500/10">
              <AlertCircle className="w-6 h-6 text-rose-500" />
            </div>
            <div>
              <p className="text-on-surface font-bold text-base">Failed to load repositories</p>
              <p className="text-rose-500 text-xs mt-1.5 max-w-xs mx-auto leading-relaxed font-mono">
                {errorMsg}
              </p>
            </div>
            <button
              onClick={fetchRepos}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-rose-500 hover:bg-rose-600 transition-all mt-2 cursor-pointer"
            >
              <RefreshCw size={13} /> Try Again
            </button>
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
                href={`/new-repo/${user?.id || ""}`}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-on-primary bg-primary-accent hover:opacity-90 transition-all mt-2 cursor-pointer"
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
