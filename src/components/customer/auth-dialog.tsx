"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { primaryButton } from "./ui";

export function AuthDialog({ close }: { close: () => void }) {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const supabase = createClient();
    const result = mode === "sign-in"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: email.split("@")[0] },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
    setBusy(false);
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    if (mode === "sign-up" && !result.data.session) {
      setMessage("Check your email to confirm your FuelCap account.");
      return;
    }
    close();
  }

  return <div role="dialog" aria-modal="true" aria-labelledby="auth-title" className="fixed inset-0 z-[60] grid place-items-center bg-[#0b1b2b]/55 p-4"><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
    <div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase text-[#0b7a4b]">FuelCap account</p><h2 id="auth-title" className="text-xl font-bold">{mode === "sign-in" ? "Sign in" : "Create account"}</h2></div><button onClick={close} className="grid size-11 place-items-center rounded-xl border border-[#dce5df]" aria-label="Close"><X size={18} /></button></div>
    <form onSubmit={submit} className="mt-6 space-y-4">
      <label className="block text-sm font-semibold">Email<input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-[#cdd9d1] px-3 font-normal" /></label>
      <label className="block text-sm font-semibold">Password<input required minLength={8} type="password" autoComplete={mode === "sign-in" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-[#cdd9d1] px-3 font-normal" /></label>
      {message && <p role="status" className="rounded-xl bg-[#fff0ed] px-3 py-2 text-sm text-[#8a3026]">{message}</p>}
      <button disabled={busy} className={`${primaryButton} w-full`}>{busy ? "Please wait..." : mode === "sign-in" ? "Sign in" : "Create account"}</button>
    </form>
    <button onClick={() => { setMode(mode === "sign-in" ? "sign-up" : "sign-in"); setMessage(null); }} className="mt-4 min-h-11 w-full text-center text-sm font-semibold text-[#0b7a4b]">{mode === "sign-in" ? "Create a new account" : "Already have an account? Sign in"}</button>
  </div></div>;
}
