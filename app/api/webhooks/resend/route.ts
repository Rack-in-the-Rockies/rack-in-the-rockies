import { NextResponse } from "next/server";
import { Resend } from "resend";
import { mapWebhookEvent } from "@/lib/send-rules";
import { markBounced, markComplained } from "@/lib/subscribers";
import { markRecipientOutcome } from "@/lib/sends";

/**
 * Resend delivery webhook. The svix signature is the only authentication on
 * this public endpoint; verification runs against the RAW body (re-serialized
 * JSON breaks the signature). Unknown events return 200 so enabling extra
 * events in the dashboard cannot break anything.
 */
export async function POST(req: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    console.error("RESEND_WEBHOOK_SECRET is not configured");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  const payload = await req.text();
  let event;
  try {
    event = new Resend(process.env.RESEND_API_KEY).webhooks.verify({
      payload,
      headers: {
        id: req.headers.get("svix-id") ?? "",
        timestamp: req.headers.get("svix-timestamp") ?? "",
        signature: req.headers.get("svix-signature") ?? "",
      },
      webhookSecret: secret,
    });
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  try {
    const data = event.data as { email_id?: string; to?: string[]; bounce?: { type?: string } };
    const outcome = mapWebhookEvent(event.type, data.bounce?.type);

    if (outcome.recipientStatus && data.email_id) {
      await markRecipientOutcome(data.email_id, outcome.recipientStatus);
    }
    const email = data.to?.[0];
    if (outcome.subscriberAction && email) {
      if (outcome.subscriberAction === "bounce") await markBounced(email);
      else await markComplained(email);
    }
  } catch (error) {
    // Let svix retry: a transient db failure should not ack the event.
    console.error("webhook processing failed", event.type, error);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
