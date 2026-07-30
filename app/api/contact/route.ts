import { NextResponse } from "next/server";

let _resend: import("resend").Resend | null = null;

function getResend() {
  if (!_resend) {
    const { Resend } = require("resend");
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend!;
}

export async function POST(req: Request) {
  const body = await req.json();
  const {
    firstName,
    lastName,
    email,
    eventType,
    dateOption,
    date,
    dateStart,
    dateEnd,
    skillLevel,
    message,
    subject,
    name,
  } = body;

  const displayName = firstName ? `${firstName} ${lastName}` : name;
  const emailSubject =
    subject || `New ${eventType || "event"} inquiry from ${displayName}`;

  let dateInfo = "";
  if (dateOption === "set-date" && date) {
    dateInfo = `Event Date: ${date}`;
  } else if (dateOption === "flexible" && dateStart && dateEnd) {
    dateInfo = `Flexible Dates: ${dateStart} to ${dateEnd}`;
  } else if (dateOption === "no-date") {
    dateInfo = "Date: No set date";
  } else if (date) {
    dateInfo = `Preferred Date: ${date}`;
  }

  const text = [
    `Name: ${displayName}`,
    `Email: ${email}`,
    eventType && `Event Type: ${eventType}`,
    dateInfo,
    skillLevel && `Skill Level: ${skillLevel}`,
    message && `Message: ${message}`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const resend = getResend();

    await resend.emails.send({
      from: "Rack in the Rockies <hello@rackintherockies.com>",
      to: process.env.CONTACT_EMAIL!,
      subject: emailSubject,
      text,
      replyTo: email,
    });

    // Side-effect subscribe. Source derived server-side; inquiry sources can
    // never resurrect an unsubscribed record (see lib/subscriber-rules.ts).
    // Must never block the inquiry email that already went to the owner.
    try {
      const { subscribe } = await import("@/lib/subscribers");
      const { deriveContactSource } = await import("@/lib/subscriber-rules");
      const tags = [eventType, skillLevel].filter(
        (t): t is string => typeof t === "string" && t.length > 0
      );
      await subscribe({
        email,
        firstName: firstName || name || undefined,
        lastName: lastName || undefined,
        source: deriveContactSource(body),
        tags,
      });
    } catch (subscribeError) {
      console.error("contact subscribe side effect failed", subscribeError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to send" }, { status: 500 });
  }
}
