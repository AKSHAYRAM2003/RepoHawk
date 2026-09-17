"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Activity,
  Cpu,
  HardDrive,
  Database,
  Clock,
  Zap,
  DollarSign,
  Layers,
  ShieldCheck,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Search,
  Filter,
  Sparkles,
  Server,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Target,
  FileCode,
  Gauge
} from "lucide-react";
import { sileo } from "sileo";

interface OverviewMetrics {
  ai: {
    total_queries: number;
    total_tokens: number;
    tokens_in: number;
    tokens_out: number;
    estimated_cost_usd: number;
    avg_latency_ms: number;
    avg_retrieval_ms: number;
    avg_llm_ms: number;
    chunks_retrieved: number;
    chunks_kept: number;
    retrieval_efficiency_percent: number;
    highlight_accuracy_percent: number;
    error_count: number;
  };
  pipeline: {
    total_repos: number;
    completed_repos: number;
    failed_repos: number;
    active_repos: number;
    success_rate_percent: number;
  };
  storage: {
    clone_cache_mb: number;
    clone_count: number;
    disk_free_gb: number;
    disk_total_gb: number;
    disk_used_percent: number;
  };
  models: {
    chat_model: string;
    diagram_model: string;
    fallback_model: string;
  };
}

interface QueryTrace {
  id: string;
  repo_id: string;
  question: string;
  rewritten_question: string;
  latency_total_ms: number;
  latency_retrieval_ms: number;
  latency_llm_ms: number;
  tokens_in: number;
  tokens_out: number;
  total_tokens: number;
  num_chunks_retrieved: number;
  num_chunks_kept: number;
  highlight_hit: boolean;
  error: string | null;
  created_at: string;
}

interface AiTelemetry {
  percentiles: {
    p50_ms: number;
    p95_ms: number;
    p99_ms: number;
  };
  recent_queries: QueryTrace[];
}

interface SystemHealth {
  status: string;
  database: {
    connected: boolean;
    dialect: string;
  };
  storage: {
    clone_cache_bytes: number;
    clone_cache_mb: number;
    clone_count: number;
    chroma_storage_mb: number;
    disk_free_gb: number;
    disk_total_gb: number;
    disk_used_percent: number;
  };
  server_time: string;
}

