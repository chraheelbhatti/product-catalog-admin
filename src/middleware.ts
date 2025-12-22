import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const PROTECTED_PATH_PREFIXES = ["/", "/api/products", "/api/import/sheets", "/api/export/order"];
const PUBLIC_PATH_PREFIXES = ["/api/health", "/login", "/_next", "/favicon.ico", "/public", "/api/auth"];
const AUTH_COOKIE_NAME = "zee_admin";

function isPublicPath(pathname: string) {
  return PUBLIC_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));
}

function isProtectedPath(pathname: string) {
  if (isPublicPath(pathname)) return false;
  return PROTECTED_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(AUTH_COOKIE_NAME)?.value;

  if (cookie) {
    return NextResponse.next();
  }

  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("next", pathname || "/");

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/:path*", "/api/:path*"],
};