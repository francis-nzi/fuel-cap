"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/lib/actions";

export default function DashboardLoginPage() {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, undefined);

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-brand-midnight px-5 text-white">
      <div className="w-full max-w-sm">
        <p className="font-display text-center text-2xl font-bold">FuelCap</p>
        <h1 className="mt-1 text-center text-sm text-white/60">Signups dashboard</h1>

        <form action={action} className="mt-8 flex flex-col gap-4">
          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-white/70">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoFocus
              required
              className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-base text-white focus:border-brand-emerald focus:outline-none"
            />
          </div>

          {state?.error && <p className="text-sm font-medium text-brand-coral">{state.error}</p>}

          <button
            type="submit"
            disabled={pending}
            className="mt-2 rounded-xl bg-brand-emerald px-4 py-3 font-bold text-white transition disabled:opacity-60"
          >
            {pending ? "Checking…" : "View dashboard"}
          </button>
        </form>
      </div>
    </div>
  );
}
