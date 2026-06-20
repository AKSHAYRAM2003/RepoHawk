import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const FASTAPI_URL = process.env.FASTAPI_URL || "http://localhost:8003/api/v1";

const publicPaths = ["/", "/auth/login", "/auth/signup", "/auth/forgot-password", "/auth/reset-password"];
const privatePaths = ["/dashboard", "/new-repo", "/settings", "/repo"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("repohawk_access_token")?.value;

  const isPublic = publicPaths.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const isPrivate = privatePaths.some((p) => pathname === p || pathname.startsWith(p + "/"));

  if (isPrivate && !token) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isPublic && token && pathname.startsWith("/auth")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|fonts).*)"],
};
