import { Button, Column, Row, Section, Text } from "@react-email/components";
import { EmailShell } from "@/emails/layout";
import { emailTheme as t } from "@/emails/theme";
import { splitTitleAccent } from "@/lib/event-rules";
import type { AccentFont } from "@/lib/event-theme";
import type { EventAnnouncementFields } from "@/lib/send-rules";

/** Email-safe stand-ins for the site's headline accent treatments. */
const ACCENT_FONT_STYLES: Record<AccentFont, React.CSSProperties> = {
  script: {
    fontFamily: "'Brush Script MT', 'Segoe Script', 'Apple Chancery', cursive",
    fontSize: "32px",
    fontWeight: 400,
  },
  "serif-italic": { fontStyle: "italic" },
  "sans-bold": { fontFamily: t.fontBody, fontWeight: 800 },
};

export function EventAnnouncementEmail({
  fields,
  unsubscribeUrl,
}: {
  fields: EventAnnouncementFields;
  unsubscribeUrl: string;
}) {
  const s = fields.style;
  // Unstyled sends keep the original warm look exactly.
  const c = {
    ink: s?.ink ?? t.textDark,
    body: s?.body ?? t.textMid,
    muted: s?.muted ?? t.textLight,
    dateLine: s?.accent ?? t.tangerine,
    price: s?.accent ?? t.coral,
    button: s?.accent ?? t.coral,
    panel: s?.panel ?? t.cream,
  };
  const body = { color: c.body, fontSize: "15px", lineHeight: "23px", margin: "0 0 16px" };
  const when = [fields.dateLabel, fields.time].filter(Boolean).join(", ");
  const { lead, accent } = s ? splitTitleAccent(fields.headline) : { lead: fields.headline, accent: "" };

  return (
    <EmailShell preheader={fields.preheader} unsubscribeUrl={unsubscribeUrl} style={s}>
      <Text
        style={{
          color: c.ink,
          fontFamily: t.fontDisplay,
          fontSize: "26px",
          fontWeight: 700,
          lineHeight: "32px",
          margin: "0 0 6px",
        }}
      >
        {lead}
        {accent && s && (
          <span style={{ color: s.accent, ...ACCENT_FONT_STYLES[s.accentFont] }}>{accent}</span>
        )}
      </Text>
      <Text style={{ color: c.dateLine, fontSize: "14px", fontWeight: 600, margin: "0 0 18px" }}>
        {s?.dateIcon ? `${s.dateIcon} ` : ""}
        {when} &middot; {fields.location}
      </Text>
      <Text style={body}>{fields.intro}</Text>

      {fields.sessions.length > 0 && (
        <Section
          style={{
            backgroundColor: c.panel,
            border: s ? `1px solid ${s.border}` : undefined,
            borderRadius: "12px",
            padding: "14px 18px",
            margin: "0 0 18px",
          }}
        >
          {fields.sessions.map((session, i) => (
            <Row key={i} style={{ marginBottom: i < fields.sessions.length - 1 ? "8px" : "0" }}>
              <Column>
                <Text style={{ color: c.ink, fontSize: "14px", fontWeight: 600, margin: 0 }}>
                  {session.name}
                </Text>
                <Text style={{ color: c.muted, fontSize: "13px", margin: 0 }}>{session.time}</Text>
              </Column>
              <Column style={{ textAlign: "right" as const, verticalAlign: "top" }}>
                <Text style={{ color: c.price, fontSize: "14px", fontWeight: 700, margin: 0 }}>
                  {session.price}
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
              backgroundColor: c.button,
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
