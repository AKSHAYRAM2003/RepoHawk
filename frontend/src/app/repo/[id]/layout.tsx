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
    <div className="flex h-screen w-full bg-[#0a0a0a] text-slate-50 overflow-hidden">
      {/* LEFT PANE: Navigation & Context — hidden on mobile, visible md+ */}
      <div className="hidden md:flex flex-shrink-0">
        <RepoSidebar repoId={id} />
      </div>

      {/* CENTER PANE: The Canvas / Logs / Files — always full width on mobile */}
      <main className="flex-1 relative flex flex-col min-w-0 bg-[#0f0f11] shadow-inner dark:shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] overflow-hidden">
        {children}
      </main>

      {/* RIGHT PANE: Intelligence & Properties — hidden below xl */}
      <div className="hidden xl:flex flex-shrink-0">
        <PropertiesPanel repoId={id} />
      </div>
    </div>
  );
}
