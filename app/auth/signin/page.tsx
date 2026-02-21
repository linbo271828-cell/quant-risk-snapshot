"use client";

import { Suspense } from "react";
import { getProviders, signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

function SignInForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/portfolios";
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [providerIds, setProviderIds] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    void getProviders().then((providers) => {
      if (cancelled || !providers) return;
      setProviderIds(Object.keys(providers));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const canSubmit = useMemo(() => {
    return username.trim().length >= 3 && password.length >= 8;
  }, [username, password]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || loading) return;
    setLoading(true);
    setError("");
    try {
      const normalizedUsername = username.trim().toLowerCase();
      // #region agent log
      fetch("http://127.0.0.1:7242/ingest/540f29d3-b53c-4854-a947-0acc20fc668e",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({runId:"signin-flow",hypothesisId:"H1",location:"app/auth/signin/page.tsx:onSubmit:start",message:"Auth submit started",data:{mode,usernameLength:normalizedUsername.length,passwordLength:password.length,canSubmit},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      if (mode === "signup") {
        const signupRes = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: normalizedUsername, password }),
        });
        const signupData = await signupRes.json();
        // #region agent log
        fetch("http://127.0.0.1:7242/ingest/540f29d3-b53c-4854-a947-0acc20fc668e",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({runId:"signin-flow",hypothesisId:"H2",location:"app/auth/signin/page.tsx:onSubmit:signupResponse",message:"Signup API response",data:{status:signupRes.status,ok:signupRes.ok,hasError:Boolean(signupData?.error)},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        if (!signupRes.ok) throw new Error(signupData?.error ?? "Failed to create account.");
      }

      const result = await signIn("credentials", {
        redirect: false,
        username: normalizedUsername,
        password,
        callbackUrl,
      });
      // #region agent log
      fetch("http://127.0.0.1:7242/ingest/540f29d3-b53c-4854-a947-0acc20fc668e",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({runId:"signin-flow",hypothesisId:"H3",location:"app/auth/signin/page.tsx:onSubmit:signInResult",message:"Credentials signIn result",data:{hasResult:Boolean(result),hasError:Boolean(result?.error),ok:result?.ok ?? null,status:result?.status ?? null},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      if (result?.error) throw new Error("Invalid username or password.");
      window.location.href = callbackUrl;
    } catch (err) {
      // #region agent log
      fetch("http://127.0.0.1:7242/ingest/540f29d3-b53c-4854-a947-0acc20fc668e",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({runId:"signin-flow",hypothesisId:"H4",location:"app/auth/signin/page.tsx:onSubmit:catch",message:"Auth submit failed",data:{errorMessage:err instanceof Error ? err.message : "unknown"},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
      <h1 className="text-xl font-semibold text-slate-900">Account access</h1>
      <p className="mt-2 text-sm text-slate-500">
        Create an account with username/password or sign in to access your private portfolios.
      </p>
      <div className="mt-5 grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1 text-sm">
        <button
          type="button"
          onClick={() => setMode("signin")}
          className={`rounded-md px-3 py-2 ${mode === "signin" ? "bg-white font-semibold text-slate-900" : "text-slate-500"}`}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => setMode("signup")}
          className={`rounded-md px-3 py-2 ${mode === "signup" ? "bg-white font-semibold text-slate-900" : "text-slate-500"}`}
        >
          Sign up
        </button>
      </div>

      <form className="mt-4 space-y-3" onSubmit={onSubmit}>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Username</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. alice_01"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
            autoComplete="username"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Password</span>
          <div className="flex gap-2">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 chars, include letters and numbers"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </label>

        {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</div> : null}

        <button
          type="submit"
          disabled={!canSubmit || loading}
          className="w-full rounded-lg bg-slate-900 px-4 py-3 font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Please wait..." : mode === "signup" ? "Create account" : "Sign in"}
        </button>
      </form>

      {providerIds.includes("github") || providerIds.includes("google") ? (
        <>
          <div className="my-4 text-center text-xs uppercase tracking-wide text-slate-400">or continue with</div>
          <div className="grid gap-2">
            {providerIds.includes("github") ? (
              <button
                type="button"
                onClick={() => signIn("github", { callbackUrl })}
                className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Continue with GitHub
              </button>
            ) : null}
            {providerIds.includes("google") ? (
              <button
                type="button"
                onClick={() => signIn("google", { callbackUrl })}
                className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Continue with Google
              </button>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

export default function SignInPage() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center">
      <Suspense fallback={<div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm animate-pulse h-32 w-96" />}>
        <SignInForm />
      </Suspense>
    </main>
  );
}
