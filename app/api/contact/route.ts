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
  const { name, email, eventType, date, message, subject } = body;

  const emailSubject =
    subject || `New ${eventType || "event"} inquiry from ${name}`;
  const text = [
    `Name: ${name}`,
    `Email: ${email}`,
    eventType && `Event Type: ${eventType}`,
    date && `Preferred Date: ${date}`,
    `Message: ${message}`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    await getResend().emails.send({
      from: "Rack in the Rockies <onboarding@resend.dev>",
      to: process.env.CONTACT_EMAIL!,
      subject: emailSubject,
      text,
      replyTo: email,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to send" }, { status: 500 });
  }
}
