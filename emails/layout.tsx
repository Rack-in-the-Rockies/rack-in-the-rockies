import {
  Body,
  Container,
  Head,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import {
  BUSINESS_EMAIL,
  BUSINESS_MAILING_ADDRESS,
  BUSINESS_NAME,
} from "@/lib/business";
import { emailTheme as t } from "@/emails/theme";
import { WARM_EMAIL_STYLE, type EmailStyle } from "@/lib/email-style";

const footerBase = {
  fontSize: "12px",
  lineHeight: "18px",
  margin: "0 0 6px",
};

export function EmailShell({
  preheader,
  unsubscribeUrl,
  style = WARM_EMAIL_STYLE,
  children,
}: {
  preheader?: string;
  /**
   * Marketing sends pass the recipient's unsubscribe URL and get the full
   * CAN-SPAM footer. Transactional receipts omit it and get a minimal
   * business-name footer instead.
   */
  unsubscribeUrl?: string;
  /** Colors for the page, card, and header band. Defaults to the warm site palette. */
  style?: EmailStyle;
  children: React.ReactNode;
}) {
  const footerText = { ...footerBase, color: style.muted };
  return (
    <Html lang="en">
      <Head />
      {preheader ? <Preview>{preheader}</Preview> : null}
      <Body style={{ backgroundColor: style.background, fontFamily: t.fontBody, margin: 0 }}>
        <Container style={{ maxWidth: "560px", margin: "0 auto", padding: "24px 16px" }}>
          <Section
            style={{
              backgroundColor: style.card,
              borderRadius: "16px",
              border: `1px solid ${style.border}`,
              overflow: "hidden",
            }}
          >
            <Section
              style={{
                backgroundColor: style.headerFrom,
                background: `linear-gradient(90deg, ${style.headerFrom}, ${style.headerTo})`,
                padding: "18px 32px",
              }}
            >
              <Text
                style={{
                  color: "#FFFFFF",
                  fontFamily: t.fontDisplay,
                  fontSize: "20px",
                  fontWeight: 700,
                  margin: 0,
                }}
              >
                {BUSINESS_NAME}
              </Text>
            </Section>
            <Section style={{ padding: "28px 32px" }}>{children}</Section>
          </Section>
          <Section style={{ padding: "20px 12px 0", textAlign: "center" as const }}>
            {unsubscribeUrl ? (
              <>
                <Text style={footerText}>
                  You are receiving this because you signed up for event announcements
                  from {BUSINESS_NAME}.
                </Text>
                <Text style={footerText}>
                  <Link
                    href={unsubscribeUrl}
                    style={{ color: style.body, textDecoration: "underline" }}
                  >
                    Unsubscribe
                  </Link>
                </Text>
                <Text style={footerText}>
                  {BUSINESS_NAME} &middot;{" "}
                  {BUSINESS_MAILING_ADDRESS ?? "[Mailing address not set]"} &middot;{" "}
                  {BUSINESS_EMAIL}
                </Text>
              </>
            ) : (
              <Text style={footerText}>
                {BUSINESS_NAME} &middot; {BUSINESS_EMAIL}
              </Text>
            )}
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
