import { supabaseAdmin } from "@/lib/supabase/admin";
import { type EventInput, type EventStatus } from "@/lib/event-rules";

export type EventRow = {
  id: string;
  title: string;
  partner: string | null;
  date_label: string;
  ends_at: string | null;
  location: string;
  blurb: string;
  banner_text: string;
  external_signup_url: string | null;
  payment_instructions: string | null;
  image_url: string | null;
  image_alt: string | null;
  status: EventStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type EventSessionRow = {
  id: string;
  event_id: string;
  name: string;
  time_label: string;
  price_label: string;
  capacity: number | null;
  sort_order: number;
};

export type EventWithSessions = EventRow & { sessions: EventSessionRow[] };

const EVENT_SELECT = "*, event_sessions (*)";

type Joined = EventRow & { event_sessions: EventSessionRow[] };

function withSessions(row: Joined): EventWithSessions {
  const { event_sessions, ...event } = row;
  return {
    ...event,
    sessions: [...(event_sessions ?? [])].sort((a, b) => a.sort_order - b.sort_order),
  };
}

/**
 * The event every public surface renders. Fails SOFT: a database problem
 * must degrade to "no event shown", never take the site down.
 */
export async function getFeaturedEvent(): Promise<EventWithSessions | null> {
  try {
    const { data, error } = await supabaseAdmin()
      .from("events")
      .select(EVENT_SELECT)
      .eq("status", "published")
      .gt("ends_at", new Date().toISOString())
      .order("ends_at", { ascending: true })
      .limit(1);
    if (error) throw error;
    const row = (data as unknown as Joined[])[0];
    return row ? withSessions(row) : null;
  } catch (error) {
    console.error("getFeaturedEvent failed; rendering without an event", error);
    return null;
  }
}

export type EventListItem = EventRow & { session_count: number; ended: boolean };

export async function listEvents(): Promise<EventListItem[]> {
  const { data, error } = await supabaseAdmin()
    .from("events")
    .select("*, event_sessions (count)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  const now = Date.now();
  return (data as unknown as (EventRow & { event_sessions: { count: number }[] })[]).map(
    ({ event_sessions, ...event }) => ({
      ...event,
      session_count: event_sessions?.[0]?.count ?? 0,
      ended: event.ends_at !== null && new Date(event.ends_at).getTime() <= now,
    })
  );
}

export async function getEvent(id: string): Promise<EventWithSessions | null> {
  const { data, error } = await supabaseAdmin()
    .from("events")
    .select(EVENT_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? withSessions(data as unknown as Joined) : null;
}

function toRowPatch(input: EventInput) {
  return {
    title: input.title.trim(),
    partner: input.partner,
    date_label: input.dateLabel.trim(),
    ends_at: input.endsAt.trim() ? new Date(input.endsAt).toISOString() : null,
    location: input.location.trim(),
    blurb: input.blurb.trim(),
    banner_text: input.bannerText.trim(),
    external_signup_url: input.externalSignupUrl,
    payment_instructions: input.paymentInstructions,
    image_url: input.imageUrl,
    image_alt: input.imageAlt,
  };
}

export class SessionInUseError extends Error {
  constructor() {
    super("A session with registrations cannot be removed. Cancel its registrations first.");
  }
}

/**
 * Id-preserving session sync: registrations reference session rows, so
 * update-in-place by id, insert new rows, and delete removed rows only when
 * nothing references them.
 */
async function syncSessions(eventId: string, sessions: EventInput["sessions"]) {
  const client = supabaseAdmin();
  const { data: existingRows, error: listError } = await client
    .from("event_sessions")
    .select("id")
    .eq("event_id", eventId);
  if (listError) throw listError;
  const keptIds = new Set(sessions.map((s) => s.id).filter(Boolean));
  const removedIds = (existingRows as { id: string }[])
    .map((r) => r.id)
    .filter((id) => !keptIds.has(id));

  if (removedIds.length > 0) {
    const { count, error: regError } = await client
      .from("event_registrations")
      .select("id", { count: "exact", head: true })
      .in("session_id", removedIds);
    if (regError) throw regError;
    if ((count ?? 0) > 0) throw new SessionInUseError();
    const { error: delError } = await client.from("event_sessions").delete().in("id", removedIds);
    if (delError) throw delError;
  }

  for (const [i, s] of sessions.entries()) {
    const row = {
      event_id: eventId,
      name: s.name.trim(),
      time_label: s.timeLabel.trim(),
      price_label: s.priceLabel.trim(),
      capacity: s.capacity,
      sort_order: i,
    };
    if (s.id) {
      const { error } = await client.from("event_sessions").update(row).eq("id", s.id);
      if (error) throw error;
    } else {
      const { error } = await client.from("event_sessions").insert(row);
      if (error) throw error;
    }
  }
}

export async function createEvent(input: EventInput, createdBy: string): Promise<string> {
  const { data, error } = await supabaseAdmin()
    .from("events")
    .insert({ ...toRowPatch(input), created_by: createdBy })
    .select("id")
    .single();
  if (error) throw error;
  const id = (data as { id: string }).id;
  await syncSessions(id, input.sessions);
  return id;
}

export async function updateEvent(id: string, input: EventInput): Promise<void> {
  const { error } = await supabaseAdmin().from("events").update(toRowPatch(input)).eq("id", id);
  if (error) throw error;
  await syncSessions(id, input.sessions);
}

export async function setEventStatus(id: string, status: EventStatus): Promise<void> {
  const { error } = await supabaseAdmin().from("events").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function deleteDraftEvent(id: string): Promise<void> {
  const client = supabaseAdmin();
  // An unpublished-then-deleted event must not cascade away its
  // registration history.
  const { count, error: regError } = await client
    .from("event_registrations")
    .select("id", { count: "exact", head: true })
    .eq("event_id", id);
  if (regError) throw regError;
  if ((count ?? 0) > 0) {
    throw new Error("This event has registrations and cannot be deleted.");
  }
  const { error } = await client.from("events").delete().eq("id", id).eq("status", "draft");
  if (error) throw error;
}

/** DB row shape to editor/form shape. Used by the editor and duplicate. */
export function toEventInput(e: EventWithSessions): EventInput {
  return {
    title: e.title,
    partner: e.partner,
    dateLabel: e.date_label,
    endsAt: e.ends_at ?? "",
    location: e.location,
    blurb: e.blurb,
    bannerText: e.banner_text,
    externalSignupUrl: e.external_signup_url,
    paymentInstructions: e.payment_instructions,
    imageUrl: e.image_url,
    imageAlt: e.image_alt,
    sessions: e.sessions.map((s) => ({
      id: s.id,
      name: s.name,
      timeLabel: s.time_label,
      priceLabel: s.price_label,
      capacity: s.capacity,
    })),
  };
}
