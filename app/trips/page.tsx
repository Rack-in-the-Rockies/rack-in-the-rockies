"use client";

import { useState } from "react";
import { SectionHeader } from "@/components/section-header";

export default function TripsPage() {
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

  return (
    <main>
      {/* Hero */}
      <section className="relative min-h-[50vh] flex items-center justify-center bg-[#2D2424] overflow-hidden py-16 px-6">
        <div className="absolute inset-0">
          <div className="absolute -top-[30%] -right-[15%] w-[60%] h-[160%] bg-[radial-gradient(ellipse,rgba(255,107,107,0.15)_0%,transparent_70%)]" />
          <div className="absolute -bottom-[20%] -left-[10%] w-[50%] h-[120%] bg-[radial-gradient(ellipse,rgba(255,142,83,0.1)_0%,transparent_70%)]" />
        </div>
        <div className="relative z-10 max-w-2xl text-center">
          <SectionHeader tag="Coming Soon" title="Mahjong girls trips" light />
          <p className="text-base text-white/70 leading-relaxed max-w-lg mx-auto -mt-2 mb-8">
            Wine country weekends, mountain retreats, and beachside tournaments.
            Mahjong + travel + your best friends. We&apos;re planning our first
            trips now &mdash; join the waitlist to be the first to know.
          </p>

          {status === "sent" ? (
            <div className="bg-white/10 border border-white/20 rounded-2xl p-6 max-w-md mx-auto">
              <p className="font-display text-xl text-white mb-1">
                You&apos;re on the list!
              </p>
              <p className="text-sm text-white/60">
                We&apos;ll reach out as soon as trips are ready to book.
              </p>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="max-w-md mx-auto space-y-3"
            >
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
          )}
        </div>
      </section>

      {/* What to Expect */}
      <section className="py-12 px-6 md:px-12 bg-warm-white text-center">
        <SectionHeader tag="What to Expect" title="More than a game night" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto mt-6">
          {[
            {
              icon: "🍷",
              title: "Wine Country Weekends",
              desc: "Napa, Sonoma, or Colorado wine country. Play between tastings, dine together, and unwind.",
            },
            {
              icon: "🏔️",
              title: "Mountain Retreats",
              desc: "Cozy cabins, mountain views, and marathon mahjong sessions with your favorite people.",
            },
            {
              icon: "🏖️",
              title: "Beachside Tournaments",
              desc: "Sun, sand, and tiles. Casual tournaments with a tropical twist.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="bg-white rounded-2xl p-7 text-center border border-coral/[0.08] shadow-sm"
            >
              <div className="w-[52px] h-[52px] rounded-xl bg-gradient-to-br from-blush to-[#FFD4C8] flex items-center justify-center text-2xl mx-auto mb-3.5">
                {item.icon}
              </div>
              <h3 className="font-display text-lg mb-2">{item.title}</h3>
              <p className="text-sm text-text-mid leading-relaxed">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
