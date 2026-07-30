export type SubscriberStatus = "subscribed" | "unsubscribed" | "bounced" | "complained";
export type SubscribeSource = "newsletter" | "contact" | "booking" | "trips-waitlist";
export type SubscribeAction = "create" | "update" | "resubscribe" | "blocked";

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * The spec's resubscribe matrix. `explicit` is true for the signup form and
 * for token resubscribe (the person is asking), false for inquiry-form side
 * effects. Admin paths do not go through this function.
 */
export function decideSubscribeAction(
  current: SubscriberStatus | null,
  explicit: boolean
): SubscribeAction {
  if (current === null) return "create";
  if (current === "subscribed") return "update";
  if (current === "complained") return "blocked";
  // unsubscribed or bounced
  return explicit ? "resubscribe" : "blocked";
}

/** Union, never replace: no write path may erase what another recorded. */
export function unionTags(existing: string[], incoming: string[]): string[] {
  return [...new Set([...existing, ...incoming])];
}

export function deriveContactSource(body: {
  source?: unknown;
  eventType?: unknown;
}): SubscribeSource {
  if (body.source === "trips-waitlist") return "trips-waitlist";
  if (typeof body.eventType === "string" && body.eventType) return "booking";
  return "contact";
}
