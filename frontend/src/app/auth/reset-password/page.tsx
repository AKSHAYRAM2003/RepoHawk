"use client";

import { useState, FormEvent, useEffect, useRef, Suspense, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PasswordInput from "@/components/auth/PasswordInput";
import { motion } from "framer-motion";

type Step = "loading" | "form" | "success" | "invalid";

function ResetFormContent({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const router = useRouter();
  const params = use(searchParams);
  const raw = params.token;
  const token = Array.isArray(raw) ? raw[0] : (raw ?? "");

  const [step, setStep] = useState<Step>("loading");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const innerCard =
    "w-full p-8 md:p-10 rounded-3xl border border-outline-variant/15 bg-surface-container-high/60 dark:bg-surface-container-high/40 backdrop-blur-2xl shadow-xl space-y-8 relative overflow-hidden transition-all duration-300";

  // Set step safely on client to avoid hydration mismatch
  useEffect(() => {
    if (isSuccess) {
      setStep("success");
    } else {
      setStep(token ? "form" : "invalid");
    }
  }, [token, isSuccess]);

  // Auto-redirect countdown on success
  useEffect(() => {
    if (step === "success") {
      setCountdown(3);
      countdownRef.current = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            clearInterval(countdownRef.current!);
            router.push("/auth/login");
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    }
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [step, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if ((password?.length ?? 0) < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Reset failed");
      }
      setIsSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };



  if (step === "loading") {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-on-surface-variant">
        <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <p className="text-sm font-medium">Verifying link...</p>
      </div>
    );
  }

  if (step === "invalid") {
    return (
      <motion.div
        key="invalid"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
        className="flex flex-col items-center gap-5 text-center py-4"
      >
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border-2 border-rose-500/25 flex items-center justify-center shadow-[0_0_20px_rgba(239,68,68,0.12)]">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold text-on-surface tracking-tight">
            Invalid link
          </h1>
          <p className="text-on-surface-variant text-sm leading-relaxed max-w-xs mx-auto">
            This reset link is invalid or has expired. Request a new one.
          </p>
        </div>
        <div className="flex flex-col items-center gap-3 w-full pt-1">
          <Link
            href="/auth/forgot-password"
            className="w-full h-11 rounded-xl bg-gradient-to-r from-[#4a50c5] to-[#00b08a] text-white font-bold text-sm hover:shadow-lg active:scale-[0.98] transition-all flex items-center justify-center"
          >
            Request new link
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-primary transition-colors font-medium"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
            Back to home
          </Link>
        </div>
      </motion.div>
    );
  }

  if (step === "success") {
    return (
      <div className={innerCard}>
      <motion.div
        key="success"
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="flex flex-col items-center gap-5 text-center"
      >
        {/* Animated green checkmark */}
        <div className="relative flex items-center justify-center">
          {/* Outer glow ring */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.4, ease: "easeOut" }}
            className="absolute w-24 h-24 rounded-full bg-emerald-500/10"
          />
          {/* Inner ring */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.18, duration: 0.35 }}
            className="absolute w-20 h-20 rounded-full bg-emerald-500/12"
          />
          {/* Icon circle with draw animation */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.22, type: "spring", stiffness: 220, damping: 16 }}
            className="relative w-16 h-16 rounded-2xl bg-emerald-500/15 border-2 border-emerald-500/35 flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.22)]"
          >
            <svg
              width="40"
              height="40"
              viewBox="0 0 40 40"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <motion.path
                d="M8 20 L16 28 L32 12"
                stroke="#10b981"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ delay: 0.42, duration: 0.5, ease: "easeOut" }}
              />
            </svg>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.3 }}
          className="space-y-2"
        >
          <h1 className="text-2xl font-extrabold text-on-surface tracking-tight">
            Password reset! 🎉
          </h1>
          <p className="text-on-surface-variant text-sm leading-relaxed max-w-xs mx-auto">
            Your password has been updated successfully. Redirecting you to sign in...
          </p>
        </motion.div>

        {/* Countdown bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55 }}
          className="w-full max-w-xs"
        >
          <div className="flex items-center justify-between text-xs text-on-surface-variant mb-2">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Redirecting in {countdown}s
            </span>
            <button
              onClick={() => {
                if (countdownRef.current) clearInterval(countdownRef.current);
                router.push("/auth/login");
              }}
              className="text-primary font-semibold hover:underline"
            >
              Sign in now →
            </button>
          </div>
          <div className="h-1 w-full bg-outline-variant/20 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-emerald-500 rounded-full"
              initial={{ width: "100%" }}
              animate={{ width: "0%" }}
              transition={{ duration: 3, ease: "linear" }}
            />
          </div>
        </motion.div>
        </motion.div>
      </div>
    );
  }

  // DEFAULT (step === "form")
  return (
    <div className={innerCard}>
      <motion.div
        key="form"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        className="space-y-6"
      >
        {/* Icon */}
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-[0_0_20px_rgba(74,80,197,0.15)]">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
        </div>

        <div className="text-center space-y-2">
          <h1 className="text-2xl font-extrabold text-on-surface tracking-tight">
            Set new password
          </h1>
          <p className="text-on-surface-variant text-sm leading-relaxed">
            Choose a strong password for your account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-sm font-medium"
            >
              {error}
            </motion.div>
          )}
          <PasswordInput
            label="New password"
            value={password}
            onChange={setPassword}
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-xl bg-gradient-to-r from-[#4a50c5] to-[#00b08a] text-white font-bold text-sm hover:shadow-lg active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {loading ? "Resetting..." : "Reset password"}
          </button>
        </form>

        <div className="text-center text-sm border-t border-outline-variant/15 pt-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-on-surface-variant hover:text-primary transition-colors font-medium"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
            Back to home
          </Link>
        </div>
      </motion.div>
    </div>
  );
}

export default function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-on-surface-variant">
          <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm font-medium">Verifying link...</p>
        </div>
      }
    >
      <ResetFormContent searchParams={searchParams} />
    </Suspense>
  );
}
