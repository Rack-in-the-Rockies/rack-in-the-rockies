import { describe, it, expect } from "vitest";
import {
  register,
  cancelByToken,
  type RegistrationDb,
  type RegistrationRow,
} from "@/lib/registrations";

function memory(seed: RegistrationRow[] = []) {
  const rows = [...seed];
  const db: RegistrationDb = {
    async seatsTaken(sessionId) {
      return rows
        .filter((r) => r.session_id === sessionId && r.status === "confirmed")
        .reduce((sum, r) => sum + r.seats, 0);
    },
    async insert(row) {
      const full: RegistrationRow = {
        id: `reg-${rows.length + 1}`,
        status: "confirmed",
        cancel_token: `tok-${rows.length + 1}`,
        ...row,
      };
      rows.push(full);
      return full;
    },
    async findByToken(token) {
      return rows.find((r) => r.cancel_token === token) ?? null;
    },
    async updateStatus(id, status) {
      const row = rows.find((r) => r.id === id);
      if (row) row.status = status;
    },
  };
  return { db, rows };
}

const input = {
  eventId: "evt-1",
  sessionId: "sess-1",
  firstName: "Annie",
  lastName: null,
  email: "annie@example.com",
  seats: 2,
};

function seeded(seats: number): RegistrationRow {
  return {
    id: "reg-0",
    event_id: "evt-1",
    session_id: "sess-1",
    first_name: "Prior",
    last_name: null,
    email: "prior@example.com",
    seats,
    status: "confirmed",
    cancel_token: "tok-0",
  };
}

describe("register", () => {
  it("inserts when capacity fits and returns the row", async () => {
    const { db, rows } = memory([seeded(20)]);
    const result = await register(input, { capacity: 24 }, db);
    expect(result.outcome).toBe("registered");
    expect(rows).toHaveLength(2);
  });
  it("refuses when the session is full, naming remaining seats", async () => {
    const { db, rows } = memory([seeded(23)]);
    const result = await register(input, { capacity: 24 }, db);
    expect(result.outcome).toBe("sold_out");
    expect(result.outcome === "sold_out" && result.remaining).toBe(1);
    expect(rows).toHaveLength(1);
  });
  it("ignores capacity when unlimited and rejects invalid input", async () => {
    const { db } = memory([seeded(500)]);
    expect((await register(input, { capacity: null }, db)).outcome).toBe("registered");
    expect(
      (await register({ ...input, email: "junk" }, { capacity: null }, db)).outcome
    ).toBe("invalid");
  });
});

describe("cancelByToken", () => {
  it("cancels and frees seats; unknown and repeat cancels are neutral", async () => {
    const { db, rows } = memory([seeded(3)]);
    expect((await cancelByToken("tok-0", db)).outcome).toBe("cancelled");
    expect(rows[0].status).toBe("cancelled");
    expect(await db.seatsTaken("sess-1")).toBe(0);
    expect((await cancelByToken("tok-0", db)).outcome).toBe("already_cancelled");
    expect((await cancelByToken("nope", db)).outcome).toBe("not_found");
  });
});
