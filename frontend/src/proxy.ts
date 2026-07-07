import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const publicPaths = ["/", "/auth/login", "/auth/signup", "/auth/forgot-password", "/auth/reset-password"];
const privatePaths = ["/dashboard", "/new-repo", "/settings", "/repo"];

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function getUserIdFromToken(token: string): string | null {
  const payload = decodeJwtPayload(token);
  if (!payload) return null;
  const sub = payload.sub;
  return typeof sub === "string" ? sub : null;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("repohawk_access_token")?.value;
  const userId = token ? getUserIdFromToken(token) : null;

  const isPublic = publicPaths.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const isPrivate = privatePaths.some((p) => pathname === p || pathname.startsWith(p + "/"));

  // Redirect unauthenticated users away from private routes
  if (isPrivate && !token) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users from /dashboard or /new-repo (without userId) to userId-specific URL
  if (isPrivate && token && userId) {
    const pathSegments = pathname.split("/").filter(Boolean);
    const basePath = pathSegments[0];

    if ((basePath === "dashboard" || basePath === "new-repo") && pathSegments.length === 1) {
      return NextResponse.redirect(new URL(`/${basePath}/${userId}`, request.url));
    }

    // If userId is in URL but doesn't match, redirect to correct one
    if ((basePath === "dashboard" || basePath === "new-repo") && pathSegments.length >= 2) {
      const urlUserId = pathSegments[1];
      if (urlUserId !== userId) {
        return NextResponse.redirect(new URL(`/${basePath}/${userId}`, request.url));
      }
    }
  }

  // Redirect logged-in users away from auth pages
  if (isPublic && token && pathname.startsWith("/auth")) {
    return NextResponse.redirect(new URL(`/dashboard/${userId || ""}`, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|fonts).*)"],
};
