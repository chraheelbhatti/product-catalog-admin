import { NextResponse } from "next/server";

import { clearAuthCookie } from "@/lib/auth";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.headers.append("Set-Cookie", clearAuthCookie());
  return res;
}