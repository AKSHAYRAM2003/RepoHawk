import { ReactNode } from "react";
import RepoSidebar from "@/components/dashboard/RepoSidebar";
import ProtectedRoute from "@/components/auth/ProtectedRoute";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute>
      <div className="flex h-screen w-full bg-surface text-on-surface overflow-hidden">
        <RepoSidebar />
        <main className="flex-1 relative flex flex-col min-w-0 overflow-y-auto bg-surface">
          {children}
        </main>
      </div>
    </ProtectedRoute>
  );
}
