"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  saveEventAction,
  publishEventAction,
  unpublishEventAction,
  duplicateEventAction,
  deleteDraftAction,
} from "@/app/admin/(gated)/events/actions";
import { FeaturedEventHero } from "@/components/featured-event-hero";
import type { EventInput, EventStatus } from "@/lib/event-rules";
import type { EventWithSessions } from "@/lib/events";

const inputCls =
  "w-full px-3 py-2 rounded-xl border border-coral/10 bg-white text-sm text-text-dark placeholder:text-text-light focus:outline-none focus:border-coral/30";
const labelCls = "block text-xs font-semibold text-text-mid mb-1";

const EMPTY: EventInput = {
  title: "",
  partner: null,
  dateLabel: "",
  endsAt: "",
  location: "",
  blurb: "",
  bannerText: "",
  externalSignupUrl: null,
  paymentInstructions: null,
  imageUrl: null,
  imageAlt: null,
  sessions: [],
};

/** ISO string to the value a datetime-local input wants (local time). */
function toLocalInputValue(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function DuplicateButton({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = await duplicateEventAction(eventId);
          if ("id" in result) router.push(`/admin/events/${result.id}`);
        })
      }
      className="text-xs text-tangerine underline hover:no-underline disabled:opacity-50"
    >
      Duplicate
    </button>
  );
}

