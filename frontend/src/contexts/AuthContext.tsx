"use client";

import { createContext, useContext, useState, ReactNode, useMemo } from "react";
import { useUser, useClerk, useAuth as useClerkAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

export interface User {
  id: string;
  email: string;
  name: string | null;
  is_verified: boolean;
  github_id: number | null;
  github_username: string | null;
  avatar_url: string | null;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: { name?: string; avatar_url?: string }) => Promise<void>;
  isLoginModalOpen: boolean;
  setLoginModalOpen: (open: boolean) => void;
  isSignupModalOpen: boolean;
  setSignupModalOpen: (open: boolean) => void;
  getToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { user: clerkUser, isLoaded, isSignedIn } = useUser();
  const { signOut } = useClerk();
  const { getToken } = useClerkAuth();
  const router = useRouter();

  const [isLoginModalOpen, setLoginModalOpen] = useState(false);
  const [isSignupModalOpen, setSignupModalOpen] = useState(false);

  // Map Clerk user to RepoHawk User interface
  const user: User | null = useMemo(() => {
    if (!isSignedIn || !clerkUser) return null;
    return {
      id: clerkUser.id,
      email: clerkUser.primaryEmailAddress?.emailAddress || "",
      name: clerkUser.fullName || clerkUser.firstName || clerkUser.username || null,
      is_verified: true,
      github_id: null,
      github_username: clerkUser.externalAccounts?.find(
        (a) => (a.provider as string).includes("github")
      )?.username || null,
      avatar_url: clerkUser.imageUrl || null,
      created_at: clerkUser.createdAt
        ? new Date(clerkUser.createdAt).toISOString()
        : new Date().toISOString(),
    };
  }, [isSignedIn, clerkUser]);

  const login = async (_email: string, _password: string) => {
    setLoginModalOpen(true);
  };

  const signup = async (_name: string, _email: string, _password: string) => {
    setSignupModalOpen(true);
  };

  const logout = async () => {
    await signOut({ redirectUrl: "/" });
    router.push("/");
  };

  const updateProfile = async (data: { name?: string; avatar_url?: string }) => {
    if (!clerkUser) return;
    if (data.name) {
      const parts = data.name.split(" ");
      const firstName = parts[0];
      const lastName = parts.slice(1).join(" ") || undefined;
      await clerkUser.update({ firstName, lastName });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!isSignedIn,
        isLoading: !isLoaded,
        login,
        signup,
        logout,
        updateProfile,
        isLoginModalOpen,
        setLoginModalOpen,
        isSignupModalOpen,
        setSignupModalOpen,
        getToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
