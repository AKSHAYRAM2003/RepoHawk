import React from "react";
import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import Features from "@/components/landing/Features";
import Footer from "@/components/landing/Footer";

export default function Home() {
  return (
    <div className="relative flex min-h-screen w-full flex-col bg-surface text-on-surface antialiased selection:bg-primary selection:text-on-primary font-sans">
      {/* Ambient Background Glows */}
      <div className="pointer-events-none absolute -top-40 left-1/4 h-[500px] w-[500px] rounded-full bg-primary/10 blur-[120px]"></div>
      <div className="pointer-events-none absolute top-1/3 right-0 h-[400px] w-[400px] rounded-full bg-secondary/10 blur-[120px]"></div>

      <div className="layout-container flex h-full grow flex-col relative z-10">
        <Navbar />

        <div className="flex-grow">
          <Hero />
          <Features />

          {/* Bottom CTA Section */}
          <section className="flex flex-col justify-center items-center gap-8 px-4 py-24 text-center relative overflow-hidden">
            <div className="absolute w-full h-[200px] bottom-0 left-0 bg-gradient-to-t from-primary/5 to-transparent pointer-events-none"></div>
            <h2 className="text-on-surface text-[32px] md:text-5xl font-headline font-extrabold leading-tight tracking-[-0.02em] max-w-[720px] relative z-10">
              Ready to visualize your code?
            </h2>
            <button className="flex items-center justify-center rounded-xl h-14 px-8 bg-gradient-to-br from-primary to-primary-container text-on-primary text-lg font-bold shadow-[0_0_32px_rgba(191,194,255,0.25)] hover:shadow-[0_0_48px_rgba(191,194,255,0.4)] transition-shadow relative z-10 group">
              <span>Get Started for Free</span>
            </button>
          </section>
        </div>

        <Footer />
      </div>
    </div>
  );
}
