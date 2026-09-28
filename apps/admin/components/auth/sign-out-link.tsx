"use client";

import { signOut } from "./session-timer";

export function SignOutLink({ label = "Sign out" }: { label?: string }) {
  return <button type="button" className="auth-link" onClick={() => void signOut()}>{label}</button>;
}
