"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";

export default function SignInPage() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/portfolios";

  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center">
      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Sign in to use Portfolios</h1>
        <p className="mt-2 text-sm text-slate-500">
          Your saved portfolios are private. Sign in with GitHub to view and manage only your own.
        </p>
        <button
          type="button"
          onClick={() => signIn("github", { callbackUrl })}
          className="mt-6 w-full rounded-lg bg-slate-900 px-4 py-3 font-medium text-white hover:bg-slate-800"
        >
          Sign in with GitHub
        </button>
      </div>
    </main>
  );
}