export function EventEditor({
  eventId,
  status,
  initial,
}: {
  eventId: string | null;
  status: EventStatus;
  initial: EventInput | null;
}) {
  const router = useRouter();
  const [form, setForm] = useState<EventInput>(initial ?? EMPTY);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; lines: string[] } | null>(null);
  const [isPending, startTransition] = useTransition();

  const set = (patch: Partial<EventInput>) => setForm((p) => ({ ...p, ...patch }));

  function run(
    fn: () => Promise<{ id: string } | { errors: string[] } | { error: string }>,
    okText: string
  ) {
    setNotice(null);
    startTransition(async () => {
      const result = await fn();
      if ("id" in result) {
        setNotice({ kind: "ok", lines: [okText] });
        if (!eventId) router.push(`/admin/events/${result.id}`);
        else router.refresh();
      } else if ("errors" in result) setNotice({ kind: "error", lines: result.errors });
      else setNotice({ kind: "error", lines: [result.error] });
    });
  }

  // The preview renders the REAL site hero with the in-progress state, so
  // preview and production cannot drift.
  const previewEvent: EventWithSessions = {
    id: eventId ?? "preview",
    title: form.title || "Untitled Event",
    partner: form.partner,
    date_label: form.dateLabel || "Date to come",
    ends_at: form.endsAt || null,
    location: form.location || "Location to come",
    blurb: form.blurb,
    banner_text: form.bannerText,
    external_signup_url: form.externalSignupUrl,
    payment_instructions: form.paymentInstructions,
    image_url: form.imageUrl,
    image_alt: form.imageAlt,
    status,
    created_by: "",
    created_at: "",
    updated_at: "",
    sessions: form.sessions.map((s, i) => ({
      id: s.id ?? `preview-${i}`,
      event_id: "preview",
      name: s.name,
      time_label: s.timeLabel,
      price_label: s.priceLabel,
      capacity: s.capacity,
      sort_order: i,
    })),
  };

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <div className="space-y-3">
        <div>
          <label className={labelCls}>Title</label>
          <input className={inputCls} value={form.title} onChange={(e) => set({ title: e.target.value })} />
        </div>
        <div>
          <label className={labelCls}>Partner (optional, renders as &quot;at ...&quot;)</label>
          <input
            className={inputCls}
            value={form.partner ?? ""}
            onChange={(e) => set({ partner: e.target.value || null })}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Date, as it should read</label>
            <input
              className={inputCls}
              placeholder="July 28, 2026"
              value={form.dateLabel}
              onChange={(e) => set({ dateLabel: e.target.value })}
            />
          </div>
          <div>
            <label className={labelCls}>When it ends (site hides it after this)</label>
            <input
              type="datetime-local"
              className={inputCls}
              value={toLocalInputValue(form.endsAt)}
              onChange={(e) =>
                set({ endsAt: e.target.value ? new Date(e.target.value).toISOString() : "" })
              }
            />
          </div>
        </div>
        <div>
          <label className={labelCls}>Location</label>
          <input className={inputCls} value={form.location} onChange={(e) => set({ location: e.target.value })} />
        </div>
        <div>
          <label className={labelCls}>Description</label>
          <textarea className={inputCls} rows={3} value={form.blurb} onChange={(e) => set({ blurb: e.target.value })} />
        </div>
        <div>
          <label className={labelCls}>Announcement bar text (shows at the top of every page)</label>
          <input
            className={inputCls}
            placeholder="Mahjong in Bloom: July 28 at Tee Lee Floral"
            value={form.bannerText}
            onChange={(e) => set({ bannerText: e.target.value })}
          />
        </div>
        <div>
          <label className={labelCls}>Sessions</label>
          {form.sessions.map((s, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <input
                className={inputCls}
                placeholder="Name"
                value={s.name}
                onChange={(e) =>
                  set({
                    sessions: form.sessions.map((row, j) =>
                      j === i ? { ...row, name: e.target.value } : row
                    ),
                  })
                }
              />
              <input
                className={inputCls}
                placeholder="4:45 - 8:00 PM"
                value={s.timeLabel}
                onChange={(e) =>
                  set({
                    sessions: form.sessions.map((row, j) =>
                      j === i ? { ...row, timeLabel: e.target.value } : row
                    ),
                  })
                }
              />
              <input
                className={`${inputCls} max-w-20`}
                placeholder="$60"
                value={s.priceLabel}
                onChange={(e) =>
                  set({
                    sessions: form.sessions.map((row, j) =>
                      j === i ? { ...row, priceLabel: e.target.value } : row
                    ),
                  })
                }
              />
              <input
                className={`${inputCls} max-w-20`}
                placeholder="Seats"
                value={s.capacity ?? ""}
                onChange={(e) =>
                  set({
                    sessions: form.sessions.map((row, j) =>
                      j === i
                        ? {
                            ...row,
                            capacity: /^\d+$/.test(e.target.value)
                              ? parseInt(e.target.value, 10)
                              : null,
                          }
                        : row
                    ),
                  })
                }
              />
              <button
                type="button"
                aria-label="Remove session"
                className="text-text-light text-sm px-1"
                onClick={() => set({ sessions: form.sessions.filter((_, j) => j !== i) })}
              >
                &times;
              </button>
            </div>
          ))}
          <button
            type="button"
            className="text-xs text-tangerine underline hover:no-underline"
            onClick={() =>
              set({
                sessions: [
                  ...form.sessions,
                  { id: null, name: "", timeLabel: "", priceLabel: "", capacity: null },
                ],
              })
            }
          >
            Add a session
          </button>
        </div>
        <div>
          <label className={labelCls}>
            Sign-up link (optional; leave empty if there is no external form)
          </label>
          <input
            className={inputCls}
            placeholder="https://"
            value={form.externalSignupUrl ?? ""}
            onChange={(e) => set({ externalSignupUrl: e.target.value || null })}
          />
        </div>
        <div>
          <label className={labelCls}>
            Payment instructions (optional, used by registration emails later)
          </label>
          <textarea
            className={inputCls}
            rows={2}
            value={form.paymentInstructions ?? ""}
            onChange={(e) => set({ paymentInstructions: e.target.value || null })}
          />
        </div>

        {notice && (
          <div className={`text-sm ${notice.kind === "ok" ? "text-tangerine" : "text-red-500"}`}>
            {notice.lines.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2 items-center pt-1">
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              run(
                () => saveEventAction(eventId, form),
                status === "published" ? "Saved. The live site is updated." : "Draft saved."
              )
            }
            className="px-4 py-2 rounded-pill text-sm font-semibold bg-text-dark text-white disabled:opacity-50"
          >
            {status === "published" ? "Save and update site" : "Save draft"}
          </button>
          {status === "draft" && eventId && (
            <button
              type="button"
              disabled={isPending}
              onClick={() =>
                run(() => publishEventAction(eventId, form), "Published. It is live on the site.")
              }
              className="px-4 py-2 rounded-pill text-sm font-semibold bg-gradient-to-r from-coral to-tangerine text-white disabled:opacity-50"
            >
              Publish to site
            </button>
          )}
          {status === "published" && eventId && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => run(() => unpublishEventAction(eventId), "Unpublished. It is off the site.")}
              className="text-xs text-text-mid underline hover:no-underline"
            >
              Unpublish
            </button>
          )}
          {status === "draft" && eventId && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                setNotice(null);
                startTransition(async () => {
                  await deleteDraftAction(eventId);
                  router.push("/admin/events");
                });
              }}
              className="text-xs text-red-500 underline hover:no-underline"
            >
              Delete draft
            </button>
          )}
          {isPending && <span className="text-xs text-text-light">Working...</span>}
          <Link
            href="/admin/events"
            className="ml-auto text-xs text-text-mid underline hover:no-underline"
          >
            All events
          </Link>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-text-mid mb-2">
          Preview (this is the real site component)
        </p>
        <div className="rounded-2xl border border-coral/10 overflow-hidden">
          <FeaturedEventHero event={previewEvent} />
        </div>
      </div>
    </div>
  );
}
