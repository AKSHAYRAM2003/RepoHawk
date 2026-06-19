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
  Plus,
  Sun,
  Moon,
} from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

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
  const { resolvedTheme, setTheme } = useTheme();
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
      className="relative flex flex-col border-r border-outline-variant bg-surface-low transition-all duration-300 ease-in-out"
      style={{ width: isCollapsed ? 64 : 256 }}
    >
      {/* Header */}
      <div
        className="h-14 flex items-center justify-between px-4 border-b border-outline-variant shrink-0"
      >
        {!isCollapsed && (
          <div className="flex items-center gap-2 min-w-0">
            {/* Logo mark */}
            <div
              className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: "var(--primary)", color: "var(--on-primary)" }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <span className="font-bold text-on-surface tracking-tight text-sm truncate">
              RepoHawk
            </span>
          </div>
        )}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1.5 rounded-lg text-on-surface-variant hover-surface transition-colors"
          style={{ marginLeft: isCollapsed ? "auto" : undefined, marginRight: isCollapsed ? "auto" : undefined }}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
        </button>
      </div>

      {/* Nav groups */}
      <div className="flex-1 overflow-y-auto py-3 scrollbar-hide">
        <nav className="space-y-5 px-2">
          {menuItems.map((group, gIdx) => (
            <div key={gIdx}>
              {!isCollapsed && (
                <div className="px-3 mb-1.5 text-[9px] uppercase font-extrabold tracking-[0.12em] text-on-surface-variant opacity-60">
                  {group.section}
                </div>
              )}
              <ul className="space-y-0.5">
                {group.items.map((item, iIdx) => {
                  const Icon = item.icon;
                  const isDisabled = !item.href && !item.action;

                  if (item.subItems) {
                    if (isCollapsed) {
                      return item.subItems.map((sub, sIdx) => {
                        const isSubActive = pathname === sub.href;
                        const SubIcon = sub.icon;
                        return (
                          <li key={`sub-col-${sIdx}`}>
                            <Link href={sub.href}>
                              <div 
                                title={sub.name}
                                className={`flex items-center justify-center py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                                  isSubActive 
                                    ? "active-primary" 
                                    : "text-on-surface-variant hover-surface"
                                }`}
                              >
                                <SubIcon size={17} className="flex-shrink-0" />
                              </div>
                            </Link>
                          </li>
                        );
                      });
                    }

                    return (
                      <li key={iIdx} className="space-y-0.5">
                        <button 
                          onClick={() => setIsMyReposOpen(!isMyReposOpen)}
                          className="w-full flex items-center px-3 py-2 rounded-xl text-sm font-medium transition-colors hover-surface text-on-surface-variant"
                        >
                          <Icon size={17} className="flex-shrink-0" />
                          <span className="ml-3 truncate">{item.name}</span>
                          <span className="ml-auto opacity-60">
                            {isMyReposOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                          </span>
                        </button>
                        
                        {isMyReposOpen && (
                          <ul className="pl-4 space-y-0.5 border-l ml-5" style={{ borderColor: "var(--outline-variant)" }}>
                            {item.subItems.map((sub, sIdx) => {
                              const isSubActive = pathname === sub.href;
                              const SubIcon = sub.icon;
                              return (
                                <li key={sIdx}>
                                  <Link href={sub.href}>
                                    <div className={`flex items-center px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
                                      isSubActive 
                                        ? "active-primary" 
                                        : "text-on-surface-variant hover-surface"
                                    }`}>
                                      <SubIcon size={13} className="flex-shrink-0" />
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

                  if (isDisabled) {
                    return (
                      <li key={iIdx}>
                        <div 
                          title="Select a workspace repository to access analysis context."
                          className={`flex items-center ${isCollapsed ? "justify-center px-0" : "px-3"} py-2 rounded-xl text-sm font-medium opacity-35 cursor-not-allowed text-on-surface-variant`}
                        >
                          <Icon size={17} className="flex-shrink-0" />
                          {!isCollapsed && <span className="ml-3 truncate">{item.name}</span>}
                        </div>
                      </li>
                    );
                  }

                  const isActive = !item.external && item.href && pathname === item.href;
                  return (
                    <li key={iIdx}>
                      {item.action ? (
                        <button className={`w-full flex items-center ${isCollapsed ? "justify-center px-0" : "px-3"} py-2 rounded-xl text-sm font-medium transition-colors hover-surface text-on-surface-variant`}>
                          <Icon size={17} className="flex-shrink-0" />
                          {!isCollapsed && <span className="ml-3 truncate">{item.name}</span>}
                        </button>
                      ) : (
                        <Link href={item.href || "#"}>
                          <div className={`flex items-center ${isCollapsed ? "justify-center px-0" : "px-3"} py-2 rounded-xl text-sm font-medium transition-all duration-150 ${
                            isActive 
                              ? "active-primary" 
                              : "text-on-surface-variant hover-surface"
                          }`}>
                            <Icon size={17} className="flex-shrink-0" />
                            {!isCollapsed && (
                              <>
                                <span className="ml-3 truncate">{item.name}</span>
                                {isActive && (
                                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-color" />
                                )}
                              </>
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

      {/* Bottom: Theme Toggle */}
      <div className="shrink-0 border-t border-outline-variant p-3">
        <button
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          title={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          className={`flex items-center gap-3 w-full rounded-xl py-2 px-3 text-on-surface-variant hover-surface transition-colors text-xs font-semibold`}
          style={isCollapsed ? { justifyContent: "center", padding: "8px 0" } : {}}
        >
          {resolvedTheme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          {!isCollapsed && (
            <span>{resolvedTheme === "dark" ? "Light Mode" : "Dark Mode"}</span>
          )}
        </button>
      </div>
    </aside>
  );
}
