"use client";

import { useAuth } from "@/contexts/AuthContext";
import { SignUp } from "@clerk/nextjs";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

export default function SignupModal() {
  const { isSignupModalOpen, setSignupModalOpen } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    setSignupModalOpen(false);
  }, [pathname, setSignupModalOpen]);

  if (!isSignupModalOpen || pathname.startsWith("/auth")) return null;

  const handleClose = () => {
    setSignupModalOpen(false);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-md"
        />

        {/* Modal Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="relative w-full max-w-md p-6 md:p-8 rounded-3xl border border-outline-variant/15 bg-surface-container-high/95 dark:bg-surface-container-high/90 shadow-2xl backdrop-blur-2xl z-10 overflow-hidden flex flex-col items-center justify-center"
        >
          {/* Close button */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-2 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-outline-variant/10 transition-all z-20"
            aria-label="Close"
          >
            <X size={20} />
          </button>

          {/* Embedded Clerk Sign Up */}
          <div className="w-full flex justify-center">
            <SignUp
              routing="hash"
              signInUrl="/auth/login"
              fallbackRedirectUrl="/"
              appearance={{
                elements: {
                  rootBox: "w-full flex justify-center",
                  card: "bg-transparent shadow-none border-none p-0 w-full",
                },
              }}
            />
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
