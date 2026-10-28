import { Dancing_Script } from "next/font/google";
import { EventHeroDefaultDecor } from "@/components/event-hero-default-decor";
import { EventHeroBloomDecor } from "@/components/event-hero-bloom-decor";
import { EventHeroWinterDecor } from "@/components/event-hero-winter-decor";
import { splitTitleAccent, type EventDecor } from "@/lib/event-rules";
import type { EventWithSessions } from "@/lib/events";

// Only the winter theme uses this, for the handwritten title accent.
const script = Dancing_Script({ subsets: ["latin"], weight: "600", display: "swap" });

type HeroTheme = {
  section: string;
  blushes: [string, string];
  badge: string;
  title: string;
  accent: string;
  subtle: string;
  divider: string;
  card: string;
  cardTitle: string;
  price: string;
  cta: string;
  fineprint: string;
};

const WARM: HeroTheme = {
  section: "bg-cream px-6 py-14 md:px-12 md:py-16",
  blushes: [
    "bg-[radial-gradient(ellipse,rgba(255,142,83,0.18)_0%,transparent_70%)]",
    "bg-[radial-gradient(ellipse,rgba(255,107,107,0.14)_0%,transparent_70%)]",
  ],
  badge: "bg-tangerine/10 text-tangerine",
  title: "text-text-dark",
  accent: "bg-gradient-to-r from-coral to-tangerine bg-clip-text italic text-transparent",
  subtle: "text-text-mid",
  divider: "text-coral/40",
  card: "border-coral/[0.12] bg-white",
  cardTitle: "text-text-dark",
  price: "bg-gradient-to-r from-coral to-tangerine bg-clip-text text-transparent",
  cta: "bg-gradient-to-r from-coral to-tangerine hover:shadow-coral/30",
  fineprint: "text-text-light",
};

const WINTER: HeroTheme = {
  // Extra vertical room for the rows of tiles framing the top and bottom.
  section: "bg-ice px-6 py-28 md:px-12 md:py-32",
  blushes: [
    "bg-[radial-gradient(ellipse,rgba(91,132,196,0.16)_0%,transparent_70%)]",
    "bg-[radial-gradient(ellipse,rgba(157,183,224,0.22)_0%,transparent_70%)]",
  ],
  badge: "bg-glacier/10 text-winter-blue",
  title: "text-midnight",
  accent: `${script.className} block pt-1 text-[1.15em] font-semibold text-glacier`,
  subtle: "text-slate-blue",
  divider: "text-glacier/40",
  card: "border-frost bg-white/90",
  cardTitle: "text-midnight",
  price: "text-winter-blue",
  cta: "bg-gradient-to-r from-winter-blue to-glacier hover:shadow-glacier/30",
  fineprint: "text-slate-blue/80",
};

const THEMES: Record<EventDecor, HeroTheme> = {
  mountains: WARM,
  blooms: WARM,
  winter: WINTER,
};

export function FeaturedEventHero({ event }: { event: EventWithSessions }) {
  const { title, partner, date_label, location, blurb, sessions, external_signup_url } = event;
  const { lead, accent } = splitTitleAccent(title);
  const theme = THEMES[event.decor] ?? WARM;

  return (
    <section className={`relative overflow-hidden ${theme.section}`}>
      {/* Background blushes */}
      <div className="absolute inset-0 z-0" aria-hidden="true">
        <div className={`absolute -top-[25%] -right-[10%] h-[150%] w-[65%] ${theme.blushes[0]}`} />
        <div className={`absolute -bottom-[15%] -left-[8%] h-full w-1/2 ${theme.blushes[1]}`} />
      </div>

      {event.image_url ? (
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={event.image_url}
            alt={event.image_alt ?? event.title}
            className="absolute -right-6 top-1/2 hidden w-72 -translate-y-1/2 rotate-3 rounded-2xl border-4 border-white object-cover shadow-xl lg:block xl:w-80"
          />
        </div>
      ) : event.decor === "winter" ? (
        <EventHeroWinterDecor />
      ) : event.decor === "blooms" ? (
        <EventHeroBloomDecor />
      ) : (
        <EventHeroDefaultDecor />
      )}

      <div className="relative z-10 mx-auto max-w-3xl text-center">
        <span
          className={`mb-4 inline-block rounded-full px-3.5 py-1 text-[11px] font-semibold uppercase tracking-[3px] ${theme.badge}`}
        >
          Upcoming Event
        </span>

        <h1 className={`font-display text-4xl font-bold leading-[1.1] md:text-[52px] ${theme.title}`}>
          {lead}
          {accent && <em className={theme.accent}>{accent}</em>}
        </h1>

        {partner && (
          <p className={`mt-3 text-sm font-semibold uppercase tracking-[2px] ${theme.subtle}`}>
            A Rack in the Rockies event at {partner}
          </p>
        )}

        <p className={`mx-auto mt-4 max-w-xl text-base leading-relaxed ${theme.subtle}`}>
          {blurb}
        </p>

        {/* Date + location */}
        <div
          className={`mt-7 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm font-semibold ${theme.title}`}
        >
          <span className="flex items-center gap-2">
            <span aria-hidden="true">{event.decor === "winter" ? "❄️" : "🀄"}</span>
            {date_label}
          </span>
          <span className={theme.divider} aria-hidden="true">
            |
          </span>
          <span>{location}</span>
        </div>

        {/* Sessions */}
        {sessions.length > 0 && (
          <div
            className={`mx-auto mt-7 grid grid-cols-1 gap-4 ${
              sessions.length > 1 ? "max-w-xl sm:grid-cols-2" : "max-w-xs"
            }`}
          >
            {sessions.map((session) => (
              <div
                key={session.id}
                className={`rounded-2xl border p-5 text-center shadow-sm ${theme.card}`}
              >
                <h2 className={`font-display text-lg ${theme.cardTitle}`}>{session.name}</h2>
                <p className={`mt-1.5 text-sm ${theme.subtle}`}>{session.time_label}</p>
                <p className={`mt-2 text-2xl font-bold ${theme.price}`}>{session.price_label}</p>
              </div>
            ))}
          </div>
        )}

        {/* CTA */}
        {external_signup_url && (
          <div className="mt-8">
            <a
              href={external_signup_url}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-block rounded-pill px-8 py-3.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:shadow-lg ${theme.cta}`}
            >
              Reserve Your Seat
            </a>
            <p className={`mt-3 text-xs ${theme.fineprint}`}>
              Seats are limited. Registration opens in a new tab.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
