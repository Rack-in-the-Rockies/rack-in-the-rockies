"use server";

import { requireAdmin } from "@/lib/auth";
import { BUSINESS_MAILING_ADDRESS, SITE_URL } from "@/lib/business";
import { parseAnnouncement, validateAnnouncement } from "@/lib/send-rules";
import { countAudience, listAudience } from "@/lib/subscribers";
import {
  createSend,
  runSend,
  liveSendDb,
  liveSendDeps,
  liveBuildEmail,
  liveSender,
  getSendDetail,
} from "@/lib/sends";
import { renderAnnouncement } from "@/emails/render";

export type SendOutcome =
  | { sendId: string; status: string; sent: number; failed: number }
  | { errors: string[] }
  | { error: string };

/** Live preview. Renders whatever is typed so far; no validation gate. */
export async function previewAction(
  input: unknown
): Promise<{ html: string } | { error: string }> {
  await requireAdmin();
  const a = parseAnnouncement(input);
  if (!a) return { error: "Could not read the form. Refresh and try again." };
  const rendered = await renderAnnouncement(a, {
    unsubscribeToken: "preview",
    baseUrl: SITE_URL,
  });
  return { html: rendered.html };
}

export async function countAction(tags: string[]): Promise<{ count: number }> {
  await requireAdmin();
  return {
    count: await countAudience(
      Array.isArray(tags) ? tags.filter((t) => typeof t === "string") : []
    ),
  };
}

/** Test send to the logged-in admin. Allowed while the address is unset. */
export async function testSendAction(
  input: unknown
): Promise<{ sent: string } | { errors: string[] } | { error: string }> {
  const { email } = await requireAdmin();
  const a = parseAnnouncement(input);
  if (!a) return { error: "Could not read the form. Refresh and try again." };
  const errors = validateAnnouncement(a);
  if (errors.length) return { errors };
  if (!email) return { error: "Your login has no email address; cannot test send." };

  const outgoing = await liveBuildEmail(a, { email, unsubscribe_token: "test" });
  const result = await liveSender().sendOne({
    ...outgoing,
    subject: `[Test] ${outgoing.subject}`,
  });
  if (!result.ok) {
    console.error("test send failed", result.message);
    return { error: "The test email could not be sent. Try again in a minute." };
  }
  return { sent: email };
}

export async function sendAction(input: unknown, tags: string[]): Promise<SendOutcome> {
  const { userId } = await requireAdmin();

  if (!BUSINESS_MAILING_ADDRESS) {
    return {
      error:
        "Sending is blocked until the business mailing address is set. Tyler: fill in BUSINESS_MAILING_ADDRESS in lib/business.ts (plan step P1).",
    };
  }

  const a = parseAnnouncement(input);
  if (!a) return { error: "Could not read the form. Refresh and try again." };
  const errors = validateAnnouncement(a);
  if (errors.length) return { errors };

  const cleanTags = Array.isArray(tags) ? tags.filter((t) => typeof t === "string") : [];
  const members = await listAudience(cleanTags);
  if (members.length === 0) {
    return { error: "Nobody matches this audience. Nothing was sent." };
  }

  const db = liveSendDb();
  const sendId = await createSend(a, { tags: cleanTags }, userId, members, db);
  await runSend(sendId, a, liveSendDeps());

  const detail = await getSendDetail(sendId);
  return {
    sendId,
    status: detail?.send.status ?? "sent",
    sent: detail?.send.sent_count ?? members.length,
    failed: detail?.send.failed_count ?? 0,
  };
}

export async function resumeAction(
  sendId: string
): Promise<{ status: string } | { error: string }> {
  await requireAdmin();
  const detail = await getSendDetail(sendId);
  if (!detail || !detail.announcement) return { error: "Send not found." };
  if (!detail.resumable) return { error: "Nothing left to resume." };
  await runSend(sendId, detail.announcement, liveSendDeps());
  const after = await getSendDetail(sendId);
  return { status: after?.send.status ?? "sent" };
}
