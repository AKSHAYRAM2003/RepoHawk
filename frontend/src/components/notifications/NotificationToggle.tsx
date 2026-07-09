"use client";

import React from "react";

interface Props {
  label: string;
  desc: string;
  value: boolean;
  onChange: (v: boolean) => void;
}

export default function NotificationToggle({ label, desc, value, onChange }: Props) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex-1 min-w-0 pr-4">
        <p className="text-sm font-semibold text-on-surface">{label}</p>
        <p className="text-xs text-on-surface-variant mt-0.5">{desc}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        className="relative w-9 h-5 rounded-full shrink-0 transition-all duration-200 cursor-pointer"
        style={{
          background: value
            ? "linear-gradient(135deg, #4a50c5, #00b08a)"
            : "color-mix(in srgb, var(--on-surface) 15%, transparent)",
        }}
      >
        <div
          className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-200"
          style={{ transform: value ? "translateX(16px)" : "translateX(0)" }}
        />
      </button>
    </div>
  );
}
