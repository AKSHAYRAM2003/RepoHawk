import React from "react";
import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import Features from "@/components/landing/Features";
import Footer from "@/components/landing/Footer";

export default function Home() {
  return (
    <div className="relative flex min-h-screen w-full flex-col bg-surface text-on-surface antialiased selection:bg-primary selection:text-on-primary font-sans">
      {/* Ambient Background Glows */}
      <div className="pointer-events-none fixed -top-40 left-1/4 h-[600px] w-[600px] rounded-full bg-primary/10 blur-[120px]" />
      <div className="pointer-events-none fixed top-1/3 right-0 h-[400px] w-[400px] rounded-full bg-secondary/8 blur-[120px]" />
      <div className="pointer-events-none fixed bottom-0 left-0 h-[400px] w-[400px] rounded-full bg-tertiary/6 blur-[140px]" />

      <div className="layout-container flex h-full grow flex-col relative z-10">
        <Navbar />

        <div className="flex-grow">
          <Hero />
          <Features />

          {/* Bottom CTA Section - Differentiated Glass Card */}
          <section className="mx-4 md:mx-10 lg:mx-20 my-24 relative">
            {/* The Floating Card Container */}
            <div className="relative overflow-hidden rounded-[40px] border border-primary/20 dark:border-white/10 hover:dark:border-white/20 bg-surface-container-lowest/80 dark:bg-white/[0.03] shadow-2xl backdrop-blur-2xl transition-all duration-300">
              
              {/* Vibrant Ambient Glows inside the CTA */}
              <div className="absolute top-[-40%] right-[-10%] w-[500px] h-[500px] bg-primary/15 dark:bg-[#4a50c5]/25 blur-[100px] rounded-full pointer-events-none" />
              <div className="absolute bottom-[-40%] left-[-10%] w-[400px] h-[400px] bg-secondary/15 dark:bg-[#00b08a]/25 blur-[100px] rounded-full pointer-events-none" />

              <div className="relative z-10 flex flex-col justify-center items-center gap-10 px-8 py-20 md:py-28 text-center">
                
                {/* Micro-badge */}
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-b from-[#4a50c5]/10 to-[#4a50c5]/5 dark:from-white/10 dark:to-white/5 shadow-[0_4px_12px_rgba(74,80,197,0.15),inset_0_1px_1px_rgba(255,255,255,1),inset_0_-1px_1px_rgba(74,80,197,0.1)] dark:shadow-[0_4px_12px_rgba(0,0,0,0.2),inset_0_1px_1px_rgba(255,255,255,0.2),inset_0_-1px_1px_rgba(0,0,0,0.2)] border border-[#4a50c5]/20 dark:border-white/10 backdrop-blur-xl">
                  <div className="w-2 h-2 rounded-full bg-[#4a50c5] animate-pulse shadow-[0_0_8px_rgba(74,80,197,0.8)]" />
                  <span className="text-[#4a50c5] dark:text-[#a5acff] font-mono text-[11px] uppercase tracking-[0.15em] font-bold">
                    Start your journey
                  </span>
                </div>
                
                {/* Text Content */}
                <div className="flex flex-col gap-5">
                  <h2 className="text-on-surface text-4xl md:text-5xl lg:text-6xl font-headline font-extrabold leading-[1.1] tracking-[-0.03em] max-w-[800px]">
                    Ready to visualize <br className="hidden md:block" />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#4a50c5] to-[#00b08a]">
                      your entire architecture?
                    </span>
                  </h2>
                  <p className="text-on-surface-variant text-lg md:text-xl font-sans max-w-2xl mx-auto leading-relaxed">
                    Join thousands of engineers who ship faster by understanding their codebase with RepoHawk.
                  </p>
                </div>

                {/* Primary Action Button Liquid Glass */}
                <button className="group flex items-center justify-center rounded-full h-14 md:h-16 px-10 md:px-12 bg-gradient-to-b from-[#4a50c5] to-[#00b08a] text-white text-lg md:text-xl font-bold shadow-[0_8px_24px_rgba(74,80,197,0.3),inset_0_2px_1px_rgba(255,255,255,0.4),inset_0_-2px_2px_rgba(0,0,0,0.2)] border border-white/20 hover:shadow-[0_12px_32px_rgba(74,80,197,0.4),inset_0_2px_1px_rgba(255,255,255,0.6),inset_0_-2px_2px_rgba(0,0,0,0.2)] hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all">
                  <span>Analyze My Codebase for Free</span>
                  <span className="ml-2 transition-transform duration-300 group-hover:translate-x-1">→</span>
                </button>
                
              </div>
            </div>
          </section>

        </div>

        <Footer />
      </div>
    </div>
  );
}
