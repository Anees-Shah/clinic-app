import { getToken } from "next-auth/jwt";
import type { JWT } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export default async function middleware(req: NextRequest) {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  // Auth.js v5 names the session cookie by protocol: `__Secure-authjs.session-token`
  // on https, `authjs.session-token` on http (the JWT salt is the cookie name on
  // both sides). getToken() defaults to the non-secure name, so on production
  // https it never finds the just-set cookie and every login bounces straight
  // back from /dashboard to /login. Try the secure cookie first, fall back to
  // the plain one so local http dev keeps working.
  let token: JWT | null = null;
  try {
    token =
      (await getToken({
        req,
        secret,
        secureCookie: true,
        cookieName: "__Secure-authjs.session-token",
      })) ??
      (await getToken({
        req,
        secret,
        secureCookie: false,
        cookieName: "authjs.session-token",
      }));
  } catch {
    token = null;
  }
  const isLoggedIn = !!token;
  const isOnDashboard = req.nextUrl.pathname.startsWith("/dashboard");
  const isOnLogin = req.nextUrl.pathname.startsWith("/login");

  if (isOnDashboard && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  if (isOnLogin && isLoggedIn) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};