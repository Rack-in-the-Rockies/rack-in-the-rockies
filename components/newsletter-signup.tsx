"use client";

import { useState } from "react";

// TODO: replace with the real Kit (ConvertKit) embedded form action URL once the
// form exists. Grab it from the form's embed code in Kit; it looks like:
// https://app.kit.com/forms/1234567/subscriptions
const KIT_FORM_URL = "https://app.kit.com/forms/REPLACE_ME/subscriptions";

type NewsletterSignupProps = {
  /** Use on dark backgrounds (footer, dark sections). */
  light?: boolean;
};

export function NewsletterSignup({ light }: NewsletterSignupProps) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch(KIT_FORM_URL, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: form,
      });
      setStatus(res.ok ? "sent" : "error");
    } catch {
      setStatus("error");
    }
  }

  const inputStyles = light
    ? "w-full px-4 py-2.5 rounded-xl border border-white/20 bg-white/[0.08] text-white text-sm placeholder:text-white/40 outline-none focus:border-white/40"
    : "w-full px-4 py-2.5 rounded-xl border border-coral/10 bg-warm-white text-sm text-text-dark placeholder:text-text-light focus:outline-none focus:border-coral/30 focus:ring-1 focus:ring-coral/20";

  return (
    <div>
      <h3
        className={`font-display text-lg font-bold mb-1 ${
          light ? "text-white" : "text-text-dark"
        }`}
      >
        Sign up for RITR news
      </h3>
      <p className={`text-xs mb-3 ${light ? "text-white/60" : "text-text-mid"}`}>
        Events, new favorites, and the occasional tile obsession. No spam, just
        mahj.
      </p>

      {status === "sent" ? (
        <p
          className={`text-sm font-semibold ${
            light ? "text-golden" : "text-tangerine"
          }`}
        >
          You&apos;re in! Check your inbox to confirm.
        </p>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="flex flex-col sm:flex-row gap-2 max-w-md"
        >
          <input
            name="email_address"
            type="email"
            required
            placeholder="you@email.com"
            aria-label="Email address"
            className={inputStyles}
          />
          <button
            type="submit"
            disabled={status === "sending"}
            className="shrink-0 bg-gradient-to-r from-coral to-tangerine text-white px-6 py-2.5 rounded-pill text-sm font-semibold transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-coral/30 disabled:opacity-60"
          >
            {status === "sending" ? "Signing up..." : "Sign Me Up"}
          </button>
        </form>
      )}

      {status === "error" && (
        <p
          className={`text-xs mt-2 ${light ? "text-red-400" : "text-red-500"}`}
        >
          Something went wrong. Please try again.
        </p>
      )}
    </div>
  );
}
