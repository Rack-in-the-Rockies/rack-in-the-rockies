"use client";

import { useState } from "react";
import Link from "next/link";

const links = [
  { href: "/shop", label: "Shop" },
  { href: "/events", label: "Events" },
  { href: "/learn", label: "Learn" },
  { href: "/about", label: "About" },
  { href: "/#trips", label: "Trips" },
];

export function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 flex items-center justify-between px-6 md:px-12 py-3.5 bg-warm-white/95 backdrop-blur-lg border-b border-coral/10">
      <Link href="/" className="font-display text-xl font-bold text-coral">
        rack in the <span className="text-tangerine">rockies</span>
      </Link>

      {/* Desktop */}
      <ul className="hidden md:flex gap-7">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="text-text-mid text-[13px] font-medium tracking-wide uppercase hover:text-coral transition-colors"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>

      <Link
        href="/events#book"
        className="hidden md:inline-block bg-gradient-to-r from-coral to-tangerine text-white px-5 py-2 rounded-pill text-[13px] font-semibold hover:-translate-y-0.5 hover:shadow-md hover:shadow-coral/30 transition-all"
      >
        Book an Event
      </Link>

      {/* Mobile hamburger */}
      <button
        className="md:hidden text-text-dark text-2xl"
        onClick={() => setOpen(!open)}
        aria-label="Toggle menu"
      >
        {open ? "✕" : "☰"}
      </button>

      {/* Mobile menu */}
      {open && (
        <div className="absolute top-full left-0 right-0 bg-warm-white border-b border-coral/10 shadow-lg md:hidden">
          <ul className="flex flex-col p-4 gap-3">
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="block text-text-mid text-sm font-medium py-2"
                  onClick={() => setOpen(false)}
                >
                  {l.label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/events#book"
                className="block bg-gradient-to-r from-coral to-tangerine text-white text-center px-5 py-2.5 rounded-pill text-sm font-semibold"
                onClick={() => setOpen(false)}
              >
                Book an Event
              </Link>
            </li>
          </ul>
        </div>
      )}
    </nav>
  );
}
