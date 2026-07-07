"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import AnalyzeModal from "@/components/landing/AnalyzeModal";
import { useAuth } from "@/contexts/AuthContext";

export default function NewRepoPage() {
  const { user, isLoading: authLoading } = useAuth();
  const params = useParams();
  const router = useRouter();
  const urlUserId = params?.userId as string;
  const [isOpen, setIsOpen] = useState(true);

  // Redirect if userId doesn't match authenticated user
  useEffect(() => {
    if (!authLoading && user && urlUserId && user.id !== urlUserId) {
      router.replace(`/new-repo/${user.id}`);
    }
  }, [authLoading, user, urlUserId, router]);

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(() => {
      router.push(`/dashboard/${user?.id || ""}`);
    }, 300);
  };

  if (!authLoading && user && urlUserId && user.id !== urlUserId) {
    return null;
  }

  return (
    <div className="h-full w-full flex items-center justify-center p-6 md:p-10 -mt-10">
      <AnalyzeModal 
        isOpen={isOpen} 
        onClose={handleClose} 
        inline={true}
      />
    </div>
  );
}
