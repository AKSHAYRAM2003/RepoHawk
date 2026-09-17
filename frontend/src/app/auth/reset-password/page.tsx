"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function ResetPasswordPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/auth/forgot-password");
  }, [router]);

  return (
    <div className="text-center space-y-4 py-8">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
      <p className="text-sm text-on-surface-variant">
        Redirecting to password reset...
      </p>
      <Link
        href="/auth/forgot-password"
        className="text-xs text-primary hover:underline font-medium"
      >
        Click here if you are not redirected
      </Link>
    </div>
  );
}