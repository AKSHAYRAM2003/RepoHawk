import { ReactNode } from "react";
import RepoSidebar from "@/components/dashboard/RepoSidebar";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen w-full bg-slate-50 dark:bg-[#0a0a0a] text-slate-900 dark:text-slate-50 overflow-hidden">
      {/* LEFT PANE: Navigation & Context */}
      <RepoSidebar />

      {/* CENTER PANE: The Dashboard/Form Content */}
      <main className="flex-1 relative flex flex-col min-w-0 bg-white dark:bg-[#0f0f11] shadow-inner dark:shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]">
        {children}
      </main>
    </div>
  );
}
