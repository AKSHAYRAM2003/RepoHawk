"use client";

import React from "react";
import { Sun, Moon, Monitor, Settings2, Palette } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

export default function SettingsPage() {
  const { resolvedTheme, theme, setTheme } = useTheme();

  return (
    <div className="min-h-screen p-6 md:p-10 max-w-3xl mx-auto space-y-10">

      {/* Header */}
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

      {/* Appearance section */}
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

      {/* Workspace section (placeholder for future settings) */}
      <section className="space-y-4 opacity-50">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: "color-mix(in srgb, var(--on-surface) 8%, transparent)", color: "var(--on-surface-variant)" }}
          >
            <Settings2 size={16} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-on-surface">Workspace</h2>
            <p className="text-xs text-on-surface-variant">More settings coming soon</p>
          </div>
        </div>
        <div className="p-4 rounded-2xl border border-dashed border-outline-variant text-xs text-on-surface-variant text-center">
          Additional workspace preferences will appear here
        </div>
      </section>
    </div>
  );
}
