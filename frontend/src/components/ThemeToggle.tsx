"use client";

import React, { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "./ThemeProvider";

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => {
    if (!mounted) {
      setMounted(true);
    }
  }, [mounted]);

  if (!mounted) {
    return (
      <div className="w-10 h-10 rounded-xl bg-surface-container-high animate-pulse" />
    );
  }

  return (
    <button
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="flex items-center justify-center rounded-xl size-10 text-on-surface hover:bg-surface-container-high transition-all active:scale-95 group relative overflow-hidden"
      aria-label="Toggle theme"
    >
      <div className="relative size-6">
        <Sun 
          className={`absolute inset-0 transition-all duration-500 ${
            resolvedTheme === "dark" ? "-rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100"
          }`} 
        />
        <Moon 
          className={`absolute inset-0 transition-all duration-500 ${
            resolvedTheme === "dark" ? "rotate-0 scale-100 opacity-100" : "rotate-90 scale-0 opacity-0"
          }`} 
        />
      </div>
    </button>
  );
}
