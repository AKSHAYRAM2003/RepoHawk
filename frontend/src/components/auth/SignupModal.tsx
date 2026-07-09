"use client";

import { useState, FormEvent, useEffect, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import PasswordInput from "@/components/auth/PasswordInput";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Step = "form" | "success" | "login";

export default function SignupModal() {
  const { isSignupModalOpen, setSignupModalOpen, login } = useAuth();

  // Signup state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signupError, setSignupError] = useState("");
  const [signupLoading, setSignupLoading] = useState(false);

  // Login state (inline after success)
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [step, setStep] = useState<Step>("form");
  const [registeredEmail, setRegisteredEmail] = useState("");

  // Countdown for success redirect
  const [countdown, setCountdown] = useState(3);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset all state when modal closes
  useEffect(() => {
    if (!isSignupModalOpen) {
      setTimeout(() => {
        setStep("form");
        setName("");
        setEmail("");
        setPassword("");
        setSignupError("");
        setLoginPassword("");
        setLoginError("");
        setCountdown(3);
      }, 300);
    }
  }, [isSignupModalOpen]);

  // Countdown timer on success step
  useEffect(() => {
    if (step === "success") {
      setCountdown(3);
      countdownRef.current = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            clearInterval(countdownRef.current!);
            setStep("login");
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    }
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [step]);

  if (!isSignupModalOpen) return null;

  const handleSignup = async (e: FormEvent) => {
    e.preventDefault();
    setSignupError("");
    if (password.length < 6) {
      setSignupError("Password must be at least 6 characters");
      return;
    }
    setSignupLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Registration failed");

      // Logout immediately so user signs in fresh
      await fetch("/api/auth/logout", { method: "POST" });

      setRegisteredEmail(email);
      setStep("success");
    } catch (err: any) {
      setSignupError(err.message);
    } finally {
      setSignupLoading(false);
    }
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);
    try {
      await login(registeredEmail, loginPassword);
      // login() in AuthContext handles router.push("/dashboard") and setUser
      setSignupModalOpen(false);
    } catch (err: any) {
      setLoginError(err.message);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleClose = () => {
    setSignupModalOpen(false);
  };

  const handleSignupRedirect = () => {
    // Already on signup — no-op, but close modal
    setSignupModalOpen(false);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={step !== "success" ? handleClose : undefined}
          className="fixed inset-0 bg-black/60 backdrop-blur-md"
        />

        {/* Modal Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="relative w-full max-w-md rounded-3xl border border-outline-variant/15 bg-surface-container-high/95 dark:bg-surface-container-high/90 shadow-2xl backdrop-blur-2xl z-10 overflow-hidden"
        >
          {/* Close button — hidden during success */}
          {step !== "success" && (
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 p-2 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-outline-variant/10 transition-all z-10"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          )}

          <AnimatePresence mode="wait">
            {/* ── STEP: SIGNUP FORM ── */}
            {step === "form" && (
              <motion.div
                key="form"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.22 }}
                className="p-8 md:p-10 space-y-6"
              >
                <div className="text-center space-y-2">
                  <h2 className="text-3xl font-extrabold text-on-surface tracking-tight">
                    Create account
                  </h2>
                  <p className="text-on-surface-variant text-sm font-medium">
                    Start visualizing your codebases
                  </p>
                </div>

                <form onSubmit={handleSignup} className="space-y-4">
                  {signupError && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-sm font-medium">
                      {signupError}
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-on-surface-variant">
                      Name
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full h-12 px-4 rounded-xl bg-surface-container-highest border border-outline-variant text-on-surface placeholder-on-surface-variant/60 outline-none focus:border-primary transition-colors text-sm"
                      placeholder="Your Name"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-on-surface-variant">
                      Email
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full h-12 px-4 rounded-xl bg-surface-container-highest border border-outline-variant text-on-surface placeholder-on-surface-variant/60 outline-none focus:border-primary transition-colors text-sm"
                      placeholder="you@example.com"
                    />
                  </div>
                  <PasswordInput
                    label="Password"
                    value={password}
                    onChange={setPassword}
                    placeholder="Create a password"
                    required
                  />

                  <button
                    type="submit"
                    disabled={signupLoading}
                    className="w-full h-12 rounded-xl bg-gradient-to-r from-[#4a50c5] to-[#00b08a] text-white font-bold text-sm hover:shadow-lg active:scale-[0.98] transition-all disabled:opacity-50 mt-2"
                  >
                    {signupLoading ? "Creating account..." : "Create account"}
                  </button>
                </form>

                <div className="text-center text-sm border-t border-outline-variant/15 pt-4 space-y-3">
                  <p className="text-on-surface-variant">
                    Already have an account?{" "}
                    <button
                      onClick={handleClose}
                      className="text-primary hover:underline font-bold bg-transparent border-none cursor-pointer"
                    >
                      Sign in
                    </button>
                  </p>
                  <Link
                    href="/"
                    onClick={handleClose}
                    className="inline-flex items-center gap-1.5 text-xs text-on-surface-variant/70 hover:text-on-surface-variant transition-colors"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 12H5M12 5l-7 7 7 7" />
                    </svg>
                    Back to home
                  </Link>
                </div>
              </motion.div>
            )}

            {/* ── STEP: SUCCESS ── */}
            {step === "success" && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="p-8 md:p-12 flex flex-col items-center justify-center gap-5 text-center"
              >
                {/* Animated green checkmark ring */}
                <div className="relative flex items-center justify-center">
                  {/* Outer glow ring */}
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.1, duration: 0.4, ease: "easeOut" }}
                    className="absolute w-24 h-24 rounded-full bg-emerald-500/10"
                  />
                  {/* Inner circle */}
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{
                      delay: 0.15,
                      duration: 0.35,
                      type: "spring",
                      stiffness: 200,
                    }}
                    className="relative w-20 h-20 rounded-full bg-emerald-500/15 border-2 border-emerald-500/40 flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.25)]"
                  >
                    {/* SVG animated checkmark */}
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
                        transition={{ delay: 0.35, duration: 0.5, ease: "easeOut" }}
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
                  <h2 className="text-2xl font-extrabold text-on-surface tracking-tight">
                    Account Created! 🎉
                  </h2>
                  <p className="text-on-surface-variant text-sm leading-relaxed max-w-xs mx-auto">
                    Welcome aboard,{" "}
                    <span className="text-on-surface font-semibold">{name}</span>!
                    <br />
                    Taking you to sign in...
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
                        setStep("login");
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
            )}

            {/* ── STEP: INLINE LOGIN ── */}
            {step === "login" && (
              <motion.div
                key="login"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.22 }}
                className="p-8 md:p-10 space-y-6"
              >
                <div className="text-center space-y-2">
                  {/* Small success pill */}
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-500 text-xs font-semibold mb-1">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Account ready
                  </div>
                  <h2 className="text-3xl font-extrabold text-on-surface tracking-tight">
                    Sign in
                  </h2>
                  <p className="text-on-surface-variant text-sm font-medium">
                    Enter your password to continue
                  </p>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                  {loginError && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-sm font-medium">
                      {loginError}
                    </div>
                  )}

                  {/* Email display (read-only) */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-on-surface-variant">
                      Email
                    </label>
                    <div className="w-full h-12 px-4 rounded-xl bg-surface-container-highest/50 border border-outline-variant/50 text-on-surface-variant text-sm flex items-center gap-2">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-500 shrink-0">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span className="truncate">{registeredEmail}</span>
                    </div>
                  </div>

                  <PasswordInput
                    label="Password"
                    value={loginPassword}
                    onChange={setLoginPassword}
                    placeholder="Enter your password"
                    required
                  />

                  <button
                    type="submit"
                    disabled={loginLoading}
                    className="w-full h-12 rounded-xl bg-gradient-to-r from-[#4a50c5] to-[#00b08a] text-white font-bold text-sm hover:shadow-lg active:scale-[0.98] transition-all disabled:opacity-50 mt-2"
                  >
                    {loginLoading ? "Signing in..." : "Sign in to RepoHawk →"}
                  </button>
                </form>

                <div className="text-center text-sm border-t border-outline-variant/15 pt-4">
                  <p className="text-on-surface-variant">
                    Not {registeredEmail}?{" "}
                    <button
                      onClick={() => setStep("form")}
                      className="text-primary hover:underline font-bold bg-transparent border-none cursor-pointer"
                    >
                      Go back
                    </button>
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
