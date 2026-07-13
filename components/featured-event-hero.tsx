import { featuredEvent, isFeaturedEventOver } from "@/data/featured-event";
import { EventHeroDecor } from "@/components/event-hero-decor";

export function FeaturedEventHero() {
  if (isFeaturedEventOver()) return null;

  const { partner, dateLabel, location, blurb, sessions, signupUrl } =
    featuredEvent;

  return (
    <section className="relative overflow-hidden bg-cream px-6 py-14 md:px-12 md:py-16">
      {/* Background blushes */}
      <div className="absolute inset-0 z-0" aria-hidden="true">
        <div className="absolute -top-[25%] -right-[10%] h-[150%] w-[65%] bg-[radial-gradient(ellipse,rgba(255,142,83,0.18)_0%,transparent_70%)]" />
        <div className="absolute -bottom-[15%] -left-[8%] h-full w-1/2 bg-[radial-gradient(ellipse,rgba(255,107,107,0.14)_0%,transparent_70%)]" />
      </div>

      <EventHeroDecor />

      <div className="relative z-10 mx-auto max-w-3xl text-center">
        <span className="mb-4 inline-block rounded-full bg-tangerine/10 px-3.5 py-1 text-[11px] font-semibold uppercase tracking-[3px] text-tangerine">
          Upcoming Event
        </span>

        <h1 className="font-display text-4xl font-bold leading-[1.1] text-text-dark md:text-[52px]">
          Mahjong in{" "}
          <em className="bg-gradient-to-r from-coral to-tangerine bg-clip-text italic text-transparent">
            Bloom
          </em>
        </h1>

        <p className="mt-3 text-sm font-semibold uppercase tracking-[2px] text-text-mid">
          A Rack in the Rockies event at {partner}
        </p>

        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-text-mid">
          {blurb}
        </p>

        {/* Date + location */}
        <div className="mt-7 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm font-semibold text-text-dark">
          <span className="flex items-center gap-2">
            <span aria-hidden="true">🀄</span>
            {dateLabel}
          </span>
          <span className="text-coral/40" aria-hidden="true">
            |
          </span>
          <span>{location}</span>
        </div>

        {/* Sessions */}
        <div className="mx-auto mt-7 grid max-w-xl grid-cols-1 gap-4 sm:grid-cols-2">
          {sessions.map((session) => (
            <div
              key={session.name}
              className="rounded-2xl border border-coral/[0.12] bg-white p-5 text-center shadow-sm"
            >
              <h2 className="font-display text-lg text-text-dark">
                {session.name}
              </h2>
              <p className="mt-1.5 text-sm text-text-mid">{session.time}</p>
              <p className="mt-2 bg-gradient-to-r from-coral to-tangerine bg-clip-text text-2xl font-bold text-transparent">
                {session.price}
              </p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-8">
          <a
            href={signupUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-pill bg-gradient-to-r from-coral to-tangerine px-8 py-3.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-coral/30"
          >
            Reserve Your Seat
          </a>
          <p className="mt-3 text-xs text-text-light">
            Seats are limited — registration opens in a new tab.
          </p>
        </div>
      </div>
    </section>
  );
}
