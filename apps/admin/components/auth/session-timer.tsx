"use client";

import { useEffect, useState } from "react";
import { IDLE_TIMEOUT_MS } from "@/lib/auth/config";

const WARN_BEFORE_MS = 2 * 60_000;
const PING_EVERY_MS = 60_000;
const activityEvents = ["pointerdown", "keydown", "wheel", "touchstart"] as const;

/**
 * Browser half of the 30-minute inactivity rule: reports real activity to the server (at most once a minute),
 * warns two minutes before the cut-off and signs out when it passes. The server enforces the limit regardless.
 */
export function SessionTimer() {
  const [warning, setWarning] = useState(false);

  useEffect(() => {
    let lastActivity = Date.now();
    let lastPing = Date.now();
    let signingOut = false;

    function onActivity() {
      lastActivity = Date.now();
      setWarning(false);
      if (lastActivity - lastPing < PING_EVERY_MS) return;
      lastPing = lastActivity;
      void fetch("/api/auth/activity", { method: "POST" }).then((response) => {
        if (response.status === 401) hardNavigate("/login?reason=timeout");
      }).catch(() => undefined);
    }

    const timer = window.setInterval(async () => {
      const idle = Date.now() - lastActivity;
      if (idle >= IDLE_TIMEOUT_MS && !signingOut) {
        signingOut = true;
        await fetch("/api/auth/sign-out?reason=timeout", { method: "POST" }).catch(() => undefined);
        hardNavigate("/login?reason=timeout");
      } else {
        setWarning(idle >= IDLE_TIMEOUT_MS - WARN_BEFORE_MS);
      }
    }, 15_000);

    activityEvents.forEach((name) => window.addEventListener(name, onActivity, { passive: true }));
    return () => {
      window.clearInterval(timer);
      activityEvents.forEach((name) => window.removeEventListener(name, onActivity));
    };
  }, []);

  return warning ? <div className="session-warning" role="alert">You&apos;ll be signed out in 2 minutes because the control room has been idle. Press any key or click to stay signed in.</div> : null;
}

export async function signOut() {
  await fetch("/api/auth/sign-out", { method: "POST" }).catch(() => undefined);
  hardNavigate("/login");
}

/** Full page load (not client routing) after auth changes, so the next request goes through the proxy with fresh cookies. */
export function hardNavigate(path: string) {
  window.location.assign(new URL(path, window.location.origin).toString());
}
