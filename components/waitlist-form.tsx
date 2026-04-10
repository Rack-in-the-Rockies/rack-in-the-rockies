"use client";

import { useState } from "react";

export function WaitlistForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.get("firstName"),
          lastName: form.get("lastName"),
          email: form.get("email"),
          subject: "Trips Waitlist Signup",
          message: `New trips waitlist signup`,
          source: "trips-waitlist",
        }),
      });
      setStatus(res.ok ? "sent" : "error");
    } catch {
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <div className="bg-white/10 border border-white/20 rounded-2xl p-6 max-w-md mx-auto">
        <p className="font-display text-xl text-white mb-1">
          You&apos;re on the list!
        </p>
        <p className="text-sm text-white/60">
          We&apos;ll reach out as soon as trips are ready to book.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <input
          name="firstName"
          required
          placeholder="First name"
          className="px-4 py-2.5 rounded-xl border border-white/20 bg-white/[0.08] text-white text-sm placeholder:text-white/40 outline-none focus:border-white/40"
        />
        <input
          name="lastName"
          required
          placeholder="Last name"
          className="px-4 py-2.5 rounded-xl border border-white/20 bg-white/[0.08] text-white text-sm placeholder:text-white/40 outline-none focus:border-white/40"
        />
      </div>
      <input
        name="email"
        type="email"
        required
        placeholder="Email"
        className="w-full px-4 py-2.5 rounded-xl border border-white/20 bg-white/[0.08] text-white text-sm placeholder:text-white/40 outline-none focus:border-white/40"
      />
      <button
        type="submit"
        disabled={status === "sending"}
        className="w-full bg-gradient-to-r from-coral to-tangerine text-white py-3 rounded-pill text-sm font-semibold transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-coral/30 disabled:opacity-60"
      >
        {status === "sending" ? "Joining..." : "Join the Waitlist"}
      </button>
      {status === "error" && (
        <p className="text-xs text-red-400 text-center">
          Something went wrong. Please try again.
        </p>
      )}
    </form>
  );
}
