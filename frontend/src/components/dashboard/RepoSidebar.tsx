"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  FolderGit2, 
  Search, 
  Map, 
  FileCode2, 
  PackageCheck, 
  TerminalSquare, 
  Settings, 
  ChevronLeft,
  ChevronRight
} from "lucide-react";

interface RepoSidebarProps {
  repoId: string;
}

export default function RepoSidebar({ repoId }: RepoSidebarProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const menuItems = [
    { section: "Overview", items: [
      { name: "My Repositories", href: "/dashboard", icon: FolderGit2, external: true },
      { name: "Global Search", href: "#", icon: Search, action: "cmd-k" }
    ]},
    { section: "Analysis Context", items: [
      { name: "Architecture Canvas", href: `/repo/${repoId}`, icon: Map },
      { name: "Source Files", href: `/repo/${repoId}/files`, icon: FileCode2 },
      { name: "Dependencies", href: `/repo/${repoId}/dependencies`, icon: PackageCheck },
      { name: "Pipeline Logs", href: `/repo/${repoId}/logs`, icon: TerminalSquare }
    ]},
    { section: "Utilities", items: [
      { name: "Settings", href: `/settings`, icon: Settings, external: true }
    ]}
  ];

  return (
    <aside 
      className={`relative flex flex-col border-r border-slate-200 dark:border-slate-800/50 bg-slate-50 dark:bg-[#0a0a0a] transition-all duration-300 ease-in-out ${isCollapsed ? 'w-16' : 'w-64'}`}
    >
      {/* Header section */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-slate-200 dark:border-slate-800/50">
        {!isCollapsed && (
          <span className="font-semibold text-slate-800 dark:text-slate-200 tracking-tight text-sm truncate">
            RepoHawk Workspace
          </span>
        )}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors ${isCollapsed ? 'mx-auto' : ''}`}
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Nav groups */}
      <div className="flex-1 overflow-y-auto py-4 scrollbar-hide">
        <nav className="space-y-6 px-2">
          {menuItems.map((group, gIdx) => (
            <div key={gIdx}>
              {!isCollapsed && (
                <div className="px-3 mb-2 text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">
                  {group.section}
                </div>
              )}
              <ul className="space-y-1">
                {group.items.map((item, iIdx) => {
                  // Determine exactly active or not (ignoring external links like /dashboard from /repo/xxx)
                  const isActive = !item.external && pathname === item.href;
                  const Icon = item.icon;

                  return (
                    <li key={iIdx}>
                      {item.action ? (
                        <button className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'px-3'} py-2 rounded-lg text-sm font-medium transition-colors hover:bg-slate-200/50 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-400`}>
                          <Icon size={18} className="flex-shrink-0" />
                          {!isCollapsed && <span className="ml-3 truncate">{item.name}</span>}
                        </button>
                      ) : (
                        <Link href={item.href}>
                          <div className={`flex items-center ${isCollapsed ? 'justify-center px-0' : 'px-3'} py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                            isActive 
                              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' 
                              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50'
                          }`}>
                            <Icon size={18} className="flex-shrink-0" />
                            {!isCollapsed && <span className="ml-3 truncate">{item.name}</span>}
                            {isActive && !isCollapsed && (
                              <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                            )}
                          </div>
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </div>
    </aside>
  );
}
