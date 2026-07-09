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
      <Toaster position={toastPosition} theme="dark" />
    </ToastContext.Provider>
  );
}

export function useToastPosition() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToastPosition must be used within ToastProvider");
  return ctx;
}
