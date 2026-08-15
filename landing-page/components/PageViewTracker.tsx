"use client";

import { useEffect } from "react";
import { captureUtmParams } from "@/lib/tracking";

const FIRED_KEY_PREFIX = "fc_pageview_fired_";

export default function PageViewTracker({ market }: { market: string }) {
  useEffect(() => {
    const firedKey = FIRED_KEY_PREFIX + market;
    if (window.sessionStorage.getItem(firedKey)) return;
    window.sessionStorage.setItem(firedKey, "1");

    const utm = captureUtmParams();
    fetch("/api/pageview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ utm, path: window.location.pathname, market }),
      keepalive: true,
    }).catch(() => {});
  }, [market]);

  return null;
}
