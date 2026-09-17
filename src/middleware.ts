import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export default async function middleware(req: NextRequest) {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  const token = await getToken({ req, secret });
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