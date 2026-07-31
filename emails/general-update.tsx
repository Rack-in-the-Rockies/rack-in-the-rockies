import { Button, Section, Text } from "@react-email/components";
import { EmailShell } from "@/emails/layout";
import { emailTheme as t } from "@/emails/theme";
import { splitParagraphs, type GeneralUpdateFields } from "@/lib/send-rules";

export function GeneralUpdateEmail({
  fields,
  unsubscribeUrl,
}: {
  fields: GeneralUpdateFields;
  unsubscribeUrl: string;
}) {
  return (
    <EmailShell preheader={fields.preheader} unsubscribeUrl={unsubscribeUrl}>
      {fields.headline && (
        <Text
          style={{
            color: t.textDark,
            fontFamily: t.fontDisplay,
            fontSize: "26px",
            fontWeight: 700,
            lineHeight: "32px",
            margin: "0 0 18px",
          }}
        >
          {fields.headline}
        </Text>
      )}
      {splitParagraphs(fields.body).map((p, i) => (
        <Text
          key={i}
          style={{ color: t.textMid, fontSize: "15px", lineHeight: "23px", margin: "0 0 16px" }}
        >
          {p}
        </Text>
      ))}
      {fields.ctaLabel && fields.ctaUrl && (
        <Section style={{ textAlign: "center" as const }}>
          <Button
            href={fields.ctaUrl}
            style={{
              backgroundColor: t.coral,
              borderRadius: "28px",
              color: "#FFFFFF",
              fontSize: "15px",
              fontWeight: 600,
              padding: "12px 32px",
            }}
          >
            {fields.ctaLabel}
          </Button>
        </Section>
      )}
    </EmailShell>
  );
}
