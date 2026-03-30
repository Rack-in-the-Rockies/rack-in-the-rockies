"use client";

import { useState } from "react";

const inputStyles =
  "w-full px-4 py-2.5 rounded-xl border border-coral/10 text-sm text-text-dark placeholder:text-text-light focus:outline-none focus:border-coral/30 focus:ring-1 focus:ring-coral/20 bg-warm-white";

const selectStyles = `${inputStyles} appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%239ca3af%22%20d%3D%22M2%204l4%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-[length:12px] bg-[right_12px_center] bg-no-repeat pr-8`;

type DateOption = "no-date" | "flexible" | "set-date";

export function BookingForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );
  const [dateOption, setDateOption] = useState<DateOption | "">("");

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
        <p className="font-display text-2xl text-text-dark mb-2">Thanks!</p>
        <p className="text-sm text-text-mid">
          I&apos;ll be in touch soon to plan something great.
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
          name="firstName"
          required
          placeholder="First name"
          className={inputStyles}
        />
        <input
          name="lastName"
          required
          placeholder="Last name"
          className={inputStyles}
        />
      </div>
      <input
        name="email"
        type="email"
        required
        placeholder="Email"
        className={inputStyles}
      />
      <select
        name="eventType"
        required
        className={selectStyles}
        defaultValue=""
      >
        <option value="" disabled>
          Event type
        </option>
        <option value="Private Party">Private Party</option>
        <option value="Lesson">Lesson</option>
        <option value="Charity Event">Charity Event</option>
        <option value="Other">Other</option>
      </select>
      <select
        name="dateOption"
        required
        className={selectStyles}
        defaultValue=""
        onChange={(e) => setDateOption(e.target.value as DateOption)}
      >
        <option value="" disabled>
          Is there a set date for the event?
        </option>
        <option value="no-date">No set date</option>
        <option value="flexible">Flexible within these dates</option>
        <option value="set-date">Yes, there is a set date</option>
      </select>
      {dateOption === "flexible" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-text-mid mb-1 ml-1">
              Earliest date
            </label>
            <input
              name="dateStart"
              type="date"
              required
              className={inputStyles}
            />
          </div>
          <div>
            <label className="block text-xs text-text-mid mb-1 ml-1">
              Latest date
            </label>
            <input
              name="dateEnd"
              type="date"
              required
              className={inputStyles}
            />
          </div>
        </div>
      )}
      {dateOption === "set-date" && (
        <div>
          <label className="block text-xs text-text-mid mb-1 ml-1">
            Event date
          </label>
          <input
            name="date"
            type="date"
            required
            className={inputStyles}
          />
        </div>
      )}
      <select
        name="skillLevel"
        required
        className={selectStyles}
        defaultValue=""
      >
        <option value="" disabled>
          Skill level of players
        </option>
        <option value="Experienced">Experienced players</option>
        <option value="Intermediate">Players have played a few times</option>
        <option value="Inexperienced">Inexperienced players</option>
      </select>
      <textarea
        name="message"
        rows={4}
        placeholder="Tell me about your event..."
        className={`${inputStyles} w-full`}
      />
      <button
        type="submit"
        disabled={status === "sending"}
        className="w-full bg-gradient-to-r from-coral to-tangerine text-white py-3 rounded-pill font-semibold transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-coral/30 disabled:opacity-60"
      >
        {status === "sending" ? "Sending..." : "Send Inquiry"}
      </button>
      {status === "error" && (
        <p className="text-xs text-red-500 text-center">
          Something went wrong. Please try again.
        </p>
      )}
    </form>
  );
}
