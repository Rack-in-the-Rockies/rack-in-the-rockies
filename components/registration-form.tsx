"use client";

import { useEffect, useState, useTransition } from "react";
import { ConsentNotice } from "@/components/consent-notice";
import type { EventWithSessions } from "@/lib/events";

const inputCls =
  "w-full px-4 py-2.5 rounded-xl border border-coral/10 bg-warm-white text-sm text-text-dark placeholder:text-text-light focus:outline-none focus:border-coral/30";

type Remaining = Record<string, number | null>;

export function RegistrationForm({ event }: { event: EventWithSessions }) {
  const [remaining, setRemaining] = useState<Remaining>({});
  const [sessionId, setSessionId] = useState(event.sessions[0]?.id ?? "");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [seats, setSeats] = useState(1);
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<"idle" | "sent">("idle");
  const [errors, setErrors] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    fetch(`/api/register?eventId=${event.id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { sessions: { id: string; remaining: number | null }[] } | null) => {
        if (!data) return;
        const map: Remaining = {};
        for (const s of data.sessions) map[s.id] = s.remaining;
        setRemaining(map);
      })
      .catch(() => {});
  }, [event.id]);

  function soldOut(id: string) {
    return remaining[id] === 0;
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors([]);
    startTransition(async () => {
      try {
        const res = await fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventId: event.id,
            sessionId,
            firstName,
            lastName,
            email,
            seats,
            website,
          }),
        });
        const body = await res.json().catch(() => ({}));
        if (res.ok) setStatus("sent");
        else setErrors(body.errors ?? [body.error ?? "Something went wrong. Please try again."]);
      } catch {
        setErrors(["Something went wrong. Please try again."]);
      }
    });
  }

  if (status === "sent") {
    return (
      <div className="mx-auto max-w-md text-center">
        <h3 className="font-display text-xl font-bold text-text-dark mb-2">You&apos;re in!</h3>
        <p className="text-sm text-text-mid">
          Check your email for your confirmation and the event details.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-md space-y-3 text-left">
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        className="absolute -left-[9999px] h-0 w-0 opacity-0"
      />
      <div className="space-y-2">
        {event.sessions.map((s) => {
          const left = remaining[s.id];
          const full = soldOut(s.id);
          return (
            <label
              key={s.id}
              className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
                full
                  ? "border-coral/5 bg-cream/50 text-text-light"
                  : sessionId === s.id
                    ? "border-coral/40 bg-white"
                    : "border-coral/10 bg-white"
              }`}
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="session"
                  checked={sessionId === s.id}
                  disabled={full}
                  onChange={() => setSessionId(s.id)}
                />
                <span>
                  <span className="font-semibold text-text-dark">{s.name}</span>{" "}
                  <span className="text-text-mid">
                    {s.time_label} &middot; {s.price_label}
                  </span>
                </span>
              </span>
              <span className="text-xs">
                {full
                  ? "Sold out"
                  : typeof left === "number"
                    ? `${left} ${left === 1 ? "seat" : "seats"} left`
                    : ""}
              </span>
            </label>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <input
          className={inputCls}
          placeholder="First name"
          required
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
        />
        <input
          className={inputCls}
          placeholder="Last name (optional)"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
        />
      </div>
      <input
        className={inputCls}
        type="email"
        placeholder="Email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <div className="flex items-center gap-3">
        <label className="text-sm text-text-mid">Seats</label>
        <select className={inputCls} value={seats} onChange={(e) => setSeats(Number(e.target.value))}>
          {[1, 2, 3, 4].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
      {errors.length > 0 && (
        <div className="text-sm text-red-500">
          {errors.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      )}
      <ConsentNotice />
      <button
        type="submit"
        disabled={isPending || soldOut(sessionId)}
        className="w-full rounded-pill bg-gradient-to-r from-coral to-tangerine py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-coral/30 disabled:opacity-50"
      >
        {isPending ? "Saving your seat..." : "Reserve Your Seat"}
      </button>
    </form>
  );
}
