import { isValidEmail, normalizeEmail } from "@/lib/subscriber-rules";

export const MAX_SEATS = 4;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export type RegistrationInput = {
  eventId: string;
  sessionId: string;
  firstName: string;
  lastName: string | null;
  email: string;
  seats: number;
};

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

export function parseRegistrationInput(input: unknown): RegistrationInput | null {
  if (typeof input !== "object" || input === null) return null;
  const f = input as Record<string, unknown>;
  const seatsNum = typeof f.seats === "number" ? f.seats : parseInt(str(f.seats), 10);
  return {
    eventId: str(f.eventId),
    sessionId: str(f.sessionId),
    firstName: str(f.firstName).trim(),
    lastName: str(f.lastName).trim() || null,
    email: normalizeEmail(str(f.email)),
    seats: Number.isInteger(seatsNum) ? seatsNum : 0,
  };
}

export function validateRegistration(input: RegistrationInput): string[] {
  const errors: string[] = [];
  if (!input.firstName) errors.push("Add your first name.");
  if (!isValidEmail(input.email)) errors.push("Add a valid email address.");
  if (input.seats < 1 || input.seats > MAX_SEATS) {
    errors.push(`Seats must be between 1 and ${MAX_SEATS}.`);
  }
  return errors;
}

/** null capacity means unlimited; remaining is never negative. */
export function seatsRemaining(capacity: number | null, taken: number): number | null {
  if (capacity === null) return null;
  return Math.max(0, capacity - taken);
}

export function canRegister(args: {
  capacity: number | null;
  taken: number;
  seats: number;
}): { ok: true } | { ok: false; remaining: number } {
  const remaining = seatsRemaining(args.capacity, args.taken);
  if (remaining === null || args.seats <= remaining) return { ok: true };
  return { ok: false, remaining };
}

/** Event tag for the subscriber side effect: slugified title. */
export function slugTag(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * "2026-07-28" to "July 28, 2026". Date-only strings must be built as LOCAL
 * dates: new Date("2026-07-28") is UTC midnight, which is the previous day
 * in Denver.
 */
export function formatDateLabel(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return "";
  const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

/** Returns a plain-language error, or null when the file is acceptable. */
export function validateImageUpload(file: { type: string; size: number }): string | null {
  if (!IMAGE_TYPES.includes(file.type)) return "Images must be jpeg, png, or webp.";
  if (file.size > MAX_IMAGE_BYTES) return "Images must be under 5 MB.";
  return null;
}
