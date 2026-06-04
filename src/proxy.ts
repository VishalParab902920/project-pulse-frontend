import { NextRequest, NextResponse } from "next/server";

/**
 * Next.js Edge Proxy — Strict Auth Guard
 *
 * Intercepts all requests to /app and /app/* routes and verifies the
 * presence of the Supabase access token cookie. Issues a hard redirect
 * to /login if the token is missing. No development mode bypasses.
 *
 * Cookie name: sb-access-token (set by client after Supabase auth)
 */

const TOKEN_COOKIE = "sb-access-token";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(TOKEN_COOKIE)?.value;

  // Protected routes: /app and all sub-routes
  const isProtectedRoute =
    pathname === "/app" || pathname.startsWith("/app/");

  // Auth pages: /login and /register
  const isAuthRoute =
    pathname === "/login" ||
    pathname === "/register" ||
    pathname.startsWith("/login/") ||
    pathname.startsWith("/register/");

  // Protected route without token → hard redirect to /login
  if (isProtectedRoute && !token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Auth route with token present → redirect to /app
  if (isAuthRoute && token) {
    return NextResponse.redirect(new URL("/app", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app", "/app/:path*", "/login", "/register"],
};
