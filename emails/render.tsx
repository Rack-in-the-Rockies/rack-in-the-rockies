import { render } from "@react-email/render";
import { EventAnnouncementEmail } from "@/emails/event-announcement";
import { GeneralUpdateEmail } from "@/emails/general-update";
import type { Announcement } from "@/lib/send-rules";

export type RenderedEmail = { subject: string; html: string; text: string };

/**
 * The one place announcement HTML is produced: composer preview, test sends,
 * and the real pipeline all call this, so what Annie previews is what sends.
 */
export async function renderAnnouncement(
  a: Announcement,
  opts: { unsubscribeToken: string; baseUrl: string }
): Promise<RenderedEmail> {
  const unsubscribeUrl = `${opts.baseUrl}/unsubscribe?token=${encodeURIComponent(opts.unsubscribeToken)}`;
  const element =
    a.template === "event-announcement" ? (
      <EventAnnouncementEmail fields={a.fields} unsubscribeUrl={unsubscribeUrl} />
    ) : (
      <GeneralUpdateEmail fields={a.fields} unsubscribeUrl={unsubscribeUrl} />
    );
  const html = await render(element);
  const text = await render(element, { plainText: true });
  return { subject: a.fields.subject, html, text };
}
