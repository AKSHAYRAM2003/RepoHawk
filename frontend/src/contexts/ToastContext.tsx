"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Toaster } from "sileo";

type SileoPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

interface ToastContextType {
  toastPosition: SileoPosition;
  setToastPosition: (pos: SileoPosition) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

const STORAGE_KEY = "sileo-position";

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toastPosition, setToastPosition] = useState<SileoPosition>("top-right");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as SileoPosition | null;
    if (saved) setToastPosition(saved);
  }, []);

  const updatePosition = (pos: SileoPosition) => {
    setToastPosition(pos);
    localStorage.setItem(STORAGE_KEY, pos);
  };

  return (
    <ToastContext.Provider value={{ toastPosition, setToastPosition: updatePosition }}>
      {children}
      <style>{`
        [data-sileo-viewport] { z-index: 2147483647 !important; }
      `}</style>
      <Toaster
        position={toastPosition}
        options={{
          duration: 4000,
          fill: "#2e2e2e",
          styles: {
            title: "text-white! font-semibold!",
            description: "text-white/70! text-sm!",
            badge: "bg-white/10!",
          },
        }}
      />
    </ToastContext.Provider>
  );
}

export function useToastPosition() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToastPosition must be used within ToastProvider");
  return ctx;
}
