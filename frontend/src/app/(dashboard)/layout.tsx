import { ReactNode } from "react";
import RepoSidebar from "@/components/dashboard/RepoSidebar";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen w-full bg-surface text-on-surface overflow-hidden">
      {/* LEFT PANE: Navigation & Context */}
      <RepoSidebar />

      {/* CENTER PANE: The Dashboard/Form Content */}
      <main className="flex-1 relative flex flex-col min-w-0 overflow-y-auto bg-surface">
        {children}
      </main>
    </div>
  );
}
