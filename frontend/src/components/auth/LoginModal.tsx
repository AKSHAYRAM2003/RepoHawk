"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import PasswordInput from "@/components/auth/PasswordInput";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function LoginModal() {
  const { isLoginModalOpen, setLoginModalOpen, setSignupModalOpen, login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isLoginModalOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      setLoginModalOpen(false);
      setEmail("");
      setPassword("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setLoginModalOpen(false);
    setError("");
    setEmail("");
    setPassword("");
  };

  const handleSignupRedirect = () => {
    setLoginModalOpen(false);
    setSignupModalOpen(true);
  };

  const handleForgotPasswordRedirect = () => {
    setLoginModalOpen(false);
    router.push("/auth/forgot-password");
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-md"
        />

        {/* Modal Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="relative w-full max-w-md p-8 md:p-10 rounded-3xl border border-outline-variant/15 bg-surface-container-high/95 dark:bg-surface-container-high/90 shadow-2xl backdrop-blur-2xl space-y-6 z-10 overflow-hidden"
        >
          {/* Top Corner Close Button */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-2 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-outline-variant/10 transition-all"
            aria-label="Close"
          >
            <X size={20} />
          </button>

          {/* Heading */}
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-extrabold text-on-surface tracking-tight">Welcome back</h2>
            <p className="text-on-surface-variant text-sm font-medium">Sign in to your RepoHawk account</p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-sm font-medium">
                {error}
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-on-surface-variant">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-12 px-4 rounded-xl bg-surface-container-highest border border-outline-variant text-on-surface placeholder-on-surface-variant/60 outline-none focus:border-primary transition-colors text-sm"
                placeholder="you@example.com"
              />
            </div>
            <PasswordInput label="Password" value={password} onChange={setPassword} placeholder="Enter your password" required />
            
            <div className="text-right">
              <button
                type="button"
                onClick={handleForgotPasswordRedirect}
                className="text-sm text-primary hover:underline font-medium bg-transparent border-none cursor-pointer"
              >
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-[#4a50c5] to-[#00b08a] text-white font-bold text-sm hover:shadow-lg active:scale-[0.98] transition-all disabled:opacity-50 mt-2"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          {/* Footer Navigation */}
          <div className="text-center text-sm border-t border-outline-variant/15 pt-4 space-y-3">
            <p className="text-on-surface-variant">
              Don&apos;t have an account?{" "}
              <button
                onClick={handleSignupRedirect}
                className="text-primary hover:underline font-bold bg-transparent border-none cursor-pointer"
              >
                Sign up
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
      </div>
    </AnimatePresence>
  );
}
