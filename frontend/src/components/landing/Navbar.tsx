"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { ThemeToggle } from "../ThemeToggle";
import { Menu, X, LogOut, User, Settings, LayoutDashboard } from "lucide-react";

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 w-full px-4 md:px-10 lg:px-16 py-3 transition-all duration-300 relative">
      <header className="flex items-center justify-between whitespace-nowrap px-6 py-4 rounded-2xl bg-surface-container-highest/40 backdrop-blur-2xl border border-outline-variant/15 shadow-[0_8px_32px_rgba(0,0,0,0.08),inset_0_2px_1px_rgba(255,255,255,0.5),inset_0_-1px_1px_rgba(0,0,0,0.05)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.1),inset_0_-1px_1px_rgba(0,0,0,0.2)]">
        <div className="flex items-center gap-1 text-on-surface">
          <Link href="/" className="flex items-center gap-1">
            <div className="h-9 w-auto text-primary">
              <svg width="34" height="36" viewBox="0 0 49 40" fill="none" className="h-full w-auto" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#4a50c5" />
                    <stop offset="100%" stopColor="#00b08a" />
                  </linearGradient>
                </defs>
                <path fillRule="evenodd" clipRule="evenodd" d="M17 0C17.5523 0 18 0.447715 18 1V8.39648C18 8.61918 18.2693 8.7307 18.4268 8.57324L26.4141 0.585938C26.7891 0.210936 27.2978 7.97938e-05 27.8281 0H36.5859C36.8511 4.04019e-05 37.1055 0.105468 37.293 0.292969L40.293 3.29297C40.6834 3.68347 40.6834 4.31653 40.293 4.70703L36.4268 8.57324C36.2693 8.73073 36.3808 8.99997 36.6035 9H44.5859C44.8511 9.00004 45.1055 9.10547 45.293 9.29297L48.293 12.293C48.6834 12.6835 48.6834 13.3165 48.293 13.707L44.3535 17.6465C44.1583 17.8417 44.1583 18.1583 44.3535 18.3535L47.5859 21.5859C48.4914 22.4914 49 23.7195 49 25C49 26.2805 48.4913 27.5086 47.5859 28.4141L36.5859 39.4141C36.2109 39.7891 35.7022 39.9999 35.1719 40H32C31.4477 40 31 39.5523 31 39V31.6035C31 31.3808 30.7307 31.2693 30.5732 31.4268L22.5859 39.4141C22.2109 39.7891 21.7022 39.9999 21.1719 40H12.4141C12.1489 40 11.8945 39.8945 11.707 39.707L8.70703 36.707C8.31661 36.3165 8.31661 35.6835 8.70703 35.293L12.5732 31.4268C12.7307 31.2693 12.6192 31 12.3965 31H4.41406C4.1489 31 3.89453 30.8945 3.70703 30.707L0.707031 27.707C0.316606 27.3165 0.316607 26.6835 0.707031 26.293L4.64648 22.3535C4.8417 22.1583 4.8417 21.8417 4.64648 21.6465L1.41406 18.4141C0.508652 17.5086 0 16.2805 0 15C0 13.7195 0.508651 12.4914 1.41406 11.5859L12.4141 0.585938C12.7891 0.210936 13.2978 8.00463e-05 13.8281 0H17ZM20.0713 9C18.7452 9 17.4728 9.52716 16.5352 10.4648L5.85352 21.1465C5.53861 21.4615 5.76165 21.9999 6.20703 22H20.793C21.2383 22.0001 21.4613 22.5386 21.1465 22.8535L13.8535 30.1465C13.5386 30.4615 13.7616 30.9999 14.207 31H28.9287C30.2548 31 31.5272 30.4728 32.4648 29.5352L43.1465 18.8535C43.4417 18.5583 43.2642 18.0663 42.874 18.0059L42.793 18H28.207C27.7616 18 27.5386 17.4615 27.8535 17.1465L35.1465 9.85352C35.4614 9.53855 35.2384 9.00006 34.793 9H20.0713Z" fill="url(#logo-gradient)" />
              </svg>
            </div>
            <h2 className="text-on-surface text-3xl font-headline font-extrabold leading-tight tracking-[-0.02em]">RepoHawk</h2>
          </Link>
        </div>

        <div className="hidden md:flex flex-1 justify-end gap-8 items-center">
          {isAuthenticated ? (
            <div className="relative">
              <button onClick={() => setIsProfileOpen(!isProfileOpen)} className="flex items-center gap-2 p-1.5 rounded-xl hover-surface transition-colors">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-[#4a50c5] to-[#00b08a] flex items-center justify-center text-white text-xs font-bold">
                  {(user?.name || user?.email || "U")[0].toUpperCase()}
                </div>
                <span className="text-sm font-semibold text-on-surface max-w-[120px] truncate">{user?.name || user?.email}</span>
              </button>
              {isProfileOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsProfileOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-outline-variant bg-surface-container-high shadow-lg z-50 overflow-hidden">
                    <div className="p-2">
                      <Link href="/dashboard" onClick={() => setIsProfileOpen(false)} className="flex items-center gap-3 px-3 py-2 text-sm text-on-surface hover-surface rounded-lg transition-colors">
                        <LayoutDashboard size={16} className="text-on-surface-variant" /> Dashboard
                      </Link>
                      <button onClick={() => setIsProfileOpen(false)} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-on-surface hover-surface rounded-lg transition-colors">
                        <User size={16} className="text-on-surface-variant" /> Profile
                      </button>
                      <Link href="/settings" onClick={() => setIsProfileOpen(false)} className="flex items-center gap-3 px-3 py-2 text-sm text-on-surface hover-surface rounded-lg transition-colors">
                        <Settings size={16} className="text-on-surface-variant" /> Settings
                      </Link>
                    </div>
                    <div className="p-1 border-t border-outline-variant">
                      <button onClick={() => { setIsProfileOpen(false); logout(); }} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors">
                        <LogOut size={16} /> Log out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-center gap-8">
                <a className="text-on-surface-variant hover:text-primary transition-colors text-md font-semibold" href="#">About</a>
                <a className="text-on-surface-variant hover:text-primary transition-colors text-md font-semibold" href="#">Features</a>
                <a className="text-on-surface-variant hover:text-primary transition-colors text-md font-semibold" href="#">How it works</a>
                <a className="text-on-surface-variant hover:text-primary transition-colors text-md font-semibold" href="#">Docs</a>
              </div>
              <ThemeToggle />
              <Link href="/auth/login" className="flex items-center justify-center rounded-xl h-10 px-5 bg-gradient-to-r from-[#4a50c5] to-[#00b08a] text-white text-md font-bold hover:shadow-lg transition-all active:scale-95">
                <span>Sign In</span>
              </Link>
            </>
          )}
        </div>

        <div className="flex items-center gap-3 md:hidden">
          <ThemeToggle />
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-outline-variant/10 rounded-xl transition-all" aria-label="Toggle Menu">
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </header>

      {isMobileMenuOpen && (
        <div className="absolute top-full left-4 right-4 mt-2 p-6 rounded-3xl bg-white/95 dark:bg-[#121215]/95 backdrop-blur-3xl border border-black/5 dark:border-white/10 shadow-2xl md:hidden flex flex-col gap-8">
          <div className="flex flex-col gap-6">
            {isAuthenticated ? (
              <Link href="/dashboard" onClick={() => setIsMobileMenuOpen(false)} className="text-gray-800 dark:text-gray-300 hover:text-primary transition-colors text-xl font-headline font-semibold">Dashboard</Link>
            ) : (
              <>
                <a href="#" onClick={() => setIsMobileMenuOpen(false)} className="text-gray-800 dark:text-gray-300 hover:text-primary transition-colors text-xl font-headline font-semibold">About</a>
                <a href="#" onClick={() => setIsMobileMenuOpen(false)} className="text-gray-800 dark:text-gray-300 hover:text-primary transition-colors text-xl font-headline font-semibold">Features</a>
                <div className="h-px w-full bg-black/5 dark:bg-white/10" />
                <a href="#" onClick={() => setIsMobileMenuOpen(false)} className="text-gray-800 dark:text-gray-300 hover:text-primary transition-colors text-xl font-headline font-semibold">How it works</a>
                <div className="h-px w-full bg-black/5 dark:bg-white/10" />
                <a href="#" onClick={() => setIsMobileMenuOpen(false)} className="text-gray-800 dark:text-gray-300 hover:text-primary transition-colors text-xl font-headline font-semibold">Docs</a>
              </>
            )}
          </div>
          {isAuthenticated ? (
            <button onClick={() => { setIsMobileMenuOpen(false); logout(); }} className="flex w-full items-center justify-center rounded-2xl h-14 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-lg font-bold hover:shadow-lg transition-all">Log out</button>
          ) : (
            <Link href="/auth/login" onClick={() => setIsMobileMenuOpen(false)} className="flex w-full items-center justify-center rounded-2xl h-14 bg-gradient-to-r from-[#4a50c5] to-[#00b08a] text-white text-lg font-bold hover:shadow-lg transition-all shadow-[0_4px_20px_rgba(74,80,197,0.3)]">Sign In To RepoHawk</Link>
          )}
        </div>
      )}
    </nav>
  );
}
