"use client";

import React from "react";

const features = [
  {
    title: "Connect Repo",
    description:
      "Grant access to your codebase with one click. We analyze the structure without storing your proprietary logic.",
    icon: "rebase",
    color: "text-primary",
    badgeBg: "bg-primary/10 border-primary/20",
    glow: "shadow-[0_0_20px_rgba(191,194,255,0.1)] hover:shadow-[0_0_32px_rgba(191,194,255,0.2)]",
    accent: "group-hover:border-primary/30",
  },
  {
    title: "AI Analysis",
    description:
      "Our specialized LLM reads and understands your architecture, extracting nodes, edges, and dependencies instantly.",
    icon: "computer",
    color: "text-secondary",
    badgeBg: "bg-secondary/10 border-secondary/20",
    glow: "shadow-[0_0_20px_rgba(82,221,180,0.1)] hover:shadow-[0_0_32px_rgba(82,221,180,0.2)]",
    accent: "group-hover:border-secondary/30",
  },
  {
    title: "Interact & Edit",
    description:
      "Manipulate the generated diagrams directly as your UI. Drag, connect, and prompt to refactor your actual code.",
    icon: "ink_pen",
    color: "text-tertiary",
    badgeBg: "bg-tertiary/10 border-tertiary/20",
    glow: "shadow-[0_0_20px_rgba(190,194,255,0.08)] hover:shadow-[0_0_32px_rgba(190,194,255,0.15)]",
    accent: "group-hover:border-tertiary/30",
  },
];

export default function Features() {
  return (
    <section className="mt-20 mx-4 md:mx-10 lg:mx-20 rounded-[40px] relative overflow-hidden border border-primary/20 dark:border-white/10 hover:dark:border-white/20 bg-surface-container-lowest/80 dark:bg-white/[0.03] shadow-2xl backdrop-blur-2xl transition-all duration-300">
      
      {/* Interactive Ambient Gradient */}
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/15 dark:bg-[#4a50c5]/25 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-secondary/15 dark:bg-[#00b08a]/25 blur-[100px] rounded-full pointer-events-none" />

      <div className="relative z-10 flex flex-col gap-12 px-8 py-20 lg:py-28 @container">
        {/* Section Header */}
        <div className="flex flex-col gap-6 text-center items-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-b from-[#4a50c5]/10 to-[#4a50c5]/5 dark:from-white/10 dark:to-white/5 shadow-[0_4px_12px_rgba(74,80,197,0.15),inset_0_1px_1px_rgba(255,255,255,1),inset_0_-1px_1px_rgba(74,80,197,0.1)] dark:shadow-[0_4px_12px_rgba(0,0,0,0.2),inset_0_1px_1px_rgba(255,255,255,0.2),inset_0_-1px_1px_rgba(0,0,0,0.2)] border border-[#4a50c5]/20 dark:border-white/10 backdrop-blur-xl">
            <div className="w-2 h-2 rounded-full bg-[#4a50c5] animate-pulse shadow-[0_0_8px_rgba(74,80,197,0.8)]" />
            <h2 className="text-[#4a50c5] dark:text-[#a5acff] font-mono text-[11px] uppercase tracking-[0.15em] font-bold">
              Product Capabilities
            </h2>
          </div>
          <div className="flex flex-col gap-4">
            <h3 className="text-on-surface text-4xl md:text-5xl lg:text-6xl font-headline font-extrabold leading-[1.1] max-w-[840px] tracking-[-0.03em]">
              Turn your repository into a <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#4a50c5] to-[#00b08a]">
                living mental model.
              </span>
            </h3>
            <p className="text-on-surface-variant text-lg font-sans max-w-2xl mx-auto opacity-80 leading-relaxed">
              Experience diagram-driven development. Our AI extracts patterns, maps flows, and helps you ship complex features with architectural clarity.
            </p>
          </div>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto w-full">
          {features.map((feature, index) => (
            <div
              key={index}
              className={`group flex flex-col gap-8 rounded-[32px] bg-gradient-to-b from-white/90 to-white/50 dark:from-white/10 dark:to-white/[0.02] p-10 transition-all duration-500 hover:-translate-y-2 border border-white dark:border-white/10 hover:border-primary/20 hover:dark:border-white/20 backdrop-blur-3xl shadow-[0_16px_40px_rgba(0,0,0,0.06),inset_0_2px_0_rgba(255,255,255,0.8)] dark:shadow-[0_16px_40px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)] ${feature.glow} ${feature.accent}`}
            >
              <div className={`w-16 h-16 rounded-2xl border ${feature.badgeBg} flex items-center justify-center ${feature.color} transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 shadow-inner`}>
                <span className="material-symbols-outlined" style={{ fontSize: "32px" }}>
                  {feature.icon}
                </span>
              </div>
              <div className="flex flex-col gap-3">
                <h4 className="text-on-surface text-2xl font-headline font-bold tracking-tight">
                  {feature.title}
                </h4>
                <p className="text-on-surface-variant text-base font-normal leading-relaxed opacity-90">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
