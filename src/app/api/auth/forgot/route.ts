import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";

const SMTP_HOST = process.env.SMTP_HOST ?? "";
const SMTP_PORT = Number(process.env.SMTP_PORT ?? "587");
const SMTP_USER = process.env.SMTP_USER ?? "";
const SMTP_PASS = process.env.SMTP_PASS ?? "";
const SMTP_FROM = process.env.SMTP_FROM ?? "Zee Ordering <no-reply@example.com>";
const OWNER_EMAIL = process.env.OWNER_EMAIL ?? "";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Partial<{ email: string }>;
  const email = (body.email ?? "").trim().toLowerCase();

  if (!email) {
    return NextResponse.json({ error: "Missing email." }, { status: 400 });
  }

  if (!OWNER_EMAIL || email !== OWNER_EMAIL.trim().toLowerCase()) {
    return NextResponse.json({ error: "This email is not authorized for admin reset." }, { status: 403 });
  }

  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    return NextResponse.json(
      { error: "Admin credentials are not configured on the server." },
      { status: 500 },
    );
  }

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    return NextResponse.json(
      { error: "SMTP is not configured on the server (SMTP_HOST/USER/PASS)." },
      { status: 500 },
    );
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  const text = `Your Zee Ordering admin credentials:\n\nAdmin email/ID: ${ADMIN_EMAIL}\nAdmin password: ${ADMIN_PASSWORD}\n\nYou can change these values on the server via ADMIN_EMAIL and ADMIN_PASSWORD env vars.`;

  await transporter.sendMail({
    from: SMTP_FROM,
    to: OWNER_EMAIL,
    subject: "Zee Ordering admin credentials",
    text,
  });

  return NextResponse.json({ ok: true });
}