/**
 * useCredits — Real-time analysis credit hook
 *
 * Fetches server-authoritative credit status from /api/credits and auto-refreshes:
 *  - Every 30s normally
 *  - Every 5s when credits are exhausted (so the UI unblocks quickly on refill)
 *
 * Falls back gracefully: if the backend is unreachable, it returns a "full"
 * credit state so the user is never incorrectly blocked.
 */
"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface CreditStatus {
  total: number;
  used: number;
  remaining: number;
  windowHours: number;
  /** ISO timestamp when the next credit becomes available (null if credits remain) */
  resetAt: Date | null;
  /** Seconds until reset (null if credits remain) */
  retryAfterSeconds: number | null;
  /** Human-readable formatted time e.g. "3:45 PM" */
  formattedResetTime: string;
  /** Human-readable countdown e.g. "1h 23m" */
  formattedCountdown: string;
  /** Whether Q&A chat is free (always true per product spec) */
  chatIsFree: boolean;
  isExhausted: boolean;
  isLow: boolean;
  isLoading: boolean;
  error: string | null;
  /** Manually trigger a re-fetch */
  refresh: () => void;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function useCredits(): CreditStatus {
  const [data, setData] = useState<{
    total: number;
    used: number;
    remaining: number;
    window_hours: number;
    reset_at: string | null;
    retry_after_seconds: number | null;
    chat_is_free: boolean;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0); // For live countdown
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchCredits = useCallback(async () => {
    try {
      const res = await fetch("/api/credits", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to load credits");
      // On error, don't block — leave previous data or show full credits
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchCredits();
  }, [fetchCredits]);

  // Polling: every 30s normally, every 5s when exhausted
  useEffect(() => {
    const exhausted = data?.remaining === 0;
    const interval = exhausted ? 5000 : 30000;

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(fetchCredits, interval);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [data?.remaining, fetchCredits]);

  // Live countdown tick every second
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Compute derived values
  const total = data?.total ?? 5;
  const used = data?.used ?? 0;
  const remaining = data?.remaining ?? 5;

  let resetAt: Date | null = null;
  let retryAfterSeconds: number | null = null;
  let formattedResetTime = "";
  let formattedCountdown = "";

  if (data?.reset_at) {
    resetAt = new Date(data.reset_at);
    const diffMs = resetAt.getTime() - Date.now();
    retryAfterSeconds = Math.max(0, Math.ceil(diffMs / 1000));
    formattedResetTime = formatTime(resetAt);
    formattedCountdown = formatCountdown(retryAfterSeconds);
  } else if (data?.retry_after_seconds) {
    retryAfterSeconds = Math.max(0, data.retry_after_seconds - tick);
    const resetDate = new Date(Date.now() + retryAfterSeconds * 1000);
    resetAt = resetDate;
    formattedResetTime = formatTime(resetDate);
    formattedCountdown = formatCountdown(retryAfterSeconds);
  }

  return {
    total,
    used,
    remaining,
    windowHours: data?.window_hours ?? 4,
    resetAt,
    retryAfterSeconds,
    formattedResetTime,
    formattedCountdown,
    chatIsFree: data?.chat_is_free ?? true,
    isExhausted: remaining === 0,
    isLow: remaining <= 2 && remaining > 0,
    isLoading,
    error,
    refresh: fetchCredits,
  };
}
