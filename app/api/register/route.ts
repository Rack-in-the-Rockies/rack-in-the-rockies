import { NextResponse } from "next/server";
import { getFeaturedEvent } from "@/lib/events";
import { register, sessionSeatCounts } from "@/lib/registrations";
import { parseRegistrationInput, seatsRemaining, slugTag } from "@/lib/registration-rules";
import { registerLimiter } from "@/lib/rate-limit";
import { renderRegistrationConfirmation } from "@/emails/registration-confirmation";
import { liveSender } from "@/lib/sends";
import { subscribe } from "@/lib/subscribers";
import { BUSINESS_EMAIL, BUSINESS_NAME, SITE_URL } from "@/lib/business";

/**
 * Registration only exists for the CURRENT featured event with in-house
 * signup (no external URL). Resolving through getFeaturedEvent is what
 * enforces published-and-not-ended; draft events are unreachable here.
 */
async function currentInHouseEvent(eventId: string) {
  const event = await getFeaturedEvent();
  if (!event || event.id !== eventId || event.external_signup_url) return null;
  return event;
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!registerLimiter.allow(ip)) {
    return NextResponse.json(
      { error: "Too many requests. Try again in a few minutes." },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  // Honeypot: bots fill every field. Fake success so they learn nothing.
  if ((body as { website?: unknown }).website) {
    return NextResponse.json({ ok: true });
  }

  const input = parseRegistrationInput(body);
  if (!input) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const event = await currentInHouseEvent(input.eventId);
  const session = event?.sessions.find((s) => s.id === input.sessionId);
  if (!event || !session) {
    return NextResponse.json(
      { error: "This event is not taking registrations right now." },
      { status: 400 }
    );
  }

  try {
    const result = await register(input, { capacity: session.capacity });
    if (result.outcome === "invalid") {
      return NextResponse.json({ errors: result.errors }, { status: 400 });
    }
    if (result.outcome === "sold_out") {
      return NextResponse.json(
        {
          error:
            result.remaining > 0
              ? `${session.name} only has ${result.remaining} ${result.remaining === 1 ? "seat" : "seats"} left.`
              : `${session.name} is sold out.`,
        },
        { status: 409 }
      );
    }

    // Emails and the subscribe side effect must never fail an inserted
    // registration; they are logged and the user still sees success.
    const registration = result.registration;
    try {
      const rendered = await renderRegistrationConfirmation({
        event: {
          title: event.title,
          dateLabel: event.date_label,
          location: event.location,
          paymentInstructions: event.payment_instructions,
        },
        session: {
          name: session.name,
          timeLabel: session.time_label,
          priceLabel: session.price_label,
        },
        firstName: registration.first_name,
        seats: registration.seats,
        cancelUrl: `${SITE_URL}/cancel-registration?token=${encodeURIComponent(registration.cancel_token)}`,
      });
      const sender = liveSender();
      await sender.sendOne({
        from: `${BUSINESS_NAME} <${BUSINESS_EMAIL}>`,
        to: registration.email,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        replyTo: BUSINESS_EMAIL,
        headers: {},
      });
      if (process.env.CONTACT_EMAIL) {
        await sender.sendOne({
          from: `${BUSINESS_NAME} <${BUSINESS_EMAIL}>`,
          to: process.env.CONTACT_EMAIL,
          subject: `New registration: ${event.title}`,
          html: `<p>${registration.first_name} ${registration.last_name ?? ""} registered ${registration.seats} ${registration.seats === 1 ? "seat" : "seats"} for ${session.name}.</p><p>${registration.email}</p>`,
          text: `${registration.first_name} ${registration.last_name ?? ""} registered ${registration.seats} seat(s) for ${session.name}. ${registration.email}`,
          replyTo: registration.email,
          headers: {},
        });
      }
    } catch (emailError) {
      console.error("registration emails failed", emailError);
    }
    try {
      await subscribe({
        email: registration.email,
        firstName: registration.first_name,
        lastName: registration.last_name ?? undefined,
        source: "event-registration",
        tags: [slugTag(event.title)],
      });
    } catch (subscribeError) {
      console.error("registration subscribe side effect failed", subscribeError);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("registration failed", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}

/** Fresh remaining-seat counts for the form (the page itself caches hourly). */
export async function GET(req: Request) {
  const eventId = new URL(req.url).searchParams.get("eventId") ?? "";
  const event = await currentInHouseEvent(eventId);
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const counts = await sessionSeatCounts(event.id);
  return NextResponse.json({
    sessions: event.sessions.map((s) => ({
      id: s.id,
      remaining: seatsRemaining(s.capacity, counts.get(s.id) ?? 0),
    })),
  });
}
