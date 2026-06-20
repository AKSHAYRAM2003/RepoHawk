"use client";

import { useState, FormEvent, useEffect, use, Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PasswordInput from "@/components/auth/PasswordInput";

function ResetForm({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const router = useRouter();
  const params = use(searchParams);
  const token = (params?.token as string) || "";
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setRedirecting(true), 1200);
    const r = setTimeout(() => router.push("/auth/login"), 2200);
    return () => { clearTimeout(t); clearTimeout(r); };
  }, [success, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if ((password?.length ?? 0) < 6) { setError("Password must be at least 6 characters"); return; }
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
      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-extrabold text-on-surface tracking-tight">Invalid link</h1>
        <p className="text-on-surface-variant text-sm">This reset link is invalid or has expired.</p>
        <Link href="/auth/forgot-password" className="text-primary hover:underline font-medium text-sm">Request a new link</Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="w-full max-w-sm mx-auto text-center space-y-6">
        <div className="w-20 h-20 rounded-2xl border-2 border-emerald-500/30 bg-emerald-500/10 flex items-center justify-center mx-auto">
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h1 className="text-3xl font-extrabold text-on-surface tracking-tight">Completed</h1>
        <p className="text-on-surface-variant text-sm">Your password has been reset successfully.</p>
        {redirecting && (
          <p className="text-sm text-on-surface-variant/70 animate-pulse">Redirecting to Sign in page...</p>
        )}
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm mx-auto space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-extrabold text-on-surface tracking-tight">Set new password</h1>
        <p className="text-on-surface-variant text-sm">Enter your new password below</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-sm font-medium">{error}</div>
        )}
        <PasswordInput label="New password" value={password} onChange={setPassword} required />
        <button type="submit" disabled={loading}
          className="w-full h-12 rounded-xl bg-gradient-to-r from-[#4a50c5] to-[#00b08a] text-white font-bold text-sm hover:shadow-lg active:scale-[0.98] transition-all disabled:opacity-50">
          {loading ? "Resetting..." : "Reset password"}
        </button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  return (
    <Suspense fallback={<div className="text-center text-on-surface-variant">Loading...</div>}>
      <ResetForm searchParams={searchParams} />
    </Suspense>
  );
}
