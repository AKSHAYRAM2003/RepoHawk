import { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen w-full flex-col bg-surface text-on-surface antialiased selection:bg-primary selection:text-on-primary font-sans">
      <div className="pointer-events-none fixed -top-40 left-1/4 h-[600px] w-[600px] rounded-full bg-primary/10 blur-[120px]" />
      <div className="pointer-events-none fixed top-1/3 right-0 h-[400px] w-[400px] rounded-full bg-secondary/8 blur-[120px]" />
      <div className="flex items-center justify-center flex-1 p-4">
        <div className="w-full max-w-sm space-y-6">{children}</div>
      </div>
    </div>
  );
}
