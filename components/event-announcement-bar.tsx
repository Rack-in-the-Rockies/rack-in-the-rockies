import Link from "next/link";
import type { EventWithSessions } from "@/lib/events";
import { themeVars } from "@/lib/event-theme";

export function EventAnnouncementBar({ event }: { event: EventWithSessions }) {
  return (
    <Link
      href="/events"
      className={`group block px-6 py-3 text-center text-white transition-opacity hover:opacity-95 ${
        event.theme
          ? "bg-(--ev-accent)"
          : event.decor === "winter"
            ? "bg-gradient-to-r from-winter-blue to-glacier"
            : "bg-gradient-to-r from-coral to-tangerine"
      }`}
      style={event.theme ? themeVars(event.theme) : undefined}
    >
      <span className="text-sm font-semibold">
        <span className="mr-2" aria-hidden="true">
          {event.theme ? event.theme.dateIcon : event.decor === "winter" ? "❄️" : "🀄"}
        </span>
        {event.banner_text}
        <span className="ml-2 inline-block underline underline-offset-4 transition-transform group-hover:translate-x-0.5">
          Reserve your seat →
        </span>
      </span>
    </Link>
  );
}
