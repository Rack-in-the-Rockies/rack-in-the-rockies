import { NextResponse } from "next/server";
import { subscribe } from "@/lib/subscribers";
import { subscribeLimiter } from "@/lib/rate-limit";

const OK = { ok: true };

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!subscribeLimiter.allow(ip)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.email !== "string") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Honeypot: bots fill every field. Fake success so they learn nothing.
  if (body.website) {
    return NextResponse.json(OK);
  }

  try {
    // source is hardcoded: this endpoint is the explicit signup path and the
    // only source allowed to resurrect unsubscribed/bounced records. Client
    // input must not be able to choose it.
    const result = await subscribe({
      email: body.email,
      firstName: typeof body.firstName === "string" ? body.firstName : undefined,
      lastName: typeof body.lastName === "string" ? body.lastName : undefined,
      source: "newsletter",
    });
    if (result.outcome === "invalid") {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }
    // created, updated, resubscribed, blocked all look identical from outside.
    return NextResponse.json(OK);
  } catch (error) {
    console.error("subscribe failed", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
