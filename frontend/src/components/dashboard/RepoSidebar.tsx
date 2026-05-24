"use client";

import React, { useState, useEffect } from "react";
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
  ChevronRight,
  ChevronDown,
  Plus
} from "lucide-react";

interface RepoSidebarProps {
  repoId?: string;
}

interface SubMenuItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

interface MenuItem {
  name: string;
  href?: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  external?: boolean;
  action?: string;
  subItems?: SubMenuItem[];
}

interface MenuGroup {
  section: string;
  items: MenuItem[];
}

export default function RepoSidebar({ repoId }: RepoSidebarProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMyReposOpen, setIsMyReposOpen] = useState(true);
  const [activeRepoId, setActiveRepoId] = useState<string | undefined>(repoId);

  // Sync or retrieve last active repository ID from local storage
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (repoId) {
        localStorage.setItem("repohawk_last_active_repo", repoId);
        setActiveRepoId(repoId);
      } else {
        const lastId = localStorage.getItem("repohawk_last_active_repo");
        if (lastId) {
          setActiveRepoId(lastId);
        }
      }
    }
  }, [repoId]);

  const menuItems: MenuGroup[] = [
    { section: "Overview", items: [
      { 
        name: "My Repositories", 
        icon: FolderGit2,
        subItems: [
          { name: "Dashboard", href: "/dashboard", icon: FolderGit2 },
          { name: "New Repo", href: "/new-repo", icon: Plus }
        ]
      },
      { name: "Global Search", href: "#", icon: Search, action: "cmd-k" }
    ]},
    {
      section: "Analysis Context", items: [
        { name: "Architecture Canvas", href: activeRepoId ? `/repo/${activeRepoId}` : undefined, icon: Map },
        { name: "Source Files", href: activeRepoId ? `/repo/${activeRepoId}/files` : undefined, icon: FileCode2 },
        { name: "Dependencies", href: activeRepoId ? `/repo/${activeRepoId}/dependencies` : undefined, icon: PackageCheck },
        { name: "Pipeline Logs", href: activeRepoId ? `/repo/${activeRepoId}/logs` : undefined, icon: TerminalSquare }
      ]
    },
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
                  const Icon = item.icon;
                  const isDisabled = !item.href && !item.action;

                  if (item.subItems) {
                    if (isCollapsed) {
                      // Collapsed view: Render sub-items directly
                      return item.subItems.map((sub, sIdx) => {
                        const isSubActive = pathname === sub.href;
                        const SubIcon = sub.icon;
                        return (
                          <li key={`sub-col-${sIdx}`}>
                            <Link href={sub.href}>
                              <div 
                                title={sub.name}
                                className={`flex items-center justify-center py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                                  isSubActive 
                                    ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' 
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50'
                                }`}
                              >
                                <SubIcon size={18} className="flex-shrink-0" />
                              </div>
                            </Link>
                          </li>
                        );
                      });
                    }

                    // Expanded view: Accordion dropdown
                    return (
                      <li key={iIdx} className="space-y-1">
                        <button 
                          onClick={() => setIsMyReposOpen(!isMyReposOpen)}
                          className="w-full flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-slate-200/50 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-400"
                        >
                          <Icon size={18} className="flex-shrink-0 text-slate-500" />
                          <span className="ml-3 truncate">{item.name}</span>
                          <span className="ml-auto">
                            {isMyReposOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </span>
                        </button>
                        
                        {isMyReposOpen && (
                          <ul className="pl-4 space-y-1 border-l border-slate-200 dark:border-slate-800/80 ml-5">
                            {item.subItems.map((sub, sIdx) => {
                              const isSubActive = pathname === sub.href;
                              const SubIcon = sub.icon;
                              return (
                                <li key={sIdx}>
                                  <Link href={sub.href}>
                                    <div className={`flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-205 ${
                                      isSubActive 
                                        ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' 
                                        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50'
                                    }`}>
                                      <SubIcon size={14} className="flex-shrink-0" />
                                      <span className="ml-2.5 truncate">{sub.name}</span>
                                    </div>
                                  </Link>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </li>
                    );
                  }

                  // Disabled item logic
                  if (isDisabled) {
                    return (
                      <li key={iIdx}>
                        <div 
                          title="Select a workspace repository to access analysis context."
                          className={`flex items-center ${isCollapsed ? 'justify-center px-0' : 'px-3'} py-2 rounded-lg text-sm font-medium opacity-40 cursor-not-allowed text-slate-400 dark:text-slate-600`}
                        >
                          <Icon size={18} className="flex-shrink-0" />
                          {!isCollapsed && <span className="ml-3 truncate">{item.name}</span>}
                        </div>
                      </li>
                    );
                  }

                  // Normal active items
                  const isActive = !item.external && item.href && pathname === item.href;
                  return (
                    <li key={iIdx}>
                      {item.action ? (
                        <button className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'px-3'} py-2 rounded-lg text-sm font-medium transition-colors hover:bg-slate-200/50 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-400`}>
                          <Icon size={18} className="flex-shrink-0" />
                          {!isCollapsed && <span className="ml-3 truncate">{item.name}</span>}
                        </button>
                      ) : (
                        <Link href={item.href || "#"}>
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
