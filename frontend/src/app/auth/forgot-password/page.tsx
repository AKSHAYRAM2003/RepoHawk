"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useSignIn } from "@clerk/nextjs/legacy";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, KeyRound, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Step = "email" | "code" | "success";

export default function ForgotPasswordPage() {
  const { isLoaded, signIn, setActive } = useSignIn();
  const router = useRouter();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Step 1: Send reset code to email
  const handleSendCode = async (e: FormEvent) => {
    e.preventDefault();
    if (!isLoaded) return;
    setError("");
    setLoading(true);

    try {
      await signIn.create({
        strategy: "reset_password_email_code",
        identifier: email,
      });
      setStep("code");
    } catch (err: any) {
      setError(err.errors?.[0]?.longMessage || err.errors?.[0]?.message || "Could not send reset code.");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify code and set new password
  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!isLoaded) return;
    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const result = await signIn.attemptFirstFactor({
        strategy: "reset_password_email_code",
        code,
        password,
      });

      if (result.status === "complete") {
        if (result.createdSessionId) {
          await setActive({ session: result.createdSessionId });
        }
        setStep("success");
      } else {
        setError("Password reset incomplete. Please check your inputs.");
      }
    } catch (err: any) {
      setError(err.errors?.[0]?.longMessage || err.errors?.[0]?.message || "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence mode="wait">
      {/* ── STEP 1: ENTER EMAIL ── */}
      {step === "email" && (
        <motion.div
          key="email"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="space-y-6"
        >
          <div className="flex justify-center">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-[0_0_20px_rgba(74,80,197,0.15)] text-primary">
              <KeyRound size={26} />
            </div>
          </div>

          <div className="text-center space-y-1">
            <h1 className="text-2xl font-extrabold text-on-surface tracking-tight">Forgot password?</h1>
            <p className="text-on-surface-variant text-sm">Enter your email and we'll send you a reset code</p>
          </div>

          <form onSubmit={handleSendCode} className="space-y-4">
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
              <label className="text-sm font-semibold text-on-surface-variant">Email</label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full h-12 px-4 rounded-xl bg-surface-container-highest border border-outline-variant text-on-surface placeholder-on-surface-variant/50 outline-none focus:border-primary transition-colors text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !isLoaded}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-[#4a50c5] to-[#00b08a] text-white font-bold text-sm hover:shadow-lg active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {loading ? "Sending code..." : "Send reset code"}
            </button>
          </form>

          <p className="text-center text-sm text-on-surface-variant border-t border-outline-variant/15 pt-4">
            Remember your password?{" "}
            <Link href="/auth/login" className="text-primary font-semibold hover:underline">
              Back to sign in
            </Link>
          </p>
        </motion.div>
      )}

      {/* ── STEP 2: ENTER CODE & NEW PASSWORD ── */}
      {step === "code" && (
        <motion.div
          key="code"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="space-y-6"
        >
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-extrabold text-on-surface tracking-tight">Reset your password</h1>
            <p className="text-on-surface-variant text-sm">
              We sent a verification code to <span className="text-on-surface font-semibold">{email}</span>
            </p>
          </div>

          <form onSubmit={handleResetPassword} className="space-y-4">
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
              <label className="text-sm font-semibold text-on-surface-variant">Verification code</label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.trim())}
                placeholder="Enter 6-digit code"
                className="w-full h-12 px-4 rounded-xl bg-surface-container-highest border border-outline-variant text-on-surface placeholder-on-surface-variant/50 outline-none focus:border-primary transition-colors text-sm font-mono tracking-wider"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-on-surface-variant">New password</label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="w-full h-12 px-4 pr-11 rounded-xl bg-surface-container-highest border border-outline-variant text-on-surface placeholder-on-surface-variant/50 outline-none focus:border-primary transition-colors text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface transition-colors"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-on-surface-variant">Confirm new password</label>
              <div className="relative">
                <input
                  type={showConfirmPass ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                  className="w-full h-12 px-4 pr-11 rounded-xl bg-surface-container-highest border border-outline-variant text-on-surface placeholder-on-surface-variant/50 outline-none focus:border-primary transition-colors text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPass(!showConfirmPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface transition-colors"
                >
                  {showConfirmPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !isLoaded}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-[#4a50c5] to-[#00b08a] text-white font-bold text-sm hover:shadow-lg active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {loading ? "Resetting password..." : "Reset password"}
            </button>
          </form>

          <div className="text-center text-sm border-t border-outline-variant/15 pt-4">
            <button
              type="button"
              onClick={() => { setStep("email"); setError(""); }}
              className="text-on-surface-variant hover:text-primary transition-colors font-medium"
            >
              ← Back to change email
            </button>
          </div>
        </motion.div>
      )}

      {/* ── STEP 3: SUCCESS ── */}
      {step === "success" && (
        <motion.div
          key="success"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.25 }}
          className="text-center space-y-5 py-2"
        >
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center shadow-[0_0_25px_rgba(16,185,129,0.15)] text-emerald-500">
              <CheckCircle2 size={32} />
            </div>
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl font-extrabold text-on-surface tracking-tight">Password reset complete</h1>
            <p className="text-on-surface-variant text-sm">Your password has been successfully updated.</p>
          </div>

          <button
            onClick={() => router.push("/")}
            className="w-full h-12 rounded-xl bg-gradient-to-r from-[#4a50c5] to-[#00b08a] text-white font-bold text-sm hover:shadow-lg active:scale-[0.98] transition-all"
          >
            Continue to RepoHawk
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
