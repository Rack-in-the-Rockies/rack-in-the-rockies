"use client";

import { useState } from "react";

const inputStyles =
  "w-full px-4 py-2.5 rounded-xl border border-coral/10 text-sm text-text-dark placeholder:text-text-light focus:outline-none focus:border-coral/30 focus:ring-1 focus:ring-coral/20 bg-warm-white";

export function ContactForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    const form = new FormData(e.currentTarget);
    const data = Object.fromEntries(form.entries());
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      setStatus(res.ok ? "sent" : "error");
    } catch {
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <div className="bg-white rounded-2xl p-8 text-center border border-coral/10">
        <p className="font-display text-2xl text-text-dark mb-2">
          Message sent!
        </p>
        <p className="text-sm text-text-mid">
          Thanks for reaching out. I'll get back to you soon.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-2xl p-6 md:p-8 border border-coral/10 space-y-4"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <input
          name="name"
          required
          placeholder="Your name"
          className={inputStyles}
        />
        <input
          name="email"
          type="email"
          required
          placeholder="Email"
          className={inputStyles}
        />
      </div>
      <input
        name="subject"
        required
        placeholder="Subject"
        className={`${inputStyles} w-full`}
      />
      <textarea
        name="message"
        rows={4}
        required
        placeholder="Your message..."
        className={`${inputStyles} w-full`}
      />
      <button
        type="submit"
        disabled={status === "sending"}
        className="w-full bg-gradient-to-r from-coral to-tangerine text-white py-3 rounded-pill font-semibold transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-coral/30 disabled:opacity-60"
      >
        {status === "sending" ? "Sending..." : "Send Message"}
      </button>
      {status === "error" && (
        <p className="text-xs text-red-500 text-center">
          Something went wrong. Please try again.
        </p>
      )}
    </form>
  );
}
