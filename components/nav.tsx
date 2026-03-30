"use client";

import { useState } from "react";
import Link from "next/link";

const links = [
  { href: "/shop", label: "Shop" },
  { href: "/events", label: "Events" },
  { href: "/learn", label: "Learn" },
  {
    href: "/about",
    label: "About",
    children: [
      { href: "/about", label: "About" },
      { href: "/contact", label: "Contact Us" },
    ],
  },
  { href: "/trips", label: "Trips" },
];

type NavLink = (typeof links)[number];

function NavItem({ l }: { l: NavLink }) {
  if (!l.children) {
    return (
      <Link
        href={l.href}
        className="text-text-mid text-[13px] font-medium tracking-wide uppercase hover:text-coral transition-colors"
      >
        {l.label}
      </Link>
    );
  }

  return (
    <div className="relative group">
      <Link
        href={l.href}
        className="text-text-mid text-[13px] font-medium tracking-wide uppercase hover:text-coral transition-colors"
      >
        {l.label}
        <span className="ml-0.5 text-[10px]">&#9662;</span>
      </Link>
      <div className="absolute top-full left-1/2 -translate-x-1/2 pt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
        <ul className="bg-white rounded-xl border border-coral/10 shadow-lg py-1.5 min-w-[140px]">
          {l.children.map((child) => (
            <li key={child.href}>
              <Link
                href={child.href}
                className="block px-4 py-2 text-[13px] text-text-mid hover:text-coral hover:bg-coral/[0.04] transition-colors"
              >
                {child.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 flex items-center justify-between px-6 md:px-12 py-3.5 bg-warm-white/95 backdrop-blur-lg border-b border-coral/10">
      <Link href="/" className="font-display text-xl font-bold text-coral">
        rack in the <span className="text-tangerine">rockies</span>
      </Link>

      {/* Desktop */}
      <ul className="hidden md:flex gap-7 items-center">
        {links.map((l) => (
          <li key={l.href}>
            <NavItem l={l} />
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
            {links.map((l) =>
              l.children ? (
                l.children.map((child) => (
                  <li key={child.href}>
                    <Link
                      href={child.href}
                      className="block text-text-mid text-sm font-medium py-2"
                      onClick={() => setOpen(false)}
                    >
                      {child.label}
                    </Link>
                  </li>
                ))
              ) : (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="block text-text-mid text-sm font-medium py-2"
                    onClick={() => setOpen(false)}
                  >
                    {l.label}
                  </Link>
                </li>
              )
            )}
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
