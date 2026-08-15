"use client";

import { useState } from "react";

type Status = "idle" | "sending" | "sent" | "error";

export default function ContactForm({ market }: { market: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [form, setForm] = useState({ name: "", email: "", message: "" });

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);
  const canSend = form.name.trim() && emailValid && form.message.trim() && status !== "sending";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSend) return;
    setStatus("sending");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, market }),
      });
      if (!res.ok) throw new Error("bad status");
      setStatus("sent");
      setForm({ name: "", email: "", message: "" });
    } catch {
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <div className="rounded-2xl border border-brand-emerald/30 bg-brand-mint p-8 text-center">
        <p className="font-display text-lg font-bold text-brand-midnight">Thanks — message sent.</p>
        <p className="mt-2 text-sm text-brand-midnight/70">
          We'll get back to you at the email you gave. You can also reach us any time at{" "}
          <a className="font-semibold text-brand-pine underline" href="mailto:info@fuelcap.tech">
            info@fuelcap.tech
          </a>
          .
        </p>
      </div>
    );
  }

  const inputClass =
    "w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm text-brand-midnight outline-none transition focus:border-brand-emerald focus:ring-2 focus:ring-brand-emerald/20";

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-brand-midnight" htmlFor="name">
          Name
        </label>
        <input
          id="name"
          className={inputClass}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          autoComplete="name"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-brand-midnight" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          className={inputClass}
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          autoComplete="email"
          placeholder="you@email.com"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-brand-midnight" htmlFor="message">
          Message
        </label>
        <textarea
          id="message"
          rows={5}
          className={inputClass}
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
        />
      </div>
      {status === "error" && (
        <p className="text-sm text-brand-coral">
          Something went wrong. Please email us directly at info@fuelcap.tech.
        </p>
      )}
      <button
        type="submit"
        disabled={!canSend}
        className="font-display rounded-full bg-brand-emerald px-6 py-3.5 text-base font-bold text-white shadow-sm transition hover:bg-brand-pine disabled:cursor-not-allowed disabled:opacity-50"
      >
        {status === "sending" ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
