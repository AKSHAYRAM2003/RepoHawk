"use client";

import React from "react";

export default function Hero() {
  return (
    <main className="@container mt-16 lg:mt-24 px-4 md:px-10 lg:px-20">
      <div className="flex flex-col gap-16 py-10 lg:flex-row lg:items-center">
        {/* Text Content */}
        <div className="flex flex-col gap-8 lg:w-[45%] z-10">
          <div className="flex flex-col gap-4 text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/20 bg-primary/5 w-fit mb-2">
              <div className="w-2 h-2 rounded-full bg-secondary animate-pulse"></div>
              <span className="text-primary text-xs font-mono font-medium uppercase tracking-wider">
                Copilot engine v2.0 live
              </span>
            </div>
            <h1 className="text-on-surface font-headline text-5xl md:text-6xl lg:text-[72px] font-extrabold leading-[1.05] tracking-[-0.03em]">
              Understand any codebase <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">
                in seconds.
              </span>
            </h1>
            <h2 className="text-on-surface-variant text-lg lg:text-xl font-sans font-normal leading-relaxed max-w-lg mt-4 opacity-90">
              RepoHawk visualizes your entire codebase into interactive, live-updating diagrams. Understand architectural sprawl, map dependencies, and ship features faster.
            </h2>
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Primary Gradient CTA */}
            <button className="flex items-center justify-center rounded-xl h-12 px-6 bg-gradient-to-br from-primary to-primary-container text-on-primary text-base font-bold shadow-[0_0_24px_rgba(191,194,255,0.2)] hover:shadow-[0_0_32px_rgba(191,194,255,0.4)] transition-shadow">
              <span>Analyze My Codebase</span>
            </button>
            <button className="flex items-center justify-center rounded-xl h-12 px-6 border border-outline-variant/30 text-on-surface text-base font-bold hover:bg-surface-container-high transition-colors gap-2">
              <span className="material-symbols-outlined text-[20px]">
                play_arrow
              </span>
              <span>Watch Demo</span>
            </button>
          </div>
        </div>

        {/* Interactive Diagram Preview (Glassmorphism) */}
        <div className="lg:w-[55%] relative group/diagram">
          <div className="absolute -inset-4 bg-gradient-to-tr from-primary/10 to-transparent blur-3xl opacity-50 group-hover/diagram:opacity-75 transition-opacity"></div>
          <div className="rounded-[2.5rem] glass-vibrant border-[12px] border-[#94a3b8]/80 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col md:flex-row h-[520px] relative">
            {/* Editor Sidebar (Mac Window Style) */}
            <div className="hidden md:flex w-1/3 bg-surface-container-lowest/80 p-5 flex-col gap-4 border-r border-outline-variant/10">
              <div className="flex gap-1.5 mb-2">
                <div className="w-3 h-3 rounded-full bg-[#ff5f56] shadow-inner"></div>
                <div className="w-3 h-3 rounded-full bg-[#ffbd2e] shadow-inner"></div>
                <div className="w-3 h-3 rounded-full bg-[#27c93f] shadow-inner"></div>
              </div>
              <div className="font-mono text-sm leading-loose">
                <div className="text-primary-container">
                  <span className="text-tertiary font-bold">import</span> {"{ AppNode }"} <span className="text-tertiary font-bold">from</span>{" "}
                  <span className="text-secondary">{'@ui/core'}</span>;
                </div>
                <br />
                <div className="text-on-surface-variant">
                  <span className="text-tertiary font-bold">const</span> Architecture = () {"=>"} {"{"}
                </div>
                <div className="pl-4 text-outline border-l-2 border-primary/50 ml-1 py-1 bg-primary/5 italic text-[12px]">
                  // AI is listening...
                </div>
                <div className="pl-4 text-on-surface-variant">return (</div>
                <div className="pl-8 text-secondary">
                  &lt;AppNode id="auth" /&gt;
                </div>
                <div className="pl-8 text-secondary">
                  &lt;AppNode id="db" /&gt;
                </div>
                <div className="pl-4 text-on-surface-variant">);</div>
                <div className="text-on-surface-variant">{"};"}</div>
              </div>
            </div>
            {/* Diagram Stage */}
            <div className="flex-1 bg-grid-pattern relative flex items-center justify-center p-8 overflow-hidden">
              {/* Enhanced connection lines with Signal Glow */}
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none"
                viewBox="0 0 400 300"
              >
                {/* Auth_Service to User_DB Connection */}
                <path
                  d="M 100 150 C 200 150, 200 80, 300 80"
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth="6"
                  className="opacity-10 blur-[4px]"
                ></path>
                <path
                  d="M 100 150 C 200 150, 200 80, 300 80"
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth="2"
                  strokeDasharray="6 6"
                  className="opacity-50"
                ></path>

                {/* Auth_Service to Graph_API Connection */}
                <path
                  d="M 100 150 C 200 150, 200 220, 300 220"
                  fill="none"
                  stroke="var(--secondary)"
                  strokeWidth="6"
                  className="opacity-10 blur-[4px]"
                ></path>
                <path
                  d="M 100 150 C 200 150, 200 220, 300 220"
                  fill="none"
                  stroke="var(--secondary)"
                  strokeWidth="2"
                  className="opacity-50"
                ></path>
              </svg>
              
              {/* High Contrast Nodes with Depth */}
              <div className="absolute left-10 flex items-center gap-3 bg-surface-container-lowest/90 border border-primary/30 rounded-xl px-5 py-4 shadow-[0_8px_32px_-8px_rgba(191,194,255,0.3)] z-10 hover:scale-105 transition-all duration-300">
                <span className="material-symbols-outlined text-primary text-2xl font-bold">
                  vpn_key
                </span>
                <span className="font-mono text-[13px] font-bold text-on-surface">
                  Auth_Service
                </span>
              </div>

              <div className="absolute right-10 top-12 flex flex-col items-center gap-3 bg-surface-container-lowest/90 border border-primary/30 rounded-xl px-6 py-5 shadow-[0_8px_32px_-8px_rgba(191,194,255,0.3)] z-10 border-t-4 border-t-primary hover:scale-105 transition-all duration-300">
                <span className="material-symbols-outlined text-tertiary text-3xl font-bold">
                  database
                </span>
                <span className="font-mono text-[13px] font-bold text-on-surface">
                  User_DB
                </span>
              </div>

              <div className="absolute right-10 bottom-12 flex flex-col items-center gap-3 bg-surface-container-lowest/90 border border-secondary/30 rounded-xl px-6 py-5 shadow-[0_8px_32px_-8px_rgba(82,221,180,0.3)] z-10 border-t-4 border-t-secondary scale-110 hover:scale-125 transition-all duration-300">
                <span className="material-symbols-outlined text-secondary text-3xl font-bold">
                  api
                </span>
                <span className="font-mono text-[13px] font-bold text-on-surface">
                  Graph_API
                </span>
                <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-secondary/20 rounded-full blur-xl animate-pulse"></div>
              </div>
            </div>
            {/* Floating Prompt Bar (Enhanced) */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-[92%] max-w-md glass-vibrant rounded-2xl border border-white/10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)] flex items-center px-6 py-4 z-40">
              <span className="material-symbols-outlined text-primary mr-3 text-2xl animate-spin-slow">
                auto_awesome
              </span>
              <span className="text-on-surface font-mono text-[13px] font-medium truncate">
                Optimize PostgreSQL query performance for User_DB...
              </span>
              <div className="w-2 h-5 bg-primary/80 ml-2 animate-pulse rounded-full shadow-[0_0_12px_rgba(var(--primary-rgb),0.5)]"></div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
