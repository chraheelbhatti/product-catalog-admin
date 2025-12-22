import { NextResponse } from "next/server";
import { createAuthCookie, isAuthConfigured, verifyAdminCredentials } from "@/lib/auth";

export async function POST(req: Request) {
  // Debug Logs: These will show up in your VS Code terminal when you try to log in
  console.log("------------------------------------------------");
  console.log("Login Attempt Received");
  console.log("Configured Admin Email:", process.env.ADMIN_EMAIL);
  // Do not log the full password for security, just check if it exists
  console.log("Configured Password:", process.env.ADMIN_PASSWORD ? "****" : "MISSING"); 
  console.log("------------------------------------------------");

  if (!isAuthConfigured()) {
    return NextResponse.json(
      { error: "Admin auth is not configured on this server." },
      { status: 500 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as Partial<{
    email: string;
    password: string;
  }>;

  const email = (body.email ?? "").trim();
  const password = body.password ?? "";

  if (!email || !password) {
    return NextResponse.json({ error: "Missing email or password." }, { status: 400 });
  }

  if (!verifyAdminCredentials(email, password)) {
    console.log("❌ Credential Mismatch");
    console.log("Received Email:", email);
    console.log("Received Password:", password);
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  console.log("✅ Login Successful!");
  const res = NextResponse.json({ ok: true });
  res.headers.append("Set-Cookie", createAuthCookie());
  return res;
}