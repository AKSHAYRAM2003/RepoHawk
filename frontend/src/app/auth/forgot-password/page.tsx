"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

type Step = "form" | "success";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<Step>("form");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Something went wrong");
      }
      setStep("success");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence mode="wait">
      {/* ── STEP: FORM ── */}
      {step === "form" && (
        <motion.div
          key="form"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="space-y-6"
        >
          {/* Icon */}
          <div className="flex justify-center">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-[0_0_20px_rgba(74,80,197,0.15)]">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <rect width="20" height="16" x="2" y="4" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
            </div>
          </div>

          <div className="text-center space-y-2">
            <h1 className="text-2xl font-extrabold text-on-surface tracking-tight">
              Forgot password?
            </h1>
            <p className="text-on-surface-variant text-sm leading-relaxed">
              No worries! Enter your email and we&apos;ll send you a reset link.
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
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-on-surface-variant">
                Email address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full h-12 px-4 rounded-xl bg-surface-container-highest border border-outline-variant text-on-surface placeholder-on-surface-variant/60 outline-none focus:border-primary transition-colors text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-[#4a50c5] to-[#00b08a] text-white font-bold text-sm hover:shadow-lg active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {loading ? "Sending..." : "Send reset link"}
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
              Back to sign in
            </Link>
          </div>
        </motion.div>
      )}

      {/* ── STEP: SUCCESS ── */}
      {step === "success" && (
        <motion.div
          key="success"
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.92 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="flex flex-col items-center gap-5 text-center py-4"
        >
          {/* Animated envelope → check */}
          <div className="relative flex items-center justify-center">
            {/* Outer pulse ring */}
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.5 }}
              className="absolute w-24 h-24 rounded-full bg-emerald-500/8"
            />
            {/* Middle ring */}
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="absolute w-20 h-20 rounded-full bg-emerald-500/12"
            />
            {/* Icon circle */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.25, type: "spring", stiffness: 220, damping: 16 }}
              className="relative w-16 h-16 rounded-2xl bg-emerald-500/15 border-2 border-emerald-500/35 flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.2)]"
            >
              <svg
                width="38"
                height="38"
                viewBox="0 0 40 40"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Envelope body */}
                <motion.rect
                  x="4" y="10" width="32" height="22" rx="3"
                  stroke="#10b981"
                  strokeWidth="2.2"
                  fill="none"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ delay: 0.4, duration: 0.55 }}
                />
                {/* Envelope flap / V line */}
                <motion.path
                  d="M4 13 L20 24 L36 13"
                  stroke="#10b981"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  fill="none"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ delay: 0.75, duration: 0.45 }}
                />
              </svg>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.3 }}
            className="space-y-2"
          >
            <h1 className="text-2xl font-extrabold text-on-surface tracking-tight">
              Check your inbox
            </h1>
            <p className="text-on-surface-variant text-sm leading-relaxed max-w-xs mx-auto">
              If <span className="text-on-surface font-semibold">{email}</span> is
              registered, we&apos;ve sent a password reset link. Check your inbox (and spam folder).
            </p>
          </motion.div>

          {/* Resend & back */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.3 }}
            className="flex flex-col items-center gap-3 w-full pt-2"
          >
            <button
              onClick={() => setStep("form")}
              className="w-full h-11 rounded-xl border border-outline-variant/40 text-on-surface-variant hover:text-on-surface hover:border-outline-variant transition-all text-sm font-semibold"
            >
              Try a different email
            </button>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-primary transition-colors font-medium"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 5l-7 7 7 7" />
              </svg>
              Back to home
            </Link>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
