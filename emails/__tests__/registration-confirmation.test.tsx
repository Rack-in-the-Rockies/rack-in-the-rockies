import { describe, it, expect } from "vitest";
import { renderRegistrationConfirmation } from "@/emails/registration-confirmation";

const args = {
  event: {
    title: "Fall Fest",
    dateLabel: "October 1, 2026",
    location: "Denver",
    paymentInstructions: "Venmo @rack or cash at the door.",
  },
  session: { name: "Intro", timeLabel: "6:00 - 8:00 PM", priceLabel: "$30" },
  firstName: "Annie",
  seats: 2,
  cancelUrl: "https://rackintherockies.com/cancel-registration?token=tok-1",
};

describe("renderRegistrationConfirmation", () => {
  it("contains the receipt details, payment instructions, and cancel link", async () => {
    const { subject, html, text } = await renderRegistrationConfirmation(args);
    expect(subject).toBe("You're registered: Fall Fest");
    for (const needle of [
      "Fall Fest",
      "October 1, 2026",
      "Denver",
      "Intro",
      "6:00 - 8:00 PM",
      "$30",
      "2 seats",
      "Venmo @rack",
      args.cancelUrl,
    ]) {
      expect(html).toContain(needle);
    }
    expect(text).toContain(args.cancelUrl);
  });

  it("is transactional: no unsubscribe, no address placeholder, no dashes", async () => {
    const { html, text } = await renderRegistrationConfirmation({
      ...args,
      event: { ...args.event, paymentInstructions: null },
    });
    expect(html).not.toContain("Unsubscribe");
    expect(html).not.toContain("[Mailing address not set]");
    expect(text).not.toMatch(/[–—]/);
  });
});
