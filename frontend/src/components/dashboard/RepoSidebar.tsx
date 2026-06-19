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
      { name: "Settings", href: `/settings`, icon: Settings }
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
          <div className="flex items-center gap-1 text-on-surface">
            <div className="h-9 w-auto text-primary">
              <svg
                width="34"
                height="36"
                viewBox="0 0 49 40"
                fill="none"
                className="h-full w-auto"
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  <linearGradient id="logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#4a50c5" />
                    <stop offset="100%" stopColor="#00b08a" />
                  </linearGradient>
                </defs>
                <g id="logomark">
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M17 0C17.5523 0 18 0.447715 18 1V8.39648C18 8.61918 18.2693 8.7307 18.4268 8.57324L26.4141 0.585938C26.7891 0.210936 27.2978 7.97938e-05 27.8281 0H36.5859C36.8511 4.04019e-05 37.1055 0.105468 37.293 0.292969L40.293 3.29297C40.6834 3.68347 40.6834 4.31653 40.293 4.70703L36.4268 8.57324C36.2693 8.73073 36.3808 8.99997 36.6035 9H44.5859C44.8511 9.00004 45.1055 9.10547 45.293 9.29297L48.293 12.293C48.6834 12.6835 48.6834 13.3165 48.293 13.707L44.3535 17.6465C44.1583 17.8417 44.1583 18.1583 44.3535 18.3535L47.5859 21.5859C48.4914 22.4914 49 23.7195 49 25C49 26.2805 48.4913 27.5086 47.5859 28.4141L36.5859 39.4141C36.2109 39.7891 35.7022 39.9999 35.1719 40H32C31.4477 40 31 39.5523 31 39V31.6035C31 31.3808 30.7307 31.2693 30.5732 31.4268L22.5859 39.4141C22.2109 39.7891 21.7022 39.9999 21.1719 40H12.4141C12.1489 40 11.8945 39.8945 11.707 39.707L8.70703 36.707C8.31661 36.3165 8.31661 35.6835 8.70703 35.293L12.5732 31.4268C12.7307 31.2693 12.6192 31 12.3965 31H4.41406C4.1489 31 3.89453 30.8945 3.70703 30.707L0.707031 27.707C0.316606 27.3165 0.316607 26.6835 0.707031 26.293L4.64648 22.3535C4.8417 22.1583 4.8417 21.8417 4.64648 21.6465L1.41406 18.4141C0.508652 17.5086 0 16.2805 0 15C0 13.7195 0.508651 12.4914 1.41406 11.5859L12.4141 0.585938C12.7891 0.210936 13.2978 8.00463e-05 13.8281 0H17ZM20.0713 9C18.7452 9 17.4728 9.52716 16.5352 10.4648L5.85352 21.1465C5.53861 21.4615 5.76165 21.9999 6.20703 22H20.793C21.2383 22.0001 21.4613 22.5386 21.1465 22.8535L13.8535 30.1465C13.5386 30.4615 13.7616 30.9999 14.207 31H28.9287C30.2548 31 31.5272 30.4728 32.4648 29.5352L43.1465 18.8535C43.4417 18.5583 43.2642 18.0663 42.874 18.0059L42.793 18H28.207C27.7616 18 27.5386 17.4615 27.8535 17.1465L35.1465 9.85352C35.4614 9.53855 35.2384 9.00006 34.793 9H20.0713Z"
                    fill="url(#logo-gradient)"
                  />
                </g>
              </svg>
            </div>
            <h2 className="text-on-surface text-3xl font-headline font-extrabold leading-tight tracking-[-0.02em]">
              RepoHawk
            </h2>
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

    </aside>
  );
}
