"use client";

import { useState, FormEvent, useRef } from "react";
import Link from "next/link";
import { useSignUp } from "@clerk/nextjs/legacy";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Step = "details" | "verify";

function OtpInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(6, " ").split("").slice(0, 6);

  const handleKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      const next = digits.map((d, idx) => (idx === i ? " " : d)).join("").trimEnd();
      onChange(next);
      if (i > 0) refs.current[i - 1]?.focus();
    }
  };

  const handleChange = (i: number, char: string) => {
    const d = char.replace(/\D/, "");
    if (!d) return;
    const next = digits.map((old, idx) => (idx === i ? d : old)).join("").replace(/ /g, "");
    onChange(next);
    if (i < 5) refs.current[i + 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const paste = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (paste) { onChange(paste); refs.current[Math.min(paste.length, 5)]?.focus(); }
    e.preventDefault();
  };

  return (
    <div className="flex gap-2 justify-center">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d.trim()}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKey(i, e)}
          onPaste={handlePaste}
          className="w-11 h-13 text-center text-xl font-bold rounded-xl bg-surface-container-highest border border-outline-variant text-on-surface outline-none focus:border-primary transition-colors"
          style={{ height: "52px" }}
        />
      ))}
    </div>
  );
}

export default function SignupPage() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const router = useRouter();

  const [step, setStep] = useState<Step>("details");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"oauth_google" | "oauth_github" | null>(null);

  const handleDetails = async (e: FormEvent) => {
    e.preventDefault();
    if (!isLoaded) return;
    setError("");
    setLoading(true);
    try {
      await signUp.create({ firstName, lastName, emailAddress: email, password });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setStep("verify");
    } catch (err: any) {
      setError(err.errors?.[0]?.longMessage || err.errors?.[0]?.message || "Sign up failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: FormEvent) => {
    e.preventDefault();
    if (!isLoaded) return;
    setError("");
    setLoading(true);
    try {
      const result = await signUp.attemptEmailAddressVerification({ code });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.push("/");
      }
    } catch (err: any) {
      setError(err.errors?.[0]?.longMessage || err.errors?.[0]?.message || "Invalid code.");
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (strategy: "oauth_google" | "oauth_github") => {
    if (!isLoaded || oauthLoading) return;
    setOauthLoading(strategy);
    try {
      await signUp.authenticateWithRedirect({
        strategy,
        redirectUrl: "/auth/sso-callback",
        redirectUrlComplete: "/",
      });
    } catch (err: any) {
      setError(err.errors?.[0]?.longMessage || err.errors?.[0]?.message || "Social sign up failed.");
      setOauthLoading(null);
    }
  };

  return (
    <AnimatePresence mode="wait">
      {step === "details" ? (
        <motion.div
          key="details"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="space-y-6"
        >
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-extrabold text-on-surface tracking-tight">Create account</h1>
            <p className="text-on-surface-variant text-sm">Start analyzing codebases instantly</p>
          </div>

          {/* Social OAuth */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleOAuth("oauth_google")}
              disabled={!!oauthLoading || !isLoaded}
              className="h-11 flex items-center justify-center gap-2.5 rounded-xl border border-outline-variant/40 hover:border-primary/30 bg-surface-container-highest/50 hover:bg-surface-container-highest transition-all text-sm font-semibold text-on-surface disabled:opacity-50"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              {oauthLoading === "oauth_google" ? "..." : "Google"}
            </button>

            <button
              type="button"
              onClick={() => handleOAuth("oauth_github")}
              disabled={!!oauthLoading || !isLoaded}
              className="h-11 flex items-center justify-center gap-2.5 rounded-xl border border-outline-variant/40 hover:border-primary/30 bg-surface-container-highest/50 hover:bg-surface-container-highest transition-all text-sm font-semibold text-on-surface disabled:opacity-50"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-on-surface">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
              </svg>
              {oauthLoading === "oauth_github" ? "..." : "GitHub"}
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-outline-variant/20" />
            <span className="text-xs text-on-surface-variant font-medium">or</span>
            <div className="flex-1 h-px bg-outline-variant/20" />
          </div>

          <form onSubmit={handleDetails} className="space-y-4">
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-sm font-medium"
              >
                {error}
              </motion.div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-on-surface-variant">First name</label>
                <input
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Ada"
                  className="w-full h-12 px-4 rounded-xl bg-surface-container-highest border border-outline-variant text-on-surface placeholder-on-surface-variant/50 outline-none focus:border-primary transition-colors text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-on-surface-variant">Last name</label>
                <input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Lovelace"
                  className="w-full h-12 px-4 rounded-xl bg-surface-container-highest border border-outline-variant text-on-surface placeholder-on-surface-variant/50 outline-none focus:border-primary transition-colors text-sm"
                />
              </div>
            </div>

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

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-on-surface-variant">Password</label>
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

            {/* Clerk Smart CAPTCHA Widget Container */}
            <div id="clerk-captcha" className="flex justify-center" />

            <button
              type="submit"
              disabled={loading || !isLoaded}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-[#4a50c5] to-[#00b08a] text-white font-bold text-sm hover:shadow-lg active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>

          <p className="text-center text-sm text-on-surface-variant border-t border-outline-variant/15 pt-4">
            Already have an account?{" "}
            <Link href="/auth/login" className="text-primary font-semibold hover:underline">
              Sign in
            </Link>
          </p>
        </motion.div>
      ) : (
        <motion.div
          key="verify"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="space-y-6"
        >
          <div className="text-center space-y-1">
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-[0_0_20px_rgba(74,80,197,0.15)]">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                  <rect width="20" height="16" x="2" y="4" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
              </div>
            </div>
            <h1 className="text-2xl font-extrabold text-on-surface tracking-tight">Check your email</h1>
            <p className="text-on-surface-variant text-sm">
              We sent a 6-digit code to <span className="text-on-surface font-semibold">{email}</span>
            </p>
          </div>

          <form onSubmit={handleVerify} className="space-y-5">
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-sm font-medium"
              >
                {error}
              </motion.div>
            )}

            <OtpInput value={code} onChange={setCode} />

            <button
              type="submit"
              disabled={loading || code.length < 6 || !isLoaded}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-[#4a50c5] to-[#00b08a] text-white font-bold text-sm hover:shadow-lg active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {loading ? "Verifying..." : "Verify email"}
            </button>
          </form>

          <div className="text-center text-sm border-t border-outline-variant/15 pt-4 space-y-2">
            <button
              onClick={() => { setStep("details"); setError(""); setCode(""); }}
              className="text-on-surface-variant hover:text-primary transition-colors font-medium"
            >
              ← Change email
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
