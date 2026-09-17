import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/auth(.*)",
  "/api(.*)",
  "/__clerk(.*)",
]);

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

function getLegacyUserIdFromToken(token: string): string | null {
  const payload = decodeJwtPayload(token);
  if (!payload) return null;
  const sub = payload.sub;
  return typeof sub === "string" ? sub : null;
}

export const proxy = clerkMiddleware(async (auth, request: NextRequest) => {
  const { pathname } = request.nextUrl;
  const { userId: clerkUserId } = await auth();

  const legacyToken = request.cookies.get("repohawk_access_token")?.value;
  const legacyUserId = legacyToken ? getLegacyUserIdFromToken(legacyToken) : null;
  const effectiveUserId = clerkUserId || legacyUserId;

  const isPublic = isPublicRoute(request);

  // Redirect unauthenticated users away from private routes
  if (!isPublic && !effectiveUserId) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users from /dashboard or /new-repo to userId-specific URL
  if (!isPublic && effectiveUserId) {
    const pathSegments = pathname.split("/").filter(Boolean);
    const basePath = pathSegments[0];

    if ((basePath === "dashboard" || basePath === "new-repo") && pathSegments.length === 1) {
      return NextResponse.redirect(new URL(`/${basePath}/${effectiveUserId}`, request.url));
    }

    if ((basePath === "dashboard" || basePath === "new-repo") && pathSegments.length >= 2) {
      const urlUserId = pathSegments[1];
      if (urlUserId !== effectiveUserId) {
        return NextResponse.redirect(new URL(`/${basePath}/${effectiveUserId}`, request.url));
      }
    }
  }

  return NextResponse.next();
});

export default proxy;

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
