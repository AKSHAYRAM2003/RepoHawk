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
  User,
  LogOut,
  Sun,
  Moon,
  Monitor,
  Palette,
  Camera,
  Settings2,
  Bell,
  Shield,
  FileText,
  GitBranch,
  Globe,
  CheckCircle,
  Loader2
} from "lucide-react";
import { sileo } from "sileo";
import { useTheme } from "@/components/ThemeProvider";
import { useAuth } from "@/contexts/AuthContext";
import { useToastPosition } from "@/contexts/ToastContext";
import ReadmeGeneratorModal from "./ReadmeGeneratorModal";
import SearchModal from "./SearchModal";
import NotificationBell from "@/components/notifications/NotificationBell";
import NotificationToggle from "@/components/notifications/NotificationToggle";


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
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [isReadmeModalOpen, setIsReadmeModalOpen] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState("appearance");
  const [githubConnected, setGitHubConnected] = useState(false);
  const [githubLogin, setGitHubLogin] = useState("");
  const [reposCount, setReposCount] = useState(0);
  const [githubLoading, setGitHubLoading] = useState(false);
  const { resolvedTheme, theme, setTheme } = useTheme();
  const { user, logout } = useAuth();
  const { toastPosition, setToastPosition } = useToastPosition();
  const [linkLoading, setLinkLoading] = useState(false);
  const [unlinkLoading, setUnlinkLoading] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState({
    push_events: false,
    pull_requests: false,
    analysis_complete: true,
    analysis_failed: true,
    in_app: true,
    email: false,
  });

  // Listen for global Cmd+K / Ctrl+K keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsSearchModalOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Sync or retrieve last active repository ID from local storage
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (repoId) {
        localStorage.setItem("repohawk_last_active_repo", repoId);
        if (activeRepoId !== repoId) {
          setActiveRepoId(repoId);
        }
      } else {
        const lastId = localStorage.getItem("repohawk_last_active_repo");
        if (lastId && activeRepoId !== lastId) {
          setActiveRepoId(lastId);
        }
      }
    }
  }, [repoId, activeRepoId]);

  // Fetch GitHub connection status for the settings modal
  useEffect(() => {
    if (!isSettingsModalOpen) return;
    setGitHubLoading(true);
    fetch("/api/github/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        setGitHubConnected(data.connected);
        if (data.connected && data.installation) {
          setGitHubLogin(data.installation.account_login);
          setReposCount(data.installation.repos?.length || 0);
        }
      })
      .catch(() => setGitHubConnected(false))
      .finally(() => setGitHubLoading(false));
    fetch("/api/notifications/preferences")
      .then((r) => r.json())
      .then((data) => setNotifPrefs(data))
      .catch(() => {});
  }, [isSettingsModalOpen]);

  useEffect(() => {
    if (isProfileModalOpen) {
      setDisplayName(user?.name || "");
    }
  }, [isProfileModalOpen, user?.name]);

  const handleThemeChange = (value: "light" | "dark" | "system") => {
    const labels = { light: "Light", dark: "Dark", system: "System" };
    setTheme(value);
    sileo.success({ title: `Switched to ${labels[value]} mode`, description: "Theme preference saved" });
  };

  const toggleNotif = async (key: string, label: string) => {
    const newValue = !(notifPrefs as any)[key];
    setNotifPrefs((prev) => ({ ...prev, [key]: newValue }));
    try {
      await fetch("/api/notifications/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: newValue }),
      });
      const descs: Record<string, string> = {
        push_events: "Get notified when code is pushed to your repos",
        pull_requests: "Architecture impact summaries for new PRs",
        analysis_complete: "Alerts when repo analysis finishes",
        analysis_failed: "Alerts when repo analysis encounters an error",
        in_app: "Notifications appear in the sidebar panel",
        email: "Notifications sent to your email address",
      };
      sileo.success({ title: newValue ? `${label} turned on` : `${label} turned off`, description: descs[key] || "" });
    } catch {
      setNotifPrefs((prev) => ({ ...prev, [key]: !newValue }));
    }
  };

  const menuItems: MenuGroup[] = [
    { section: "Overview", items: [
      { 
        name: "My Repositories", 
        icon: FolderGit2,
        subItems: [
          { name: "Dashboard", href: `/dashboard/${user?.id || ""}`, icon: FolderGit2 },
          { name: "New Repo", href: `/new-repo/${user?.id || ""}`, icon: Plus }
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
    {
      section: "AI Tools", items: [
        { name: "Generate README", href: "#", icon: FileText, action: activeRepoId ? "generate-readme" : undefined }
      ]
    }
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
            <div className="h-8 w-auto text-primary">
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
            <h2 className="text-on-surface text-2xl font-headline font-extrabold leading-tight tracking-[-0.02em]">
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
        <NotificationBell />
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
                        <button
                          onClick={() => {
                            if (item.action === "generate-readme") {
                              setIsReadmeModalOpen(true);
                            } else if (item.action === "cmd-k") {
                              setIsSearchModalOpen(true);
                            }
                          }}
                          className={`w-full flex items-center ${isCollapsed ? "justify-center px-0" : "px-3"} py-2 rounded-xl text-sm font-medium transition-colors hover-surface text-on-surface-variant`}
                        >
                          <Icon size={17} className="flex-shrink-0" />
                          {!isCollapsed && <span className="ml-3 truncate">{item.name}</span>}
                          {!isCollapsed && item.action === "cmd-k" && (
                            <span
                              style={{
                                marginLeft: "auto",
                                fontSize: 8,
                                fontWeight: 800,
                                letterSpacing: "0.08em",
                                padding: "1px 5px",
                                borderRadius: 4,
                                background: "rgba(255,255,255,0.06)",
                                border: "1px solid rgba(255,255,255,0.1)",
                                color: "var(--on-surface-variant)",
                                opacity: 0.8,
                              }}
                            >
                              ⌘K
                            </span>
                          )}
                          {!isCollapsed && item.action === "generate-readme" && (
                            <span
                              style={{
                                marginLeft: "auto",
                                fontSize: 8,
                                fontWeight: 800,
                                letterSpacing: "0.08em",
                                padding: "1px 5px",
                                borderRadius: 4,
                                background: "rgba(99,102,241,0.12)",
                                color: "#818cf8",
                                border: "1px solid rgba(99,102,241,0.25)",
                                textTransform: "uppercase",
                              }}
                            >
                              AI
                            </span>
                          )}
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

      {/* User Profile Footer */}
      <div className="relative border-t border-outline-variant p-3 shrink-0">
        <button
          onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
          className={`flex items-center w-full ${isCollapsed ? "justify-center" : "justify-between"} p-2 rounded-xl hover-surface transition-colors`}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-[#4a50c5] to-[#00b08a] flex items-center justify-center text-on-primary font-bold text-sm shrink-0">
              {(user?.name || user?.email || "U")[0].toUpperCase()}
            </div>
            {!isCollapsed && (
              <div className="flex flex-col items-start min-w-0">
                <span className="text-sm font-semibold text-on-surface truncate">{user?.name || user?.email || "User"}</span>
                <span className="text-[11px] text-on-surface-variant truncate">{user?.email || ""}</span>
              </div>
            )}
          </div>
          {!isCollapsed && <ChevronDown size={16} className="text-on-surface-variant flex-shrink-0" />}
        </button>

        {/* Profile Popover */}
        {isProfileMenuOpen && (
          <>
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setIsProfileMenuOpen(false)} 
            />
            <div 
              className="absolute bottom-full left-3 mb-2 w-56 rounded-xl border border-outline-variant bg-surface-container-high shadow-lg z-50 overflow-hidden"
            >
              <div className="p-3 border-b border-outline-variant">
                <p className="text-sm font-semibold text-on-surface">{user?.name || user?.email || "User"}</p>
                <p className="text-xs text-on-surface-variant">{user?.email || ""}</p>
                {user?.github_username && (
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-on-surface-variant">
                      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
                    </svg>
                    <span className="text-[11px] text-on-surface-variant">@{user.github_username}</span>
                  </div>
                )}
              </div>
              <div className="p-1">
                <button 
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-on-surface hover-surface rounded-lg transition-colors"
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    setIsProfileModalOpen(true);
                  }}
                >
                  <User size={16} className="text-on-surface-variant" />
                  Profile
                </button>
                <button 
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-on-surface hover-surface rounded-lg transition-colors"
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    setIsSettingsModalOpen(true);
                  }}
                >
                  <Settings size={16} className="text-on-surface-variant" />
                  Settings
                </button>
              </div>
              <div className="p-1 border-t border-outline-variant">
                  <button 
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-[rgb(244,63,94)] hover:bg-[rgba(244,63,94,0.1)] rounded-lg transition-colors"
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      logout();
                    }}
                  >
                  <LogOut size={16} />
                  Log out
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Settings Modal */}
      {isSettingsModalOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4"
          onClick={() => setIsSettingsModalOpen(false)}
        >
          <div
            className="w-full max-w-2xl bg-surface-container border border-outline-variant rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant">
              <h2 className="text-xl font-bold text-on-surface">Settings</h2>
              <button 
                onClick={() => setIsSettingsModalOpen(false)}
                className="p-2 text-on-surface-variant hover-surface rounded-lg transition-colors leading-none"
              >
                ×
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex flex-1 overflow-hidden bg-surface-container">
              {/* Settings Sidebar */}
              <div className="w-48 sm:w-56 border-r border-outline-variant bg-surface-container-low p-3 space-y-1 overflow-y-auto hidden sm:block">
                <button
                  onClick={() => setSettingsTab("general")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    settingsTab === "general" ? "bg-surface-high text-on-surface font-medium" : "text-on-surface-variant hover:bg-surface-high"
                  }`}
                >
                  <Settings2 size={16} />
                  General
                </button>
                <button
                  onClick={() => setSettingsTab("appearance")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    settingsTab === "appearance" ? "bg-surface-high text-on-surface font-medium" : "text-on-surface-variant hover:bg-surface-high"
                  }`}
                >
                  <Palette size={16} />
                  Appearance
                </button>
                <button
                  onClick={() => setSettingsTab("notifications")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    settingsTab === "notifications" ? "bg-surface-high text-on-surface font-medium" : "text-on-surface-variant hover:bg-surface-high"
                  }`}
                >
                  <Bell size={16} />
                  Notifications
                </button>
                <button
                  onClick={() => setSettingsTab("security")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    settingsTab === "security" ? "bg-surface-high text-on-surface font-medium" : "text-on-surface-variant hover:bg-surface-high"
                  }`}
                >
                  <Shield size={16} />
                  Security
                </button>
              </div>

              {/* Settings Content */}
              <div className="flex-1 p-6 overflow-y-auto">
                {settingsTab === "appearance" && (
                  <section className="space-y-6 max-w-2xl mx-auto">
                    <div className="flex items-center gap-3 pb-4 border-b border-outline-variant">
                      <div>
                        <h3 className="text-lg font-bold text-on-surface">Appearance</h3>
                        <p className="text-sm text-on-surface-variant">Customize the look and feel of the application.</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
                      {[
                        { value: "light", label: "Light", icon: Sun, desc: "Clean bright interface" },
                        { value: "dark", label: "Dark", icon: Moon, desc: "Easy on the eyes" },
                        { value: "system", label: "System", icon: Monitor, desc: "Follows your OS setting" },
                      ].map(({ value, label, icon: Icon, desc }) => {
                        const isActive = theme === value;
                        return (
                          <button
                            key={value}
                            onClick={() => handleThemeChange(value as "light" | "dark" | "system")}
                            className="relative flex flex-col items-start gap-3 p-4 rounded-2xl border text-left transition-all hover:-translate-y-0.5"
                            style={{
                              borderColor: isActive
                                ? "var(--primary)"
                                : "var(--outline-variant)",
                              background: isActive
                                ? "color-mix(in srgb, var(--primary) 6%, var(--surface-container-low))"
                                : "var(--surface-container-low)",
                              boxShadow: isActive
                                ? "0 0 0 1px var(--primary)"
                                : "none",
                            }}
                          >
                            {isActive && (
                              <div
                                className="absolute top-3 right-3 w-2 h-2 rounded-full"
                                style={{ background: "var(--primary)" }}
                              />
                            )}
                            <div
                              className="w-9 h-9 rounded-xl flex items-center justify-center"
                              style={{
                                background: isActive
                                  ? "color-mix(in srgb, var(--primary) 15%, transparent)"
                                  : "color-mix(in srgb, var(--on-surface) 6%, transparent)",
                                color: isActive ? "var(--primary)" : "var(--on-surface-variant)",
                              }}
                            >
                              <Icon size={18} />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-on-surface">{label}</p>
                              <p className="text-xs text-on-surface-variant mt-0.5">{desc}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    {/* Live preview strip */}
                    <div
                      className="flex items-center gap-3 mt-4 p-4 rounded-xl border border-outline-variant"
                      style={{ background: "color-mix(in srgb, var(--on-surface) 3%, transparent)" }}
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ background: "color-mix(in srgb, var(--primary) 15%, transparent)", color: "var(--primary)" }}
                      >
                        {resolvedTheme === "dark" ? <Moon size={16} /> : <Sun size={16} />}
                      </div>
                      <div>
                        <p className="text-sm text-on-surface font-medium">Preview active</p>
                        <p className="text-xs text-on-surface-variant">
                          Currently using <span className="font-semibold">{resolvedTheme}</span> mode
                          {theme === "system" && " (system preference)"}
                        </p>
                      </div>
                    </div>
                  </section>
                )}
                
                {settingsTab === "notifications" && (
                  <section className="space-y-6 max-w-2xl mx-auto">
                    <div className="flex items-center gap-3 pb-4 border-b border-outline-variant">
                      <Bell size={20} style={{ color: "var(--primary)" }} />
                      <div>
                        <h3 className="text-lg font-bold text-on-surface">Notifications</h3>
                        <p className="text-sm text-on-surface-variant">Manage your notification preferences.</p>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs font-bold tracking-wider text-on-surface-variant uppercase">Events</p>
                      <div className="space-y-3 mt-3">
                        <NotificationToggle
                          label="Push events"
                          desc="Notify when new code is pushed to a connected repo"
                          value={notifPrefs.push_events}
                          onChange={() => toggleNotif("push_events", "Push events")}
                        />
                        <NotificationToggle
                          label="Pull requests"
                          desc="Architecture impact summaries for new PRs"
                          value={notifPrefs.pull_requests}
                          onChange={() => toggleNotif("pull_requests", "Pull requests")}
                        />
                        <NotificationToggle
                          label="Analysis complete"
                          desc="When a repo analysis finishes successfully"
                          value={notifPrefs.analysis_complete}
                          onChange={() => toggleNotif("analysis_complete", "Analysis complete")}
                        />
                        <NotificationToggle
                          label="Analysis failed"
                          desc="When a repo analysis encounters an error"
                          value={notifPrefs.analysis_failed}
                          onChange={() => toggleNotif("analysis_failed", "Analysis failed")}
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs font-bold tracking-wider text-on-surface-variant uppercase mt-6">Channels</p>
                      <div className="space-y-3 mt-3">
                        <NotificationToggle
                          label="In-app"
                          desc="Notifications appear in this panel"
                          value={notifPrefs.in_app}
                          onChange={() => toggleNotif("in_app", "In-app")}
                        />
                        <NotificationToggle
                          label="Email"
                          desc="Send notifications to your email"
                          value={notifPrefs.email}
                          onChange={() => toggleNotif("email", "Email")}
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs font-bold tracking-wider text-on-surface-variant uppercase mt-6">Toast Position</p>
                      <p className="text-xs text-on-surface-variant mt-1 mb-3">Choose where toast notifications appear on screen</p>
                      <div className="grid grid-cols-3 gap-2">
                        {(["top-left","top-center","top-right","bottom-left","bottom-center","bottom-right"] as const).map((pos) => (
                          <button
                            key={pos}
                            onClick={() => setToastPosition(pos)}
                            className="px-3 py-2 text-xs font-medium rounded-lg border transition-all cursor-pointer"
                            style={{
                              borderColor: toastPosition === pos ? "var(--primary)" : "var(--outline-variant)",
                              background: toastPosition === pos ? "color-mix(in srgb, var(--primary) 10%, transparent)" : "var(--surface-container-highest)",
                              color: toastPosition === pos ? "var(--primary)" : "var(--on-surface-variant)",
                            }}
                          >
                            {pos === "top-left" ? "Top Left" : pos === "top-center" ? "Top Center" : pos === "top-right" ? "Top Right" : pos === "bottom-left" ? "Bottom Left" : pos === "bottom-center" ? "Bottom Center" : "Bottom Right"}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="mt-6 p-4 rounded-xl border border-outline-variant" style={{ background: "color-mix(in srgb, var(--on-surface) 3%, transparent)" }}>
                      <p className="text-xs text-on-surface-variant">
                        Connect your GitHub account from the <strong className="text-on-surface">General</strong> tab to enable push and PR notifications.
                      </p>
                    </div>
                  </section>
                )}

                {settingsTab === "security" && (
                  <section className="space-y-6 max-w-2xl mx-auto">
                    <div className="flex items-center gap-3 pb-4 border-b border-outline-variant">
                      <Shield size={20} style={{ color: "var(--primary)" }} />
                      <div>
                        <h3 className="text-lg font-bold text-on-surface">Security</h3>
                        <p className="text-sm text-on-surface-variant">Manage your account security settings.</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 rounded-xl border border-outline-variant">
                        <div>
                          <p className="text-sm font-semibold text-on-surface">Password</p>
                          <p className="text-xs text-on-surface-variant mt-0.5">Change your account password</p>
                        </div>
                        <button
                          onClick={() => setIsPasswordModalOpen(true)}
                          className="px-4 py-2 text-xs font-semibold rounded-xl border border-outline-variant text-on-surface hover-surface transition-all cursor-pointer"
                        >
                          Update
                        </button>
                      </div>
                      <div className="flex items-center justify-between p-4 rounded-xl border border-outline-variant">
                        <div>
                          <p className="text-sm font-semibold text-on-surface">Sessions</p>
                          <p className="text-xs text-on-surface-variant mt-0.5">Manage active sessions</p>
                        </div>
                        <button className="px-4 py-2 text-xs font-semibold rounded-xl border border-outline-variant text-on-surface hover-surface transition-all cursor-pointer">
                          View
                        </button>
                      </div>
                    </div>
                  </section>
                )}

                {settingsTab === "general" && (
                  <section className="space-y-6 max-w-2xl mx-auto">
                    <div className="flex items-center gap-3 pb-4 border-b border-outline-variant">
                      <Settings2 size={20} style={{ color: "var(--primary)" }} />
                      <div>
                        <h3 className="text-lg font-bold text-on-surface">General</h3>
                        <p className="text-sm text-on-surface-variant">Manage your GitHub connection and general preferences.</p>
                      </div>
                    </div>

                    {/* GitHub Account Linking */}
                    <div className="p-5 rounded-2xl border border-outline-variant"
                      style={{ background: "color-mix(in srgb, var(--on-surface) 3%, transparent)" }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <GitBranch size={18} style={{ color: "var(--primary)" }} />
                          <div>
                            <p className="text-sm font-bold text-on-surface">Linked Account</p>
                            <p className="text-xs text-on-surface-variant">
                              {user?.github_username
                                ? `Connected as @${user.github_username}`
                                : "Link your GitHub identity to connect repos"
                              }
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {user?.github_username ? (
                            <button
                              onClick={async () => {
                                setUnlinkLoading(true);
                                try {
                                  await fetch("/api/auth/github/unlink", { method: "POST" });
                                  sileo.success({ title: "GitHub account unlinked", description: "You can link a different account anytime" });
                                  window.location.reload();
                                } finally {
                                  setUnlinkLoading(false);
                                }
                              }}
                              disabled={unlinkLoading}
                              className="px-4 py-2 text-xs font-bold rounded-xl border border-outline-variant text-on-surface-variant hover-surface transition-all"
                            >
                              {unlinkLoading ? "Unlinking..." : "Unlink"}
                            </button>
                          ) : (
                            <button
                              onClick={async () => {
                                setLinkLoading(true);
                                try {
                                  const res = await fetch(`/api/auth/github/url?return_url=${encodeURIComponent(window.location.pathname)}`);
                                  const data = await res.json();
                                  if (data.url) window.location.href = data.url;
                                } finally {
                                  setLinkLoading(false);
                                }
                              }}
                              disabled={linkLoading}
                              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all"
                              style={{ background: "linear-gradient(135deg, #4a50c5, #00b08a)", color: "white" }}
                            >
                              {linkLoading ? "Redirecting..." : "Link GitHub Account"}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* GitHub App Installation */}
                    <div className="p-5 rounded-2xl border border-outline-variant"
                      style={{ background: "color-mix(in srgb, var(--on-surface) 3%, transparent)" }}
                    >
                      <div className="flex items-center gap-3 mb-4">
                        <GitBranch size={18} style={{ color: "var(--primary)" }} />
                        <div>
                          <p className="text-sm font-bold text-on-surface">GitHub App</p>
                          <p className="text-xs text-on-surface-variant">Install the GitHub App on your repositories for auto-discovery and webhook events</p>
                        </div>
                      </div>

                      {githubLoading ? (
                        <div className="flex items-center justify-center py-6">
                          <Loader2 size={18} className="animate-spin" style={{ color: "var(--primary)" }} />
                        </div>
                      ) : githubConnected ? (
                        <div className="p-4 rounded-xl border border-outline-variant bg-surface-low flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-r from-[#4a50c5] to-[#00b08a] flex items-center justify-center shrink-0">
                            <CheckCircle size={20} className="text-white" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Globe size={13} style={{ color: "#10b981" }} />
                              <p className="text-sm font-bold text-on-surface">Connected</p>
                            </div>
                            <p className="text-xs text-on-surface-variant mt-0.5">
                              Signed in as <strong>{githubLogin}</strong> &middot; {reposCount} repos
                            </p>
                          </div>
                        </div>
                      ) : (
                        <a
                          href="https://github.com/apps/repohawk/installations/new"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl transition-all cursor-pointer"
                          style={{
                            background: "linear-gradient(135deg, #4a50c5, #00b08a)",
                            color: "white",
                          }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
                          Install App
                        </a>
                      )}
                    </div>
                  </section>
                )}

              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {isProfileModalOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4"
          onClick={() => setIsProfileModalOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-surface-container border border-outline-variant rounded-2xl shadow-2xl overflow-hidden p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-on-surface mb-6">Edit profile</h2>
            
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-[#1db08b] flex items-center justify-center text-white text-4xl font-normal tracking-wide">
                  AK
                </div>
                <button className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-surface-container-high border border-outline-variant flex items-center justify-center text-on-surface hover:bg-surface-highest transition-colors shadow-sm">
                  <Camera size={14} />
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1.5">Display name</label>
                <input 
                  type="text" 
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-surface-container-highest border border-outline-variant rounded-lg px-3 py-2.5 text-sm text-on-surface focus:outline-none focus:border-primary transition-colors" 
                />
              </div>
            </div>

            <p className="text-xs text-center text-on-surface-variant mt-6 mb-8">Your profile helps people recognize you in group chats.</p>

            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setIsProfileModalOpen(false)} 
                className="px-5 py-2.5 rounded-full border border-outline-variant text-on-surface hover:bg-surface-high transition-colors font-medium text-sm"
              >
                Cancel
              </button>
              <button 
                onClick={async () => {
                  if (!displayName.trim()) return;
                  setSavingProfile(true);
                  try {
                    await updateProfile({ name: displayName.trim() });
                    sileo.success({ title: "Profile saved", description: "Changes are reflected across the app" });
                    setIsProfileModalOpen(false);
                  } catch {
                    sileo.error({ title: "Could not save profile", description: "Please try again" });
                  } finally {
                    setSavingProfile(false);
                  }
                }}
                disabled={savingProfile || !displayName.trim()}
                className="px-5 py-2.5 rounded-full bg-on-surface text-surface hover:opacity-90 transition-opacity font-medium text-sm disabled:opacity-50"
              >
                {savingProfile ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Change Modal */}
      {isPasswordModalOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4"
          onClick={() => setIsPasswordModalOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-surface-container border border-outline-variant rounded-2xl shadow-2xl overflow-hidden p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-on-surface mb-6">Change password</h2>

            <PasswordChangeForm onDone={() => setIsPasswordModalOpen(false)} />
          </div>
        </div>
      )}

      {/* README Generator Modal */}
      {isReadmeModalOpen && activeRepoId && (
        <ReadmeGeneratorModal
          repoId={activeRepoId}
          repoName={activeRepoId}
          onClose={() => setIsReadmeModalOpen(false)}
        />
      )}

      {/* Semantic Search Modal */}
      {isSearchModalOpen && activeRepoId && (
        <SearchModal
          repoId={activeRepoId}
          onClose={() => setIsSearchModalOpen(false)}
        />
      )}

    </aside>
  );
}

