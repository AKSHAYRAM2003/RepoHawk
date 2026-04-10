"use client";

import React from "react";

const features = [
  {
    title: "Connect Repo",
    description:
      "Grant access to your codebase with one click. We analyze the structure without storing your proprietary logic.",
    icon: "rebase",
    color: "text-primary",
  },
  {
    title: "AI Analysis",
    description:
      "Our specialized LLM reads and understands your architecture, extracting nodes, edges, and dependencies instantly.",
    icon: "computer",
    color: "text-secondary",
  },
  {
    title: "Interact & Edit",
    description:
      "Manipulate the generated diagrams directly as your UI. Drag, connect, and prompt to refactor your actual code.",
    icon: "ink_pen",
    color: "text-tertiary",
  },
];

export default function Features() {
  return (
    <section className="mt-20 rounded-3xl bg-surface-container-low flex flex-col gap-12 px-8 py-16 lg:py-24 @container relative overflow-hidden">
      {/* Section Header */}
      <div className="flex flex-col gap-4 text-center items-center relative z-10">
        <h2 className="text-primary font-mono text-sm uppercase tracking-[0.1em] font-semibold">
          The Architecture
        </h2>
        <h3 className="text-on-surface text-3xl md:text-4xl lg:text-[40px] font-headline font-bold leading-tight max-w-[720px] tracking-[-0.02em]">
          Connect your repository and let our AI build the mental model for you.
        </h3>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10 max-w-5xl mx-auto w-full">
        {features.map((feature, index) => (
          <div
            key={index}
            className="flex flex-col gap-6 rounded-2xl bg-surface-container-high p-8 transition-all hover:bg-surface-container-highest hover:-translate-y-1 border border-transparent hover:border-outline-variant/10 shadow-lg group"
          >
            <div className={`w-14 h-14 rounded-xl bg-surface-container-lowest border border-outline-variant/15 flex items-center justify-center ${feature.color} shadow-[0_0_15px_rgba(191,194,255,0.05)]`}>
              <span className="material-symbols-outlined" style={{ fontSize: "28px" }}>
                {feature.icon}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              <h4 className="text-on-surface text-xl font-headline font-bold">
                {feature.title}
              </h4>
              <p className="text-on-surface-variant text-base font-normal leading-relaxed">
                {feature.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
