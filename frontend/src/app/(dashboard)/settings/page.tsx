"use client";

import React, { useState, useEffect } from "react";
import { Sun, Moon, Monitor, Settings2, Palette, GitBranch, Globe, CheckCircle, Loader2, Bell } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import NotificationToggle from "@/components/notifications/NotificationToggle";
import { useAuth } from "@/contexts/AuthContext";

interface GitHubStatus {
  connected: boolean;
  installation: {
    id: string;
    installation_id: number;
    account_login: string;
    account_type: string;
    account_avatar_url: string | null;
    created_at: string | null;
    repos: Array<{
      id: string;
      github_repo_id: number;
      owner: string;
      name: string;
      full_name: string;
      private: boolean;
      default_branch: string;
      repo_url: string;
      auto_analyze: boolean;
      created_at: string | null;
    }>;
  } | null;
}

export default function SettingsPage() {
  const { resolvedTheme, theme, setTheme } = useTheme();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("appearance");
  const [githubStatus, setGitHubStatus] = useState<GitHubStatus | null>(null);
  const [githubLoading, setGitHubLoading] = useState(true);
  const [linkLoading, setLinkLoading] = useState(false);
  const [unlinkLoading, setUnlinkLoading] = useState(false);

  useEffect(() => {
    fetch("/api/github/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => setGitHubStatus(data))
      .catch(() => setGitHubStatus({ connected: false, installation: null }))
      .finally(() => setGitHubLoading(false));
  }, []);

  return (
    <div className="min-h-screen p-6 md:p-10 max-w-3xl mx-auto space-y-10">

      <div className="pb-6 border-b border-outline-variant">
        <p className="text-[11px] uppercase font-bold tracking-[0.12em] text-on-surface-variant opacity-60 mb-1">
          Configuration
        </p>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-on-surface">
          Settings
        </h1>
        <p className="text-on-surface-variant mt-1.5 text-sm">
          Customize your RepoHawk workspace preferences.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-xl border border-outline-variant bg-surface-low w-fit">
        {[
          { id: "appearance", label: "Appearance", icon: Palette },
          { id: "github", label: "GitHub", icon: GitBranch },
          { id: "notifications", label: "Notifications", icon: Settings2 },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer"
            style={{
              background: activeTab === id ? "var(--surface-container-high)" : "transparent",
              color: activeTab === id ? "var(--on-surface)" : "var(--on-surface-variant)",
            }}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Appearance Tab */}
      {activeTab === "appearance" && (
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: "color-mix(in srgb, var(--primary) 12%, transparent)", color: "var(--primary)" }}
            >
              <Palette size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-on-surface">Appearance</h2>
              <p className="text-xs text-on-surface-variant">Choose your preferred color theme</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { value: "light", label: "Light", icon: Sun, desc: "Clean bright interface" },
              { value: "dark", label: "Dark", icon: Moon, desc: "Easy on the eyes" },
              { value: "system", label: "System", icon: Monitor, desc: "Follows your OS setting" },
            ].map(({ value, label, icon: Icon, desc }) => {
              const isActive = theme === value;
              return (
                <button
                  key={value}
                  onClick={() => setTheme(value as "light" | "dark" | "system")}
                  className="relative flex flex-col items-start gap-3 p-4 rounded-2xl border text-left transition-all hover:-translate-y-0.5"
                  style={{
                    borderColor: isActive ? "var(--primary)" : "var(--outline-variant)",
                    background: isActive
                      ? "color-mix(in srgb, var(--primary) 6%, var(--surface-container-low))"
                      : "var(--surface-container-low)",
                    boxShadow: isActive ? "0 0 0 1px var(--primary)" : "none",
                  }}
                >
                  {isActive && (
                    <div className="absolute top-3 right-3 w-2 h-2 rounded-full" style={{ background: "var(--primary)" }} />
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

          <div
            className="flex items-center gap-3 mt-2 p-3 rounded-xl border border-outline-variant"
            style={{ background: "color-mix(in srgb, var(--on-surface) 3%, transparent)" }}
          >
            <div
              className="w-6 h-6 rounded-lg flex items-center justify-center"
              style={{ background: "color-mix(in srgb, var(--primary) 15%, transparent)", color: "var(--primary)" }}
            >
              {resolvedTheme === "dark" ? <Moon size={13} /> : <Sun size={13} />}
            </div>
            <p className="text-xs text-on-surface-variant">
              Currently using <span className="font-semibold text-on-surface">{resolvedTheme}</span> mode
              {theme === "system" && " (system preference)"}
            </p>
          </div>
        </section>
      )}

      {/* GitHub Tab */}
      {activeTab === "github" && (
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: "color-mix(in srgb, var(--primary) 12%, transparent)", color: "var(--primary)" }}
            >
              <GitBranch size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-on-surface">GitHub Connection</h2>
              <p className="text-xs text-on-surface-variant">Manage your GitHub integration</p>
            </div>
          </div>

          {/* Account Linking */}
          <div className="p-5 rounded-2xl border border-outline-variant bg-surface-low">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "color-mix(in srgb, var(--on-surface) 6%, transparent)" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ color: "var(--on-surface-variant)" }}>
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-on-surface">Linked Account</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">
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
                        const res = await fetch("/api/auth/github/url");
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

          {/* Installation Status */}
          {githubLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={20} className="animate-spin" style={{ color: "var(--primary)" }} />
            </div>
          ) : githubStatus?.connected ? (
            <div className="space-y-6">
              <div className="p-5 rounded-2xl border border-outline-variant bg-surface-low flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-r from-[#4a50c5] to-[#00b08a] flex items-center justify-center shrink-0">
                  <CheckCircle size={24} className="text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Globe size={14} style={{ color: "#10b981" }} />
                    <p className="text-sm font-bold text-on-surface">App Installed</p>
                  </div>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    Installed on <strong>{githubStatus.installation?.account_login}</strong>
                    {githubStatus.installation?.account_type === "Organization" && " (Organization)"}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs font-bold tracking-wider text-on-surface-variant uppercase mb-3">
                  Connected Repositories ({githubStatus.installation?.repos.length || 0})
                </p>
                <div className="space-y-2">
                  {githubStatus.installation?.repos.map((repo) => (
                    <div
                      key={repo.id}
                      className="flex items-center justify-between p-3 rounded-xl border border-outline-variant bg-surface-low"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                          style={{ background: "color-mix(in srgb, var(--on-surface) 6%, transparent)" }}
                        >
                          <GitBranch size={14} style={{ color: "var(--on-surface-variant)" }} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-on-surface truncate">{repo.full_name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] font-medium" style={{ color: repo.private ? "#f59e0b" : "#10b981" }}>
                              {repo.private ? "Private" : "Public"}
                            </span>
                            <span className="text-[11px] text-on-surface-variant">{repo.default_branch}</span>
                          </div>
                        </div>
                      </div>
                      <a
                        href={repo.repo_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg text-on-surface-variant hover-surface transition-all"
                      >
                        <Globe size={14} />
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 rounded-2xl border border-outline-variant bg-surface-low text-center space-y-4">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto"
                style={{ background: "color-mix(in srgb, var(--on-surface) 6%, transparent)" }}
              >
                <GitBranch size={24} style={{ color: "var(--on-surface-variant)" }} />
              </div>
              <div>
                <p className="text-base font-bold text-on-surface">App not installed</p>
                <p className="text-xs text-on-surface-variant mt-1 max-w-xs mx-auto">
                  Install the RepoHawk GitHub App on your repositories to enable auto-discovery, webhook events, and PR architecture reviews.
                </p>
              </div>
              <a
                href="https://github.com/apps/repohawk/installations/new"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl transition-all"
                style={{
                  background: "linear-gradient(135deg, #4a50c5, #00b08a)",
                  color: "white",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
                </svg>
                Install GitHub App
              </a>
            </div>
          )}
        </section>
      )}

      {/* Notifications Tab */}
      {activeTab === "notifications" && (
        <section className="space-y-6 max-w-2xl">
          <div className="flex items-center gap-3 pb-4 border-b border-outline-variant">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: "color-mix(in srgb, var(--primary) 12%, transparent)", color: "var(--primary)" }}
            >
              <Bell size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-on-surface">Notifications</h2>
              <p className="text-xs text-on-surface-variant">Manage your notification preferences.</p>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-bold tracking-wider text-on-surface-variant uppercase">Events</p>
            <div className="space-y-3 mt-3">
              <NotificationToggle
                label="Push events"
                desc="Notify when new code is pushed to a connected repo"
                defaultChecked={false}
              />
              <NotificationToggle
                label="Pull requests"
                desc="Architecture impact summaries for new PRs"
                defaultChecked={false}
              />
              <NotificationToggle
                label="Analysis complete"
                desc="When a repo analysis finishes successfully"
                defaultChecked={true}
              />
              <NotificationToggle
                label="Analysis failed"
                desc="When a repo analysis encounters an error"
                defaultChecked={true}
              />
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-bold tracking-wider text-on-surface-variant uppercase mt-6">Channels</p>
            <div className="space-y-3 mt-3">
              <NotificationToggle
                label="In-app"
                desc="Notifications appear in this panel"
                defaultChecked={true}
              />
              <NotificationToggle
                label="Email"
                desc="Send notifications to your email"
                defaultChecked={false}
              />
            </div>
          </div>

          <div className="mt-6 p-4 rounded-xl border border-outline-variant" style={{ background: "color-mix(in srgb, var(--on-surface) 3%, transparent)" }}>
            <p className="text-xs text-on-surface-variant">
              Connect your GitHub account from the <strong className="text-on-surface">GitHub</strong> tab to enable push and PR notifications.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
