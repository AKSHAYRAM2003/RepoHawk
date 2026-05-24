import React from "react";
import RepoSidebar from "@/components/dashboard/RepoSidebar";
import PropertiesPanel from "@/components/dashboard/PropertiesPanel";

export default function RepoDashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = React.use(params);

  return (
    <div className="flex h-screen w-full bg-slate-50 dark:bg-[#0a0a0a] text-slate-900 dark:text-slate-50 overflow-hidden">
      {/* LEFT PANE: Navigation & Context */}
      <RepoSidebar repoId={id} />

      {/* CENTER PANE: The Canvas / Logs / Files */}
      <main className="flex-1 relative flex flex-col min-w-0 bg-white dark:bg-[#0f0f11] shadow-inner dark:shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]">
        {children}
      </main>

      {/* RIGHT PANE: Intelligence & Properties */}
      <PropertiesPanel repoId={id} />
    </div>
  );
}
