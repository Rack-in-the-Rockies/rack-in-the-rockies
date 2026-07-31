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

const footerText = {
  color: t.textLight,
  fontSize: "12px",
  lineHeight: "18px",
  margin: "0 0 6px",
};

export function EmailShell({
  preheader,
  unsubscribeUrl,
  children,
}: {
  preheader?: string;
  unsubscribeUrl: string;
  children: React.ReactNode;
}) {
  return (
    <Html lang="en">
      <Head />
      {preheader ? <Preview>{preheader}</Preview> : null}
      <Body style={{ backgroundColor: t.cream, fontFamily: t.fontBody, margin: 0 }}>
        <Container style={{ maxWidth: "560px", margin: "0 auto", padding: "24px 16px" }}>
          <Section
            style={{
              backgroundColor: t.warmWhite,
              borderRadius: "16px",
              border: `1px solid ${t.blush}`,
              overflow: "hidden",
            }}
          >
            <Section
              style={{
                backgroundColor: t.coral,
                background: `linear-gradient(90deg, ${t.coral}, ${t.tangerine})`,
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
            <Text style={footerText}>
              You are receiving this because you signed up for event announcements
              from {BUSINESS_NAME}.
            </Text>
            <Text style={footerText}>
              <Link href={unsubscribeUrl} style={{ color: t.textMid, textDecoration: "underline" }}>
                Unsubscribe
              </Link>
            </Text>
            <Text style={footerText}>
              {BUSINESS_NAME} &middot; {BUSINESS_MAILING_ADDRESS ?? "[Mailing address not set]"}{" "}
              &middot; {BUSINESS_EMAIL}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
