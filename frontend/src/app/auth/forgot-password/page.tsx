"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
      setSent(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="w-full max-w-sm mx-auto space-y-6 text-center">
        <h1 className="text-3xl font-extrabold text-on-surface tracking-tight">Check your email</h1>
        <p className="text-on-surface-variant text-sm">If that email is registered, we&apos;ve sent a password reset link.</p>
        <Link href="/auth/login" className="inline-block text-primary hover:underline font-medium text-sm">Back to sign in</Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm mx-auto space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-extrabold text-on-surface tracking-tight">Reset password</h1>
        <p className="text-on-surface-variant text-sm">Enter your email and we&apos;ll send you a reset link</p>
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
        <button type="submit" disabled={loading}
          className="w-full h-12 rounded-xl bg-gradient-to-r from-[#4a50c5] to-[#00b08a] text-white font-bold text-sm hover:shadow-lg active:scale-[0.98] transition-all disabled:opacity-50">
          {loading ? "Sending..." : "Send reset link"}
        </button>
      </form>
      <p className="text-center text-sm text-on-surface-variant">
        <Link href="/auth/login" className="text-primary hover:underline font-medium">Back to sign in</Link>
      </p>
    </div>
  );
}
