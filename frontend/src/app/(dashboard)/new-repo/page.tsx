"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import AnalyzeModal from "@/components/landing/AnalyzeModal";

export default function NewRepoPage() {
  const [isOpen, setIsOpen] = useState(true);
  const router = useRouter();

  const handleClose = () => {
    setIsOpen(false);
    // Add a slight delay to allow the close animation to run
    setTimeout(() => {
      router.push("/dashboard");
    }, 300);
  };

  return (
    <div className="h-full w-full flex items-center justify-center p-6 md:p-10 -mt-10">
      {/* 
        We render the AnalyzeModal inline here so it shows natively 
        on the page rather than as a fixed overlay popup.
      */}
      <AnalyzeModal 
        isOpen={isOpen} 
        onClose={handleClose} 
        inline={true}
      />
    </div>
  );
}
