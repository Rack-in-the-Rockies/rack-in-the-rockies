import { Button, Column, Row, Section, Text } from "@react-email/components";
import { EmailShell } from "@/emails/layout";
import { emailTheme as t } from "@/emails/theme";
import type { EventAnnouncementFields } from "@/lib/send-rules";

const body = { color: t.textMid, fontSize: "15px", lineHeight: "23px", margin: "0 0 16px" };

export function EventAnnouncementEmail({
  fields,
  unsubscribeUrl,
}: {
  fields: EventAnnouncementFields;
  unsubscribeUrl: string;
}) {
  const when = [fields.dateLabel, fields.time].filter(Boolean).join(", ");
  return (
    <EmailShell preheader={fields.preheader} unsubscribeUrl={unsubscribeUrl}>
      <Text
        style={{
          color: t.textDark,
          fontFamily: t.fontDisplay,
          fontSize: "26px",
          fontWeight: 700,
          lineHeight: "32px",
          margin: "0 0 6px",
        }}
      >
        {fields.headline}
      </Text>
      <Text style={{ color: t.tangerine, fontSize: "14px", fontWeight: 600, margin: "0 0 18px" }}>
        {when} &middot; {fields.location}
      </Text>
      <Text style={body}>{fields.intro}</Text>

      {fields.sessions.length > 0 && (
        <Section
          style={{
            backgroundColor: t.cream,
            borderRadius: "12px",
            padding: "14px 18px",
            margin: "0 0 18px",
          }}
        >
          {fields.sessions.map((s, i) => (
            <Row key={i} style={{ marginBottom: i < fields.sessions.length - 1 ? "8px" : "0" }}>
              <Column>
                <Text style={{ color: t.textDark, fontSize: "14px", fontWeight: 600, margin: 0 }}>
                  {s.name}
                </Text>
                <Text style={{ color: t.textLight, fontSize: "13px", margin: 0 }}>{s.time}</Text>
              </Column>
              <Column style={{ textAlign: "right" as const, verticalAlign: "top" }}>
                <Text style={{ color: t.coral, fontSize: "14px", fontWeight: 700, margin: 0 }}>
                  {s.price}
                </Text>
              </Column>
            </Row>
          ))}
        </Section>
      )}

      {fields.ctaLabel && fields.ctaUrl && (
        <Section style={{ textAlign: "center" as const, margin: "0 0 18px" }}>
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

      {fields.closingNote && <Text style={{ ...body, margin: 0 }}>{fields.closingNote}</Text>}
    </EmailShell>
  );
}