export default function ObservabilityDashboard() {
  const [activeTab, setActiveTab] = useState<"ai" | "system" | "traces">("ai");
  const [days, setDays] = useState<number>(30);
  const [refreshInterval, setRefreshInterval] = useState<number>(0); // 0 = off, 10, 30, 60
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Core telemetry state
  const [overview, setOverview] = useState<OverviewMetrics | null>(null);
  const [aiData, setAiData] = useState<AiTelemetry | null>(null);
  const [systemData, setSystemData] = useState<SystemHealth | null>(null);

  // Trace search & expand state
  const [traceSearch, setTraceSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "success" | "failed">("all");
  const [expandedTraceId, setExpandedTraceId] = useState<string | null>(null);

  // GC action state
  const [gcLoading, setGcLoading] = useState(false);
  const [gcMaxAge, setGcMaxAge] = useState<number>(24);

  const fetchTelemetry = useCallback(async (silent = false) => {
    if (!silent) setIsRefreshing(true);
    try {
      const [ovRes, aiRes, sysRes] = await Promise.all([
        fetch(`/api/observability/overview?days=${days}`, { cache: "no-store" }),
        fetch(`/api/observability/ai?limit=100`, { cache: "no-store" }),
        fetch(`/api/observability/system`, { cache: "no-store" }),
      ]);

      if (ovRes.ok) {
        const ovJson = await ovRes.json();
        setOverview(ovJson);
      }
      if (aiRes.ok) {
        const aiJson = await aiRes.json();
        setAiData(aiJson);
      }
      if (sysRes.ok) {
        const sysJson = await sysRes.json();
        setSystemData(sysJson);
      }

      setLastUpdated(new Date());
    } catch (err) {
      console.error("Failed to load observability data:", err);
      sileo.error({
        title: "Telemetry Sync Failed",
        description: "Could not retrieve real-time observability telemetry.",
      });
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [days]);

  // Initial load and time range changes
  useEffect(() => {
    fetchTelemetry();
  }, [fetchTelemetry]);

  // Periodic auto-refresh
  useEffect(() => {
    if (refreshInterval <= 0) return;
    const interval = setInterval(() => {
      fetchTelemetry(true);
    }, refreshInterval * 1000);
    return () => clearInterval(interval);
  }, [refreshInterval, fetchTelemetry]);

  // Run Garbage Collection handler
  const handleRunGc = async () => {
    setGcLoading(true);
    try {
      const res = await fetch("/api/observability/gc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ max_age_hours: gcMaxAge }),
      });
      const data = await res.json();
      if (res.ok) {
        sileo.success({
          title: "Garbage Collection Completed",
          description: data.message || `Purged ${data.deleted_count} clone(s), freed ${data.freed_mb} MB.`,
        });
        fetchTelemetry(true);
      } else {
        sileo.error({
          title: "GC Execution Failed",
          description: data.error || "Unable to clean clone cache.",
        });
      }
    } catch (err) {
      sileo.error({
        title: "Network Error",
        description: "Failed to trigger GC command.",
      });
    } finally {
      setGcLoading(false);
    }
  };

  // Filtered queries for traces tab
  const filteredTraces = (aiData?.recent_queries || []).filter((trace) => {
    const matchesSearch =
      trace.question.toLowerCase().includes(traceSearch.toLowerCase()) ||
      trace.id.toLowerCase().includes(traceSearch.toLowerCase()) ||
      (trace.rewritten_question && trace.rewritten_question.toLowerCase().includes(traceSearch.toLowerCase()));
    const isError = Boolean(trace.error);
    const matchesStatus =
      statusFilter === "all"
        ? true
        : statusFilter === "failed"
        ? isError
        : !isError;
    return matchesSearch && matchesStatus;
  });

  const aiStats = overview?.ai;
  const storageStats = systemData?.storage || overview?.storage;
  const pipelineStats = overview?.pipeline;

  return (
    <div className="flex-1 w-full p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Top Header & Telemetry Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-6 border-b border-outline-variant">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-[#4a50c5]/20 to-[#00b08a]/20 border border-[#4a50c5]/30 text-primary">
              <Activity className="h-6 w-6 text-primary animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-on-surface flex items-center gap-3">
                Observability & Telemetry
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#00b08a]/10 text-[#00b08a] border border-[#00b08a]/30">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#00b08a] animate-ping" />
                  Engine Live
                </span>
              </h1>
              <p className="text-sm text-on-surface-variant mt-0.5">
                Real-time AI pipeline latency, token consumption, RAG retention efficiency, and host infrastructure health.
              </p>
            </div>
          </div>
        </div>

        {/* Global Controls: Time Window, Auto-refresh, Manual Sync */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Time Window Selector */}
          <div className="flex items-center bg-surface-container-low p-1 rounded-lg border border-outline-variant text-xs">
            {[
              { label: "24h", value: 1 },
              { label: "7d", value: 7 },
              { label: "30d", value: 30 },
              { label: "90d", value: 90 },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDays(opt.value)}
                className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                  days === opt.value
                    ? "bg-primary text-on-primary shadow-sm"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Auto Refresh Select */}
          <div className="flex items-center gap-1 bg-surface-container-low px-2.5 py-1.5 rounded-lg border border-outline-variant text-xs text-on-surface-variant">
            <Clock className="h-3.5 w-3.5" />
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              className="bg-transparent text-on-surface font-medium outline-none cursor-pointer pr-1"
            >
              <option value={0} className="bg-surface text-on-surface">Auto: Off</option>
              <option value={10} className="bg-surface text-on-surface">10s</option>
              <option value={30} className="bg-surface text-on-surface">30s</option>
              <option value={60} className="bg-surface text-on-surface">60s</option>
            </select>
          </div>

          {/* Manual Refresh Button */}
          <button
            onClick={() => fetchTelemetry()}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high border border-outline-variant text-xs font-medium text-on-surface transition-all active:scale-95 disabled:opacity-50"
            title="Refresh Telemetry Metrics"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin text-primary" : ""}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* Top 4 KPI Executive Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: AI Operations & Cost */}
        <div className="relative overflow-hidden rounded-2xl p-5 bg-surface-container-low border border-outline-variant hover:border-primary/40 transition-all duration-300 shadow-sm group">
          <div className="absolute top-0 right-0 w-28 h-28 bg-gradient-to-bl from-primary/10 to-transparent pointer-events-none rounded-bl-full" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-on-surface-variant">AI Pipeline Volume</span>
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-on-surface tracking-tight">
              {aiStats ? aiStats.total_queries.toLocaleString() : "—"}
              <span className="text-xs font-normal text-on-surface-variant ml-1.5">queries</span>
            </div>
            <div className="flex items-center gap-2 mt-2 text-xs">
              <span className="font-semibold text-secondary flex items-center gap-0.5">
                <DollarSign className="h-3.5 w-3.5" />
                {aiStats ? aiStats.estimated_cost_usd.toFixed(4) : "0.0000"} USD
              </span>
              <span className="text-on-surface-variant/60">•</span>
              <span className="text-on-surface-variant">
                {aiStats ? (aiStats.total_tokens / 1000).toFixed(1) : "0"}k tokens
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: End-to-End Latency */}
        <div className="relative overflow-hidden rounded-2xl p-5 bg-surface-container-low border border-outline-variant hover:border-[#00b08a]/40 transition-all duration-300 shadow-sm group">
          <div className="absolute top-0 right-0 w-28 h-28 bg-gradient-to-bl from-[#00b08a]/10 to-transparent pointer-events-none rounded-bl-full" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-on-surface-variant">Avg Latency (E2E)</span>
            <div className="p-2 rounded-lg bg-[#00b08a]/10 text-[#00b08a]">
              <Zap className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-on-surface tracking-tight">
              {aiStats ? aiStats.avg_latency_ms.toFixed(0) : "—"}
              <span className="text-xs font-normal text-on-surface-variant ml-1">ms</span>
            </div>
            <div className="flex items-center gap-2 mt-2 text-xs">
              <span className="px-1.5 py-0.5 rounded bg-surface-container font-mono text-[11px] text-primary">
                RAG: {aiStats ? aiStats.avg_retrieval_ms.toFixed(0) : 0}ms
              </span>
              <span className="px-1.5 py-0.5 rounded bg-surface-container font-mono text-[11px] text-[#00b08a]">
                LLM: {aiStats ? aiStats.avg_llm_ms.toFixed(0) : 0}ms
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: RAG & Pipeline Reliability */}
        <div className="relative overflow-hidden rounded-2xl p-5 bg-surface-container-low border border-outline-variant hover:border-primary/40 transition-all duration-300 shadow-sm group">
          <div className="absolute top-0 right-0 w-28 h-28 bg-gradient-to-bl from-primary/10 to-transparent pointer-events-none rounded-bl-full" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-on-surface-variant">RAG Retention Efficiency</span>
            <div className="p-2 rounded-lg bg-[#00b08a]/10 text-[#00b08a]">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-on-surface tracking-tight">
              {aiStats ? aiStats.retrieval_efficiency_percent.toFixed(1) : "100.0"}%
            </div>
            <div className="flex items-center gap-2 mt-2 text-xs text-on-surface-variant">
              <span>Repo Pipeline:</span>
              <span className="font-semibold text-on-surface">
                {pipelineStats ? pipelineStats.success_rate_percent.toFixed(0) : 100}%
              </span>
              <span className="text-on-surface-variant/60">•</span>
              <span>{pipelineStats ? pipelineStats.total_repos : 0} repos</span>
            </div>
          </div>
        </div>

        {/* Card 4: Host Storage & Clone Cache */}
        <div className="relative overflow-hidden rounded-2xl p-5 bg-surface-container-low border border-outline-variant hover:border-primary/40 transition-all duration-300 shadow-sm group">
          <div className="absolute top-0 right-0 w-28 h-28 bg-gradient-to-bl from-amber-500/10 to-transparent pointer-events-none rounded-bl-full" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-on-surface-variant">Clone Cache & Disk</span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
              <HardDrive className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-on-surface tracking-tight">
              {storageStats ? storageStats.clone_cache_mb.toFixed(1) : "0.0"}
              <span className="text-xs font-normal text-on-surface-variant ml-1">MB cache</span>
            </div>
            <div className="flex items-center justify-between mt-2 text-xs">
              <span className="text-on-surface-variant">
                Disk {storageStats ? storageStats.disk_used_percent.toFixed(0) : 0}% used
              </span>
              <button
                onClick={handleRunGc}
                disabled={gcLoading}
                className="text-[11px] font-semibold text-primary hover:text-primary/80 flex items-center gap-1 active:scale-95 disabled:opacity-50"
              >
                <Trash2 className="h-3 w-3" />
                {gcLoading ? "Purging..." : "Purge GC"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="flex items-center border-b border-outline-variant gap-2 pt-2">
        <button
          onClick={() => setActiveTab("ai")}
          className={`flex items-center gap-2 pb-3 px-3 font-medium text-sm border-b-2 transition-all ${
            activeTab === "ai"
              ? "border-primary text-primary"
              : "border-transparent text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <Cpu className="h-4 w-4" />
          AI & Agent Telemetry
        </button>
        <button
          onClick={() => setActiveTab("system")}
          className={`flex items-center gap-2 pb-3 px-3 font-medium text-sm border-b-2 transition-all ${
            activeTab === "system"
              ? "border-primary text-primary"
              : "border-transparent text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <Server className="h-4 w-4" />
          Host & Storage Health
        </button>
        <button
          onClick={() => setActiveTab("traces")}
          className={`flex items-center gap-2 pb-3 px-3 font-medium text-sm border-b-2 transition-all ${
            activeTab === "traces"
              ? "border-primary text-primary"
              : "border-transparent text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <BarChart3 className="h-4 w-4" />
          Live Query Traces
          {aiData?.recent_queries && (
            <span className="ml-1.5 px-2 py-0.5 text-xs rounded-full bg-surface-container font-mono text-on-surface-variant">
              {aiData.recent_queries.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab 1: AI & Agent Telemetry */}
      {activeTab === "ai" && (
        <div className="space-y-6">
          {/* Latency Percentile & RAG Retention Funnel Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Latency Percentiles Card */}
            <div className="p-6 rounded-2xl bg-surface-container-low border border-outline-variant space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Clock className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold text-base text-on-surface">Latency Distribution Breakdown</h3>
                </div>
                <span className="text-xs text-on-surface-variant">Window: {days} days</span>
              </div>
              <p className="text-xs text-on-surface-variant">
                Comparison between Vector Search Retrieval (ChromaDB) and LLM Reasoning & Synthesis phases.
              </p>

              {/* Latency Percentile Badges */}
              <div className="grid grid-cols-3 gap-3 pt-2">
                <div className="p-3 rounded-xl bg-surface-container border border-outline-variant/60">
                  <div className="text-[11px] uppercase tracking-wider text-on-surface-variant">P50 (Median)</div>
                  <div className="text-lg font-bold font-mono text-on-surface mt-1">
                    {aiData?.percentiles ? aiData.percentiles.p50_ms.toFixed(0) : "0"} ms
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-surface-container border border-outline-variant/60">
                  <div className="text-[11px] uppercase tracking-wider text-on-surface-variant">P95 Latency</div>
                  <div className="text-lg font-bold font-mono text-amber-500 mt-1">
                    {aiData?.percentiles ? aiData.percentiles.p95_ms.toFixed(0) : "0"} ms
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-surface-container border border-outline-variant/60">
                  <div className="text-[11px] uppercase tracking-wider text-on-surface-variant">P99 Tail</div>
                  <div className="text-lg font-bold font-mono text-rose-500 mt-1">
                    {aiData?.percentiles ? aiData.percentiles.p99_ms.toFixed(0) : "0"} ms
                  </div>
                </div>
              </div>

              {/* Visual Split Bar */}
              <div className="pt-2 space-y-2">
                <div className="flex justify-between text-xs text-on-surface-variant">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                    Vector RAG: {aiStats ? aiStats.avg_retrieval_ms.toFixed(0) : 0}ms
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#00b08a]" />
                    LLM Synthesis: {aiStats ? aiStats.avg_llm_ms.toFixed(0) : 0}ms
                  </span>
                </div>
                <div className="h-3 w-full rounded-full bg-surface-container-high overflow-hidden flex">
                  <div
                    className="h-full bg-primary transition-all duration-500"
                    style={{
                      width: `${
                        aiStats && aiStats.avg_latency_ms > 0
                          ? Math.min(100, Math.max(5, (aiStats.avg_retrieval_ms / aiStats.avg_latency_ms) * 100))
                          : 25
                      }%`,
                    }}
                  />
                  <div
                    className="h-full bg-[#00b08a] transition-all duration-500"
                    style={{
                      width: `${
                        aiStats && aiStats.avg_latency_ms > 0
                          ? Math.min(100, Math.max(5, (aiStats.avg_llm_ms / aiStats.avg_latency_ms) * 100))
                          : 75
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* RAG Context Funnel Card */}
            <div className="p-6 rounded-2xl bg-surface-container-low border border-outline-variant space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Layers className="h-5 w-5 text-secondary" />
                  <h3 className="font-semibold text-base text-on-surface">RAG Context Funnel Efficiency</h3>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-secondary/10 text-secondary border border-secondary/20">
                  {aiStats ? aiStats.retrieval_efficiency_percent.toFixed(1) : 100}% retained
                </span>
              </div>
              <p className="text-xs text-on-surface-variant">
                Measures context relevance filtering: total vector chunks retrieved vs actually kept for LLM generation.
              </p>

              <div className="space-y-3 pt-1">
                {/* Step 1: Retrieved Chunks */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-on-surface">1. Total Retrieved Chunks (ChromaDB)</span>
                    <span className="font-mono text-on-surface-variant">
                      {aiStats ? aiStats.chunks_retrieved : 0} chunks
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-surface-container rounded-full overflow-hidden">
                    <div className="h-full bg-primary/70 rounded-full w-full" />
                  </div>
                </div>

                {/* Step 2: Retained Chunks */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-on-surface">2. Relevant Chunks Injected to LLM</span>
                    <span className="font-mono font-medium text-secondary">
                      {aiStats ? aiStats.chunks_kept : 0} chunks
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-surface-container rounded-full overflow-hidden">
                    <div
                      className="h-full bg-secondary rounded-full transition-all duration-500"
                      style={{
                        width: `${
                          aiStats && aiStats.retrieval_efficiency_percent > 0
                            ? Math.min(100, Math.max(10, aiStats.retrieval_efficiency_percent))
                            : 100
                        }%`,
                      }}
                    />
                  </div>
                </div>

                {/* Highlight Accuracy & Errors */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="p-3 rounded-xl bg-surface-container border border-outline-variant/60 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <Target className="h-4 w-4 text-primary" />
                      <span className="text-on-surface">Highlight Accuracy</span>
                    </div>
                    <span className="font-mono font-semibold text-on-surface">
                      {aiStats ? aiStats.highlight_accuracy_percent.toFixed(0) : 0}%
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-surface-container border border-outline-variant/60 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      <span className="text-on-surface">Logged Errors</span>
                    </div>
                    <span className="font-mono font-semibold text-on-surface">
                      {aiStats ? aiStats.error_count : 0}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Token Consumption & Active Models Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Tokens Breakdown */}
            <div className="p-6 rounded-2xl bg-surface-container-low border border-outline-variant space-y-4 lg:col-span-2">
              <h3 className="font-semibold text-base text-on-surface flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Token Distribution & Economics
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-xl bg-surface-container border border-outline-variant/60">
                  <div className="text-xs text-on-surface-variant">Prompt Tokens In</div>
                  <div className="text-xl font-bold font-mono text-on-surface mt-1">
                    {aiStats ? aiStats.tokens_in.toLocaleString() : "0"}
                  </div>
                  <div className="text-[11px] text-on-surface-variant mt-1">
                    Input context payload
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-surface-container border border-outline-variant/60">
                  <div className="text-xs text-on-surface-variant">Completion Tokens Out</div>
                  <div className="text-xl font-bold font-mono text-secondary mt-1">
                    {aiStats ? aiStats.tokens_out.toLocaleString() : "0"}
                  </div>
                  <div className="text-[11px] text-on-surface-variant mt-1">
                    Generated answers & thoughts
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-surface-container border border-outline-variant/60">
                  <div className="text-xs text-on-surface-variant">Total Spend (USD)</div>
                  <div className="text-xl font-bold font-mono text-on-surface mt-1">
                    ${aiStats ? aiStats.estimated_cost_usd.toFixed(4) : "0.0000"}
                  </div>
                  <div className="text-[11px] text-on-surface-variant mt-1">
                    Blended API estimation
                  </div>
                </div>
              </div>
            </div>

            {/* Model Engine Configuration */}
            <div className="p-6 rounded-2xl bg-surface-container-low border border-outline-variant space-y-4">
              <h3 className="font-semibold text-base text-on-surface flex items-center gap-2">
                <Cpu className="h-5 w-5 text-secondary" />
                Configured Model Engines
              </h3>
              <div className="space-y-2.5">
                <div className="p-3 rounded-xl bg-surface-container border border-outline-variant/60 text-xs">
                  <div className="text-on-surface-variant font-medium text-[11px]">Chat & Q/A Engine</div>
                  <div className="font-mono text-primary font-semibold truncate mt-0.5">
                    {overview?.models?.chat_model || "nvidia/nemotron-3-nano-30b-a3b:free"}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-surface-container border border-outline-variant/60 text-xs">
                  <div className="text-on-surface-variant font-medium text-[11px]">Diagram & Architecture</div>
                  <div className="font-mono text-secondary font-semibold truncate mt-0.5">
                    {overview?.models?.diagram_model || "nvidia/nemotron-3-nano-30b-a3b:free"}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-surface-container border border-outline-variant/60 text-xs">
                  <div className="text-on-surface-variant font-medium text-[11px]">Resilience Fallback</div>
                  <div className="font-mono text-on-surface font-semibold truncate mt-0.5">
                    {overview?.models?.fallback_model || "nvidia/nemotron-3-nano-30b-a3b:free"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Backend Infrastructure & Storage Health */}
      {activeTab === "system" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* System Disk Usage Gauge */}
            <div className="p-6 rounded-2xl bg-surface-container-low border border-outline-variant space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-base text-on-surface flex items-center gap-2">
                  <HardDrive className="h-5 w-5 text-primary" />
                  Primary Storage Volume
                </h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-surface-container text-on-surface font-mono">
                  {storageStats ? storageStats.disk_free_gb.toFixed(1) : 0} GB Free
                </span>
              </div>
              <p className="text-xs text-on-surface-variant">
                Monitors root server partition disk usage. Ensure sufficient storage for repository checkouts and vector embeddings.
              </p>

              {/* Progress Bar */}
              <div className="space-y-2 pt-2">
                <div className="h-3 w-full bg-surface-container rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      (storageStats?.disk_used_percent || 0) > 85
                        ? "bg-rose-500"
                        : (storageStats?.disk_used_percent || 0) > 70
                        ? "bg-amber-500"
                        : "bg-[#00b08a]"
                    }`}
                    style={{ width: `${storageStats?.disk_used_percent || 0}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-on-surface-variant">
                  <span>{storageStats ? storageStats.disk_used_percent.toFixed(1) : 0}% Utilized</span>
                  <span>Total: {storageStats ? storageStats.disk_total_gb.toFixed(1) : 0} GB</span>
                </div>
              </div>
            </div>

            {/* Database & Pool Health */}
            <div className="p-6 rounded-2xl bg-surface-container-low border border-outline-variant space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-base text-on-surface flex items-center gap-2">
                  <Database className="h-5 w-5 text-secondary" />
                  PostgreSQL Connectivity
                </h3>
                <span className="inline-flex items-center gap-1 text-xs text-[#00b08a] font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {systemData?.database.connected !== false ? "Connected" : "Disconnected"}
                </span>
              </div>
              <p className="text-xs text-on-surface-variant">
                Async SQLAlchemy 2.0 connection state and dialect telemetry.
              </p>

              <div className="p-3.5 rounded-xl bg-surface-container border border-outline-variant/60 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Dialect:</span>
                  <span className="font-mono text-on-surface uppercase">
                    {systemData?.database.dialect || "postgresql"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Server Status:</span>
                  <span className="font-medium text-[#00b08a] uppercase">
                    {systemData?.status || "HEALTHY"}
                  </span>
                </div>
              </div>
            </div>

            {/* ChromaDB Vector Index */}
            <div className="p-6 rounded-2xl bg-surface-container-low border border-outline-variant space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-base text-on-surface flex items-center gap-2">
                  <Server className="h-5 w-5 text-primary" />
                  ChromaDB Store
                </h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-mono">
                  {systemData?.storage ? systemData.storage.chroma_storage_mb.toFixed(1) : 0} MB
                </span>
              </div>
              <p className="text-xs text-on-surface-variant">
                Persistent local vector index holding semantic embeddings and code graph mappings.
              </p>

              <div className="p-3.5 rounded-xl bg-surface-container border border-outline-variant/60 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Persistence Directory:</span>
                  <span className="font-mono text-secondary font-medium">./chroma_db</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Status:</span>
                  <span className="font-medium text-[#00b08a]">Persistent & Active</span>
                </div>
              </div>
            </div>
          </div>

          {/* RepoHawk Clone Cache Explorer & GC Controls */}
          <div className="p-6 rounded-2xl bg-surface-container-low border border-outline-variant space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="font-semibold text-base text-on-surface flex items-center gap-2">
                  <HardDrive className="h-5 w-5 text-amber-500" />
                  Repository Clone Cache Manager
                </h3>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Temporary Git repositories checked out to /tmp/repohawk. Currently holding{" "}
                  <span className="font-semibold text-on-surface">{storageStats?.clone_count || 0}</span> clones (
                  <span className="font-mono text-secondary">{storageStats?.clone_cache_mb.toFixed(1) || 0} MB</span>).
                </p>
              </div>

              {/* GC Action Controls */}
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <select
                  value={gcMaxAge}
                  onChange={(e) => setGcMaxAge(Number(e.target.value))}
                  className="bg-surface-container border border-outline-variant text-xs text-on-surface rounded-lg px-2.5 py-2 outline-none cursor-pointer"
                >
                  <option value={1}>Older than 1 hour</option>
                  <option value={12}>Older than 12 hours</option>
                  <option value={24}>Older than 24 hours</option>
                  <option value={0}>Purge All Clones</option>
                </select>

                <button
                  onClick={handleRunGc}
                  disabled={gcLoading}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/30 text-xs font-semibold transition-all active:scale-95 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {gcLoading ? "Purging..." : "Run Garbage Collection"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Live Query Trace Log */}
      {activeTab === "traces" && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-surface-container-low border border-outline-variant">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-on-surface-variant" />
              <input
                type="text"
                placeholder="Search traces by question or trace ID..."
                value={traceSearch}
                onChange={(e) => setTraceSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-surface border border-outline-variant text-xs text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:border-primary"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-on-surface-variant flex items-center gap-1">
                <Filter className="h-3.5 w-3.5" /> Filter:
              </span>
              <div className="flex rounded-lg bg-surface border border-outline-variant p-0.5 text-xs">
                {(["all", "success", "failed"] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-3 py-1 rounded capitalize font-medium transition-colors ${
                      statusFilter === st
                        ? "bg-primary text-on-primary"
                        : "text-on-surface-variant hover:text-on-surface"
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Trace Table */}
          <div className="overflow-x-auto border border-outline-variant rounded-2xl bg-surface-container-low">
            <table className="w-full text-left text-xs text-on-surface">
              <thead className="bg-surface-container text-on-surface-variant border-b border-outline-variant font-medium">
                <tr>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">User Question</th>
                  <th className="p-3.5">Total Latency</th>
                  <th className="p-3.5">RAG / LLM Split</th>
                  <th className="p-3.5">Chunks (R/K)</th>
                  <th className="p-3.5">Highlight</th>
                  <th className="p-3.5">Timestamp</th>
                  <th className="p-3.5 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/40">
                {filteredTraces.length > 0 ? (
                  filteredTraces.map((trace) => {
                    const isExpanded = expandedTraceId === trace.id;
                    const isSuccess = !trace.error;

                    return (
                      <React.Fragment key={trace.id}>
                        <tr
                          onClick={() => setExpandedTraceId(isExpanded ? null : trace.id)}
                          className="hover:bg-surface-container cursor-pointer transition-colors"
                        >
                          <td className="p-3.5">
                            {isSuccess ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#00b08a]/10 text-[#00b08a] border border-[#00b08a]/20">
                                <CheckCircle2 className="h-3 w-3" />
                                200 OK
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-500 border border-rose-500/20">
                                <XCircle className="h-3 w-3" />
                                Error
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 font-medium max-w-xs truncate text-on-surface">
                            {trace.question}
                          </td>
                          <td className="p-3.5 font-mono font-semibold text-on-surface">
                            {trace.latency_total_ms.toFixed(0)} ms
                          </td>
                          <td className="p-3.5">
                            <div className="flex items-center gap-1.5 font-mono text-[11px]">
                              <span className="text-primary">{trace.latency_retrieval_ms.toFixed(0)}ms</span>
                              <span className="text-on-surface-variant/40">/</span>
                              <span className="text-[#00b08a]">{trace.latency_llm_ms.toFixed(0)}ms</span>
                            </div>
                          </td>
                          <td className="p-3.5 font-mono text-on-surface-variant">
                            {trace.num_chunks_retrieved} / {trace.num_chunks_kept}
                          </td>
                          <td className="p-3.5">
                            {trace.highlight_hit ? (
                              <span className="text-[#00b08a] font-semibold">Hit</span>
                            ) : (
                              <span className="text-on-surface-variant/60">—</span>
                            )}
                          </td>
                          <td className="p-3.5 text-on-surface-variant whitespace-nowrap">
                            {trace.created_at ? new Date(trace.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"}
                          </td>
                          <td className="p-3.5 text-right">
                            <button className="p-1 rounded hover:bg-surface-container-high text-on-surface-variant">
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </button>
                          </td>
                        </tr>

                        {/* Expanded Drawer */}
                        {isExpanded && (
                          <tr className="bg-surface-container/60">
                            <td colSpan={8} className="p-5 border-t border-outline-variant/40">
                              <div className="space-y-3">
                                <div>
                                  <div className="text-[11px] uppercase tracking-wider font-semibold text-on-surface-variant mb-1">
                                    Original User Question
                                  </div>
                                  <div className="p-3 rounded-lg bg-surface border border-outline-variant font-mono text-xs text-on-surface select-all">
                                    {trace.question}
                                  </div>
                                </div>

                                {trace.rewritten_question && trace.rewritten_question !== trace.question && (
                                  <div>
                                    <div className="text-[11px] uppercase tracking-wider font-semibold text-on-surface-variant mb-1">
                                      Rewritten / HyDE Expanded Query
                                    </div>
                                    <div className="p-3 rounded-lg bg-surface border border-outline-variant text-xs text-on-surface-variant leading-relaxed">
                                      {trace.rewritten_question}
                                    </div>
                                  </div>
                                )}

                                {trace.error && (
                                  <div>
                                    <div className="text-[11px] uppercase tracking-wider font-semibold text-rose-500 mb-1">
                                      Pipeline Failure Diagnostics
                                    </div>
                                    <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-500 font-mono text-xs">
                                      {trace.error}
                                    </div>
                                  </div>
                                )}

                                <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-on-surface-variant font-mono">
                                  <span>Trace ID: <span className="text-on-surface select-all">{trace.id}</span></span>
                                  {trace.repo_id && <span>Repo ID: <span className="text-on-surface select-all">{trace.repo_id}</span></span>}
                                  <span>Recorded: <span className="text-on-surface">{trace.created_at ? new Date(trace.created_at).toLocaleString() : "—"}</span></span>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-on-surface-variant">
                      No query traces matching your filter in this time window.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
