import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const publicPaths = ["/", "/auth/login", "/auth/signup", "/auth/forgot-password", "/auth/reset-password"];
const privatePaths = ["/dashboard", "/new-repo", "/settings", "/repo"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("repohawk_access_token")?.value;

  const isPublic = publicPaths.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const isPrivate = privatePaths.some((p) => pathname === p || pathname.startsWith(p + "/"));

  // Redirect unauthenticated users away from private routes
  if (isPrivate && !token) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect logged-in users away from auth pages
  if (isPublic && token && pathname.startsWith("/auth")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|fonts).*)"],
};
