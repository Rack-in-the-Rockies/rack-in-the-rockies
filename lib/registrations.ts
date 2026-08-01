import {
  canRegister,
  validateRegistration,
  type RegistrationInput,
} from "@/lib/registration-rules";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type RegistrationRow = {
  id: string;
  event_id: string;
  session_id: string;
  first_name: string;
  last_name: string | null;
  email: string;
  seats: number;
  status: "confirmed" | "cancelled";
  cancel_token: string;
  created_at?: string;
};

export type RegistrationDb = {
  seatsTaken(sessionId: string): Promise<number>;
  insert(row: Omit<RegistrationRow, "id" | "status" | "cancel_token">): Promise<RegistrationRow>;
  findByToken(token: string): Promise<RegistrationRow | null>;
  updateStatus(id: string, status: "confirmed" | "cancelled"): Promise<void>;
};

export type RegisterResult =
  | { outcome: "registered"; registration: RegistrationRow }
  | { outcome: "sold_out"; remaining: number }
  | { outcome: "invalid"; errors: string[] };

export async function register(
  input: RegistrationInput,
  session: { capacity: number | null },
  db: RegistrationDb = liveDb()
): Promise<RegisterResult> {
  const errors = validateRegistration(input);
  if (errors.length) return { outcome: "invalid", errors };

  const taken = await db.seatsTaken(input.sessionId);
  const check = canRegister({ capacity: session.capacity, taken, seats: input.seats });
  if (!check.ok) return { outcome: "sold_out", remaining: check.remaining };

  const registration = await db.insert({
    event_id: input.eventId,
    session_id: input.sessionId,
    first_name: input.firstName,
    last_name: input.lastName,
    email: input.email,
    seats: input.seats,
  });
  return { outcome: "registered", registration };
}

export type CancelResult = {
  outcome: "cancelled" | "already_cancelled" | "not_found";
  registration?: RegistrationRow;
};

export async function cancelByToken(
  token: string,
  db: RegistrationDb = liveDb()
): Promise<CancelResult> {
  const row = await db.findByToken(token);
  if (!row) return { outcome: "not_found" };
  if (row.status === "cancelled") return { outcome: "already_cancelled", registration: row };
  await db.updateStatus(row.id, "cancelled");
  return { outcome: "cancelled", registration: row };
}

const COLUMNS =
  "id, event_id, session_id, first_name, last_name, email, seats, status, cancel_token, created_at";

function liveDb(): RegistrationDb {
  const client = supabaseAdmin();
  return {
    async seatsTaken(sessionId) {
      const { data, error } = await client
        .from("event_registrations")
        .select("seats")
        .eq("session_id", sessionId)
        .eq("status", "confirmed")
        .limit(10000);
      if (error) throw error;
      return (data as { seats: number }[]).reduce((sum, r) => sum + r.seats, 0);
    },
    async insert(row) {
      const { data, error } = await client
        .from("event_registrations")
        .insert(row)
        .select(COLUMNS)
        .single();
      if (error) throw error;
      return data as RegistrationRow;
    },
    async findByToken(token) {
      const { data, error } = await client
        .from("event_registrations")
        .select(COLUMNS)
        .eq("cancel_token", token)
        .maybeSingle();
      if (error) throw error;
      return (data as RegistrationRow) ?? null;
    },
    async updateStatus(id, status) {
      const { error } = await client
        .from("event_registrations")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
  };
}

// Admin/read helpers (straight queries, no rules).

export async function sessionSeatCounts(eventId: string): Promise<Map<string, number>> {
  const { data, error } = await supabaseAdmin()
    .from("event_registrations")
    .select("session_id, seats")
    .eq("event_id", eventId)
    .eq("status", "confirmed")
    .limit(10000);
  if (error) throw error;
  const counts = new Map<string, number>();
  for (const r of data as { session_id: string; seats: number }[]) {
    counts.set(r.session_id, (counts.get(r.session_id) ?? 0) + r.seats);
  }
  return counts;
}

export async function listRegistrants(eventId: string): Promise<RegistrationRow[]> {
  const { data, error } = await supabaseAdmin()
    .from("event_registrations")
    .select(COLUMNS)
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .limit(10000);
  if (error) throw error;
  return data as RegistrationRow[];
}
