import { cookies } from "next/headers";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const AUTH_COOKIE_NAME = "zee_admin";

export function isAuthConfigured() {
  return Boolean(ADMIN_EMAIL && ADMIN_PASSWORD);
}

export function verifyAdminCredentials(email: string, password: string) {
  if (!isAuthConfigured()) return false;
  const normalizedEmail = email.trim().toLowerCase();
  const envEmail = (ADMIN_EMAIL ?? "").trim().toLowerCase();
  return normalizedEmail === envEmail && password === (ADMIN_PASSWORD ?? "");
}

export function createAuthCookie() {
  return `${AUTH_COOKIE_NAME}=1; Path=/; HttpOnly; SameSite=Lax`;
}

export function clearAuthCookie() {
  return `${AUTH_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`;
}

export async function requireAdminFromRequest(req: Request) {
  const cookieHeader = req.headers.get("cookie") ?? "";
  return cookieHeader.split(";").some((c) => c.trim().startsWith(`${AUTH_COOKIE_NAME}=`));
}

export async function requireAdminFromNextHeaders() {
  const store = await cookies();
  const token = store.get(AUTH_COOKIE_NAME)?.value;
  return Boolean(token);
}