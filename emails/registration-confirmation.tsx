import { render } from "@react-email/render";
import { Section, Text } from "@react-email/components";
import { EmailShell } from "@/emails/layout";
import { emailTheme as t } from "@/emails/theme";

export type ConfirmationArgs = {
  event: {
    title: string;
    dateLabel: string;
    location: string;
    paymentInstructions: string | null;
  };
  session: { name: string; timeLabel: string; priceLabel: string };
  firstName: string;
  seats: number;
  cancelUrl: string;
};

const body = { color: t.textMid, fontSize: "15px", lineHeight: "23px", margin: "0 0 16px" };

function ConfirmationEmail({ event, session, firstName, seats, cancelUrl }: ConfirmationArgs) {
  return (
    <EmailShell preheader={`You're in: ${event.title}, ${event.dateLabel}`}>
      <Text
        style={{
          color: t.textDark,
          fontFamily: t.fontDisplay,
          fontSize: "26px",
          fontWeight: 700,
          lineHeight: "32px",
          margin: "0 0 12px",
        }}
      >
        You&apos;re registered!
      </Text>
      <Text style={body}>
        {firstName}, your {seats === 1 ? "seat is" : `${seats} seats are`} saved for {event.title}.
      </Text>
      <Section
        style={{
          backgroundColor: t.cream,
          borderRadius: "12px",
          padding: "14px 18px",
          margin: "0 0 18px",
        }}
      >
        <Text style={{ color: t.textDark, fontSize: "14px", fontWeight: 600, margin: "0 0 2px" }}>
          {session.name} &middot; {session.priceLabel}
        </Text>
        <Text style={{ color: t.textLight, fontSize: "13px", margin: "0 0 2px" }}>
          {event.dateLabel} &middot; {session.timeLabel}
        </Text>
        <Text style={{ color: t.textLight, fontSize: "13px", margin: 0 }}>{event.location}</Text>
      </Section>
      {event.paymentInstructions && (
        <Text style={body}>
          <strong>How to pay:</strong> {event.paymentInstructions}
        </Text>
      )}
      <Text style={{ color: t.textLight, fontSize: "12px", lineHeight: "18px", margin: 0 }}>
        Plans changed? You can{" "}
        <a href={cancelUrl} style={{ color: t.textMid, textDecoration: "underline" }}>
          cancel your registration
        </a>{" "}
        and free the {seats === 1 ? "seat" : "seats"} for someone else.
      </Text>
    </EmailShell>
  );
}

export async function renderRegistrationConfirmation(args: ConfirmationArgs) {
  const element = <ConfirmationEmail {...args} />;
  return {
    subject: `You're registered: ${args.event.title}`,
    html: await render(element),
    text: await render(element, { plainText: true }),
  };
}
