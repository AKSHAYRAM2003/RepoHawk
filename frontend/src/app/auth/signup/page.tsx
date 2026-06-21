"use client";

import { useState, FormEvent, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import PasswordInput from "@/components/auth/PasswordInput";
import { motion } from "framer-motion";

export default function SignupPage() {
  const { signup, setLoginModalOpen } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [countdown, setCountdown] = useState(2);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-redirect countdown on success
  useEffect(() => {
    if (isSuccess) {
      setCountdown(2);
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
  }, [isSuccess, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setLoading(true);
    try {
      await signup(name, email, password);
      // Immediately log out to clear cookies so the user has to sign in manually
      await fetch("/api/auth/logout", { method: "POST" });
      setIsSuccess(true);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.92 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="w-full p-8 md:p-10 rounded-3xl border border-outline-variant/15 bg-surface-container-high/60 dark:bg-surface-container-high/40 backdrop-blur-2xl shadow-xl space-y-6 text-center relative overflow-hidden transition-all duration-300"
      >
        <div className="flex flex-col items-center justify-center space-y-4 py-6">
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
            {/* Icon circle */}
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
            <h1 className="text-3xl font-extrabold text-on-surface tracking-tight mt-4">Account created! 🎉</h1>
            <p className="text-on-surface-variant text-sm font-medium max-w-xs mx-auto leading-relaxed">
              Your account has been created successfully. Redirecting you to the sign-in page...
            </p>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.55 }}
            className="w-full max-w-xs pt-4 mx-auto"
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
                transition={{ duration: 2, ease: "linear" }}
              />
            </div>
          </motion.div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="w-full p-8 md:p-10 rounded-3xl border border-outline-variant/15 bg-surface-container-high/60 dark:bg-surface-container-high/40 backdrop-blur-2xl shadow-xl space-y-8 relative overflow-hidden transition-all duration-300">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-extrabold text-on-surface tracking-tight">Create account</h1>
        <p className="text-on-surface-variant text-sm font-medium">Start visualizing your codebases</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-sm font-medium">{error}</div>
        )}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-on-surface-variant">Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)}
            className="w-full h-12 px-4 rounded-xl bg-surface-container-highest border border-outline-variant text-on-surface placeholder-on-surface-variant/60 outline-none focus:border-primary transition-colors text-sm" />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-on-surface-variant">Email</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full h-12 px-4 rounded-xl bg-surface-container-highest border border-outline-variant text-on-surface placeholder-on-surface-variant/60 outline-none focus:border-primary transition-colors text-sm" />
        </div>
        <PasswordInput label="Password" value={password} onChange={setPassword} required />
        <button type="submit" disabled={loading}
          className="w-full h-12 rounded-xl bg-gradient-to-r from-[#4a50c5] to-[#00b08a] text-white font-bold text-sm hover:shadow-lg active:scale-[0.98] transition-all disabled:opacity-50">
          {loading ? "Creating account..." : "Create account"}
        </button>
      </form>
      <div className="text-center text-sm text-on-surface-variant border-t border-outline-variant/15 pt-4">
        Already have an account?{" "}
        <button 
          onClick={() => setLoginModalOpen(true)}
          className="text-primary hover:underline font-bold bg-transparent border-none cursor-pointer"
        >
          Sign in
        </button>
      </div>
    </div>
  );
}
