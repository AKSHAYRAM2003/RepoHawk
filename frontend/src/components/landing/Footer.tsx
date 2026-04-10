"use client";

import React from "react";

export default function Footer() {
  return (
    <footer className="flex flex-col gap-6 px-6 py-10 text-center border-t border-outline-variant/10 mt-auto bg-surface relative z-20">
      <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
        <a
          className="text-on-surface-variant hover:text-primary transition-colors text-sm font-medium"
          href="#"
        >
          Privacy Policy
        </a>
        <a
          className="text-on-surface-variant hover:text-primary transition-colors text-sm font-medium"
          href="#"
        >
          Terms of Service
        </a>
        <a
          className="text-on-surface-variant hover:text-primary transition-colors text-sm font-medium"
          href="#"
        >
          Twitter
        </a>
        <a
          className="text-on-surface-variant hover:text-primary transition-colors text-sm font-medium"
          href="#"
        >
          GitHub
        </a>
      </div>
      <p className="text-outline text-sm font-mono mt-4">
        © 2024 RepoHawk Inc. // System Online.
      </p>
    </footer>
  );
}
