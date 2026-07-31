export type EventStatus = "draft" | "published";

export type EventSessionInput = {
  name: string;
  timeLabel: string;
  priceLabel: string;
  capacity: number | null;
};

export type EventInput = {
  title: string;
  partner: string | null;
  dateLabel: string;
  endsAt: string;
  location: string;
  blurb: string;
  bannerText: string;
  externalSignupUrl: string | null;
  paymentInstructions: string | null;
  sessions: EventSessionInput[];
};

/**
 * The featured event is derived, never flagged: the earliest-ending
 * published event that has not ended yet.
 */
export function selectFeaturedEvent<T extends { status: string; ends_at: string | null }>(
  rows: T[],
  now: Date
): T | null {
  const upcoming = rows.filter(
    (r) =>
      r.status === "published" &&
      r.ends_at !== null &&
      new Date(r.ends_at).getTime() > now.getTime()
  );
  upcoming.sort(
    (a, b) => new Date(a.ends_at!).getTime() - new Date(b.ends_at!).getTime()
  );
  return upcoming[0] ?? null;
}

/**
 * Hero title convention: the last word of a multi-word title renders in the
 * gradient italic ("Mahjong in *Bloom*"). Single-word titles render plain.
 */
export function splitTitleAccent(title: string): { lead: string; accent: string } {
  const trimmed = title.trim();
  const cut = trimmed.lastIndexOf(" ");
  if (cut === -1) return { lead: trimmed, accent: "" };
  return { lead: trimmed.slice(0, cut + 1), accent: trimmed.slice(cut + 1) };
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function nullableStr(value: unknown): string | null {
  const s = str(value).trim();
  return s ? s : null;
}

/** Shape coercion only; business validation lives in validateEventInput. */
export function parseEventInput(input: unknown): EventInput | null {
  if (typeof input !== "object" || input === null) return null;
  const f = input as Record<string, unknown>;
  const rawSessions = Array.isArray(f.sessions) ? f.sessions : [];
  const sessions = rawSessions
    .map((s) => {
      const row = (typeof s === "object" && s !== null ? s : {}) as Record<string, unknown>;
      // Capacity arrives as a number from the editor state and as a string
      // from anything form-encoded; accept both.
      const capacityNum =
        typeof row.capacity === "number" ? row.capacity : parseInt(str(row.capacity), 10);
      return {
        name: str(row.name),
        timeLabel: str(row.timeLabel),
        priceLabel: str(row.priceLabel),
        capacity: Number.isInteger(capacityNum) && capacityNum > 0 ? capacityNum : null,
      };
    })
    .filter((s) => s.name || s.timeLabel || s.priceLabel);
  return {
    title: str(f.title),
    partner: nullableStr(f.partner),
    dateLabel: str(f.dateLabel),
    endsAt: str(f.endsAt),
    location: str(f.location),
    blurb: str(f.blurb),
    bannerText: str(f.bannerText),
    externalSignupUrl: nullableStr(f.externalSignupUrl),
    paymentInstructions: nullableStr(f.paymentInstructions),
    sessions,
  };
}

function isWebUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Draft saves are permissive (Annie can save half an event); publishing
 * demands everything the public surfaces render. Plain-language errors.
 */
export function validateEventInput(
  input: EventInput,
  opts: { forPublish: boolean; now?: Date }
): string[] {
  const errors: string[] = [];
  if (!input.title.trim()) errors.push("Add a title.");
  if (input.endsAt.trim() && Number.isNaN(new Date(input.endsAt).getTime())) {
    errors.push("The end date and time could not be read. Pick it again.");
  }
  if (input.externalSignupUrl && !isWebUrl(input.externalSignupUrl)) {
    errors.push("The sign-up link must start with http:// or https://.");
  }
  if (!opts.forPublish) return errors;

  const now = opts.now ?? new Date();
  if (!input.dateLabel.trim()) errors.push("Add the event date as it should read in print.");
  if (!input.endsAt.trim()) {
    errors.push("Pick when the event ends, so the site knows when to take it down.");
  } else if (
    !Number.isNaN(new Date(input.endsAt).getTime()) &&
    new Date(input.endsAt).getTime() <= now.getTime()
  ) {
    errors.push("The end time has already passed. Events must end in the future to publish.");
  }
  if (!input.location.trim()) errors.push("Add the location.");
  if (!input.blurb.trim()) errors.push("Add a short description.");
  if (!input.bannerText.trim()) errors.push("Add the announcement bar text.");
  for (const s of input.sessions) {
    if (!s.name.trim() || !s.timeLabel.trim() || !s.priceLabel.trim()) {
      errors.push("Each session needs a name, a time, and a price. Remove empty rows.");
      break;
    }
  }
  return errors;
}

/** Duplicate copies the content and clears what is event-date specific. */
export function duplicateTransform(source: EventInput): EventInput {
  return { ...source, dateLabel: "", endsAt: "", bannerText: "", sessions: [...source.sessions] };
}
