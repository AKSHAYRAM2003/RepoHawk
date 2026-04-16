"use client";

import React, { useState } from "react";
import AnalyzeModal from "./AnalyzeModal";

export default function AnalyzeCTA() {
  const [isAnalyzeModalOpen, setIsAnalyzeModalOpen] = useState(false);

  return (
    <>
      <button 
        onClick={() => setIsAnalyzeModalOpen(true)}
        className="group flex items-center justify-center rounded-full h-14 md:h-16 px-10 md:px-12 bg-gradient-to-b from-[#4a50c5] to-[#00b08a] text-white text-lg md:text-xl font-bold shadow-[0_8px_24px_rgba(74,80,197,0.3),inset_0_2px_1px_rgba(255,255,255,0.4),inset_0_-2px_2px_rgba(0,0,0,0.2)] border border-white/20 hover:shadow-[0_12px_32px_rgba(74,80,197,0.4),inset_0_2px_1px_rgba(255,255,255,0.6),inset_0_-2px_2px_rgba(0,0,0,0.2)] hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all"
      >
        <span>Analyze My Codebase for Free</span>
        <span className="ml-2 transition-transform duration-300 group-hover:translate-x-1">→</span>
      </button>

      <AnalyzeModal 
        isOpen={isAnalyzeModalOpen} 
        onClose={() => setIsAnalyzeModalOpen(false)} 
      />
    </>
  );
}
