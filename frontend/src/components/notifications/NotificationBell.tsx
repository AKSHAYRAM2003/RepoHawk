"use client";

import React, { useState, useRef, useEffect } from "react";
import { Bell, BellDot, BellRing, CheckCheck, ExternalLink, Clock, GitBranch, Activity, AlertCircle } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";

export default function NotificationBell() {
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead, fetchNotifications } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getIcon = (type: string) => {
    switch (type) {
      case "github_connected": return <GitBranch size={14} />;
      case "repos_added": return <GitBranch size={14} />;
      case "push_detected": return <Activity size={14} />;
      case "pr_opened": return <ExternalLink size={14} />;
      default: return <Bell size={14} />;
    }
  };

  const getIconBg = (type: string) => {
    switch (type) {
      case "github_connected": return "rgba(99,102,241,0.12)";
      case "repos_added": return "rgba(16,185,129,0.12)";
      case "push_detected": return "rgba(245,158,11,0.12)";
      case "pr_opened": return "rgba(99,102,241,0.12)";
      default: return "rgba(255,255,255,0.06)";
    }
  };

  const getIconColor = (type: string) => {
    switch (type) {
      case "github_connected": return "#818cf8";
      case "repos_added": return "#10b981";
      case "push_detected": return "#f59e0b";
      case "pr_opened": return "#818cf8";
      default: return "var(--on-surface-variant)";
    }
  };

  const timeAgo = (dateStr: string | null) => {
    if (!dateStr) return "";
    const now = Date.now();
    const date = new Date(dateStr).getTime();
    const diff = now - date;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div ref={dropdownRef} className="relative" style={{ zIndex: 9999 }}>
      <button
        onClick={() => { setIsOpen(!isOpen); if (!isOpen) fetchNotifications(); }}
        className="relative p-2 rounded-xl text-on-surface-variant hover-surface transition-all cursor-pointer"
        title="Notifications"
      >
        {unreadCount > 0 ? (
          <BellRing size={18} className="animate-pulse" style={{ color: "var(--primary)" }} />
        ) : (
          <Bell size={18} />
        )}
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold leading-none"
            style={{
              background: "linear-gradient(135deg, #4a50c5, #00b08a)",
              color: "white",
              boxShadow: "0 2px 8px rgba(74,80,197,0.35)",
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className="absolute left-0 mt-2 w-[380px] max-w-[90vw] rounded-2xl border overflow-hidden shadow-2xl"
          style={{
            backgroundColor: "var(--surface-container-high)",
            borderColor: "var(--outline-variant)",
            boxShadow: "0 16px 48px rgba(0,0,0,0.25)",
            backdropFilter: "blur(24px)",
          }}
        >
          <div
            className="flex items-center justify-between px-5 py-3 border-b"
            style={{ borderColor: "var(--outline-variant)" }}
          >
            <div className="flex items-center gap-2">
              <Bell size={16} style={{ color: "var(--primary)" }} />
              <span className="text-sm font-bold text-on-surface">Notifications</span>
              {unreadCount > 0 && (
                <span
                  className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full"
                  style={{
                    background: "color-mix(in srgb, var(--primary) 12%, transparent)",
                    color: "var(--primary)",
                  }}
                >
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="flex items-center gap-1 text-xs font-semibold cursor-pointer"
                style={{ color: "var(--primary)" }}
              >
                <CheckCheck size={13} /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div
                  className="w-6 h-6 border-2 rounded-full animate-spin"
                  style={{
                    borderColor: "color-mix(in srgb, var(--primary) 25%, transparent)",
                    borderTopColor: "var(--primary)",
                  }}
                />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
                  style={{ background: "color-mix(in srgb, var(--on-surface) 5%, transparent)" }}
                >
                  <Bell size={22} style={{ color: "var(--on-surface-variant)", opacity: 0.5 }} />
                </div>
                <p className="text-sm font-semibold text-on-surface">All caught up</p>
                <p className="text-xs mt-1" style={{ color: "var(--on-surface-variant)" }}>
                  No new notifications yet
                </p>
              </div>
            ) : (
              notifications.map((notif, i) => (
                <button
                  key={notif.id}
                  onClick={() => {
                    if (!notif.is_read) markAsRead(notif.id);
                  }}
                  className="w-full text-left px-5 py-3 transition-all cursor-pointer"
                  style={{
                    borderBottom: i < notifications.length - 1 ? "1px solid var(--outline-variant)" : "none",
                    backgroundColor: notif.is_read ? "transparent" : "color-mix(in srgb, var(--primary) 3%, transparent)",
                  }}
                >
                  <div className="flex gap-3">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                      style={{
                        background: getIconBg(notif.type),
                        color: getIconColor(notif.type),
                      }}
                    >
                      {getIcon(notif.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className="text-sm font-semibold truncate"
                          style={{
                            color: notif.is_read ? "var(--on-surface-variant)" : "var(--on-surface)",
                          }}
                        >
                          {notif.title}
                        </p>
                        <span className="text-[11px] shrink-0" style={{ color: "var(--on-surface-variant)" }}>
                          {timeAgo(notif.created_at)}
                        </span>
                      </div>
                      {notif.body && (
                        <p
                          className="text-xs mt-0.5 line-clamp-2"
                          style={{ color: "var(--on-surface-variant)" }}
                        >
                          {notif.body}
                        </p>
                      )}
                      {notif.link && (
                        <a
                          href={notif.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-semibold mt-1"
                          style={{ color: "var(--primary)" }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          View details <ExternalLink size={10} />
                        </a>
                      )}
                    </div>
                    {!notif.is_read && (
                      <div
                        className="w-2 h-2 rounded-full shrink-0 mt-2"
                        style={{ background: "var(--primary)" }}
                      />
                    )}
                  </div>
                </button>
              ))
            )}
          </div>

          {notifications.length > 0 && (
            <div
              className="px-5 py-2.5 border-t text-center"
              style={{ borderColor: "var(--outline-variant)" }}
            >
              <button
                onClick={() => setIsOpen(false)}
                className="text-xs font-semibold"
                style={{ color: "var(--on-surface-variant)" }}
              >
                Close
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
