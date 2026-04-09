import { ReactNode } from "react";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-50">
      {/* Sidebar Placeholder */}
      <aside className="w-64 border-r border-slate-800 bg-slate-950 p-4">
        <div className="text-xl font-bold tracking-tighter text-blue-500 mb-8">RepoHawk</div>
        <nav className="space-y-2">
          <a href="/dashboard" className="block p-2 rounded hover:bg-slate-900 transition-colors">Dashboard</a>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        {children}
      </main>
    </div>
  );
}
