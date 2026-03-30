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
    source,
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

    // Save contact to Resend audience for future newsletters
    if (process.env.RESEND_AUDIENCE_ID) {
      const contactSource = source || (eventType ? "event-inquiry" : "contact");
      await resend.contacts.create({
        audienceId: process.env.RESEND_AUDIENCE_ID,
        email,
        firstName: firstName || name || "",
        lastName: lastName || "",
        properties: {
          source: contactSource,
          ...(eventType && { eventType }),
          ...(skillLevel && { skillLevel }),
        },
      }).catch(() => {}); // Don't fail the form if contact save fails
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to send" }, { status: 500 });
  }
}
