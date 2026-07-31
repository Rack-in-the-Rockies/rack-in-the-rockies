import { NextResponse } from "next/server";
import { unsubscribeByToken } from "@/lib/subscribers";

/**
 * RFC 8058 one-click target for the List-Unsubscribe header. Mail clients
 * POST here when the user presses their native unsubscribe button. No
 * confirmation step, by design. Errors still return 200: the client is a
 * mail server, and a retry storm helps nobody.
 */
export async function POST(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  if (token) {
    try {
      await unsubscribeByToken(token);
    } catch (error) {
      console.error("one-click unsubscribe failed", error);
    }
  }
  return new NextResponse(null, { status: 200 });
}

/** A human opening the header URL lands on the normal unsubscribe page. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  return NextResponse.redirect(
    new URL(`/unsubscribe?token=${encodeURIComponent(token)}`, url.origin)
  );
}
