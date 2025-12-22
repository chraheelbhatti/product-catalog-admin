"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotStatus, setForgotStatus] = useState<string | null>(null);
  const [forgotLoading, setForgotLoading] = useState(false);

async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      console.log("Attempting login..."); // Debug log 1

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      console.log("Server responded with status:", res.status); // Debug log 2

      // 1. Read text first to prevent JSON crashes
      const text = await res.text(); 
      let json: { error?: string } = {};
      
      try {
        json = JSON.parse(text);
      } catch (err) {
        console.error("Could not parse server response:", text);
      }

      // 2. Handle Errors
      if (!res.ok) {
        if (res.status === 401) {
          setError("❌ Wrong email or password.");
        } else if (res.status === 500) {
          setError("⚠️ Server Error. Check your terminal for details.");
        } else {
          // If we have a JSON error, show it. Otherwise show the raw text (truncated)
          setError(json.error || `Error (${res.status}): ${text.slice(0, 50)}`);
        }
        setLoading(false);
        return;
      }

      // 3. Success
      console.log("Login successful, redirecting...");
      router.push(next);
      router.refresh();
      
    } catch (err) {
      console.error("Network error:", err);
      setError("⛔ Network Error: Is the server running?");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold">Sign in to Zee Ordering</h1>
        <p className="mb-4 text-sm text-zinc-500">Single admin access only.</p>

        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-zinc-600" htmlFor="email">
              Email or ID
            </label>
            <input
              id="email"
              type="text"
              autoComplete="username"
              className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-400"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-zinc-600" htmlFor="password">
              Password
            </label>
            <div className="flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1.5 focus-within:ring-2 focus-within:ring-zinc-400">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                className="w-full border-none bg-transparent text-sm outline-none"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="text-[11px] font-medium text-zinc-500"
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            className="mt-2 w-full rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
            disabled={loading}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>

          <div className="mt-3 border-t pt-3 text-xs text-zinc-500">
            <p className="mb-1 font-medium text-zinc-600">Forgot password?</p>
            <p className="mb-2">
              Enter the owner email configured on the server. If it matches,
              the app will send the current admin ID and password to that address.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="email"
                placeholder="Owner email"
                className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-zinc-400"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
              />
              <button
                type="button"
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 disabled:opacity-60"
                disabled={forgotLoading || !forgotEmail}
                onClick={async () => {
                  setForgotLoading(true);
                  setForgotStatus(null);
                  try {
                    const res = await fetch("/api/auth/forgot", {
                      method: "POST",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({ email: forgotEmail }),
                    });
                    const json = (await res.json().catch(() => ({}))) as { error?: string };
                    if (!res.ok) {
                      setForgotStatus(json.error || `Could not send email (${res.status})`);
                    } else {
                      setForgotStatus("If the email matches the owner address, the admin credentials have been sent.");
                    }
                  } catch (err) {
                    setForgotStatus(
                      err instanceof Error ? err.message : "Could not send reset email.",
                    );
                  } finally {
                    setForgotLoading(false);
                  }
                }}
              >
                {forgotLoading ? "Sending…" : "Send to owner"}
              </button>
            </div>
            {forgotStatus ? (
              <p className="mt-1 text-[11px] text-zinc-600">{forgotStatus}</p>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );
}