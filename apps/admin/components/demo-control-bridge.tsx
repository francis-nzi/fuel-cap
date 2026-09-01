"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, CheckCircle2, Link2, LockKeyhole, RotateCcw, ShieldOff } from "lucide-react";
import { initialDemoControlSnapshot, type DemoControlCommandType, type DemoControlSnapshot } from "@fuelcap/demo-control";

export function DemoControlBridge({ actorId, role }: { actorId: string; role: string }) {
  const [snapshot, setSnapshot] = useState<DemoControlSnapshot>(initialDemoControlSnapshot);
  const [busy, setBusy] = useState<DemoControlCommandType | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/demo/control", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Demo control state is unavailable.");
        setSnapshot(await response.json() as DemoControlSnapshot);
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setError(cause instanceof Error ? cause.message : "Demo control state is unavailable.");
      });
    return () => controller.abort();
  }, []);

  async function dispatch(command: DemoControlCommandType) {
    setBusy(command); setError(null);
    try {
      const response = await fetch("/api/demo/control", { method: "POST", headers: { "Content-Type": "application/json", "X-FuelCap-Demo-Principal": actorId, "X-FuelCap-Demo-Role": role, "Idempotency-Key": `${command}:${crypto.randomUUID()}` }, body: JSON.stringify({ command }) });
      const result = await response.json() as DemoControlSnapshot & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Demo control command failed.");
      setSnapshot(result);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Demo control command failed."); }
    setBusy(null);
  }

  return <section className="demo-control-bridge" aria-labelledby="demo-control-title">
    <div className="demo-control-bridge__heading"><div><span className="section-kicker"><Link2 size={13} /> Customer pricing controls</span><h2 id="demo-control-title">Publish the customer price and quote availability</h2><p>Update the price customers see, or pause new protection while preserving accepted prices.</p></div><span className={`state-pill ${snapshot.quoteAvailability === "PAUSED" ? "state-pill--action-required" : "state-pill--nominal"}`}>{snapshot.state}</span></div>
    <div className="demo-control-bridge__actions">
      <button type="button" onClick={() => dispatch("RESET_BASELINE")} disabled={busy !== null}><RotateCcw size={15} /><span><strong>Reset baseline</strong><small>$3.42/gal · quotes available</small></span></button>
      <button type="button" onClick={() => dispatch("PUBLISH_PRICE_RISE")} disabled={busy !== null}><ArrowUpRight size={15} /><span><strong>Publish price rise</strong><small>$3.67/gal · customer notified</small></span></button>
      <button type="button" onClick={() => dispatch("WITHDRAW_NEW_QUOTES")} disabled={busy !== null}><ShieldOff size={15} /><span><strong>Stop new quotes</strong><small>Accepted quote remains $3.42</small></span></button>
    </div>
    <div className="demo-control-bridge__evidence" role="status"><CheckCircle2 size={15} /><span><strong>{busy ? "Publishing governed demo state…" : error ?? snapshot.customerMessage}</strong><small>{snapshot.correlationId} · sequence {snapshot.sequence} · {snapshot.acceptedQuote.quoteId} {snapshot.acceptedQuote.status}</small></span><LockKeyhole size={15} /></div>
  </section>;
}
