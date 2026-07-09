"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import PasswordInput from "@/components/auth/PasswordInput";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full p-8 md:p-10 rounded-3xl border border-outline-variant/15 bg-surface-container-high/60 dark:bg-surface-container-high/40 backdrop-blur-2xl shadow-xl space-y-8 relative overflow-hidden transition-all duration-300">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-extrabold text-on-surface tracking-tight">Welcome back</h1>
        <p className="text-on-surface-variant text-sm font-medium">Sign in to your RepoHawk account</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-sm font-medium">{error}</div>
        )}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-on-surface-variant">Email</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full h-12 px-4 rounded-xl bg-surface-container-highest border border-outline-variant text-on-surface placeholder-on-surface-variant/60 outline-none focus:border-primary transition-colors text-sm" />
        </div>
        <PasswordInput label="Password" value={password} onChange={setPassword} placeholder="Enter your password" required />
        <button type="submit" disabled={loading}
          className="w-full h-12 rounded-xl bg-gradient-to-r from-[#4a50c5] to-[#00b08a] text-white font-bold text-sm hover:shadow-lg active:scale-[0.98] transition-all disabled:opacity-50">
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
      <div className="text-center text-sm space-y-3 border-t border-outline-variant/15 pt-4">
        <div>
          <Link href="/auth/forgot-password" className="text-primary hover:underline font-semibold">Forgot password?</Link>
        </div>
        <p className="text-on-surface-variant">Don&apos;t have an account? <Link href="/auth/signup" className="text-primary hover:underline font-bold">Sign up</Link></p>
      </div>
    </div>
  );
}
