"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  countAction,
  previewAction,
  sendAction,
  testSendAction,
} from "@/app/admin/(gated)/compose/actions";
import type { TemplateKey } from "@/lib/send-rules";

type Prefill = {
  headline: string;
  dateLabel: string;
  location: string;
  intro: string;
  sessions: { name: string; time: string; price: string }[];
  ctaUrl: string;
  preheader: string;
};

type SessionRow = { name: string; time: string; price: string };

const inputCls =
  "w-full px-3 py-2 rounded-xl border border-coral/10 bg-white text-sm text-text-dark placeholder:text-text-light focus:outline-none focus:border-coral/30";
const labelCls = "block text-xs font-semibold text-text-mid mb-1";

export function Composer({
  existingTags,
  prefill,
  addressSet,
  initialCount,
}: {
  existingTags: string[];
  prefill: Prefill | null;
  addressSet: boolean;
  initialCount: number;
}) {
  const [template, setTemplate] = useState<TemplateKey>("event-announcement");
  const [event, setEvent] = useState({
    subject: "",
    preheader: "",
    headline: "",
    dateLabel: "",
    time: "",
    location: "",
    intro: "",
    ctaLabel: "",
    ctaUrl: "",
    closingNote: "",
  });
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [update, setUpdate] = useState({
    subject: "",
    preheader: "",
    headline: "",
    body: "",
    ctaLabel: "",
    ctaUrl: "",
  });
  const [tags, setTags] = useState<string[]>([]);
  const [count, setCount] = useState(initialCount);
  const [previewHtml, setPreviewHtml] = useState("");
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; lines: string[] } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const payload = useCallback(() => {
    return template === "event-announcement"
      ? { template, fields: { ...event, sessions } }
      : { template, fields: update };
  }, [template, event, sessions, update]);

  // Debounced live preview.
  useEffect(() => {
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(async () => {
      const result = await previewAction(payload());
      if ("html" in result) setPreviewHtml(result.html);
    }, 500);
    return () => {
      if (previewTimer.current) clearTimeout(previewTimer.current);
    };
  }, [payload]);

  async function toggleTag(tag: string) {
    const next = tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag];
    setTags(next);
    setConfirming(false);
    const { count } = await countAction(next);
    setCount(count);
  }

  function applyPrefill() {
    if (!prefill) return;
    setTemplate("event-announcement");
    setEvent((prev) => ({
      ...prev,
      subject: prefill.headline,
      preheader: prefill.preheader,
      headline: prefill.headline,
      dateLabel: prefill.dateLabel,
      location: prefill.location,
      intro: prefill.intro,
      ctaLabel: "Sign Up",
      ctaUrl: prefill.ctaUrl,
    }));
    setSessions(prefill.sessions);
  }

  function handleTest() {
    setNotice(null);
    startTransition(async () => {
      const result = await testSendAction(payload());
      if ("sent" in result) setNotice({ kind: "ok", lines: [`Test email sent to ${result.sent}.`] });
      else if ("errors" in result) setNotice({ kind: "error", lines: result.errors });
      else setNotice({ kind: "error", lines: [result.error] });
    });
  }

  function handleSend() {
    setNotice(null);
    setConfirming(false);
    startTransition(async () => {
      const result = await sendAction(payload(), tags);
      if ("sendId" in result) {
        setNotice({
          kind: "ok",
          lines: [
            result.failed > 0
              ? `Sent to ${result.sent} people; ${result.failed} failed. See the send page to retry.`
              : `Sent to ${result.sent} people.`,
          ],
        });
      } else if ("errors" in result) setNotice({ kind: "error", lines: result.errors });
      else setNotice({ kind: "error", lines: [result.error] });
    });
  }

  const set = (patch: Partial<typeof event>) => setEvent((p) => ({ ...p, ...patch }));
  const setU = (patch: Partial<typeof update>) => setUpdate((p) => ({ ...p, ...patch }));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <div className="flex gap-2">
          {(
            [
              ["event-announcement", "Event announcement"],
              ["general-update", "General update"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTemplate(key)}
              className={`px-4 py-2 rounded-pill text-sm font-semibold border ${
                template === key
                  ? "bg-text-dark text-white border-text-dark"
                  : "bg-white text-text-mid border-coral/10"
              }`}
            >
              {label}
            </button>
          ))}
          {prefill && template === "event-announcement" && (
            <button
              type="button"
              onClick={applyPrefill}
              className="ml-auto px-4 py-2 rounded-pill text-sm font-semibold border border-coral/20 text-coral bg-white"
            >
              Prefill from featured event
            </button>
          )}
        </div>

        {template === "event-announcement" ? (
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Subject line</label>
              <input
                className={inputCls}
                value={event.subject}
                onChange={(e) => set({ subject: e.target.value })}
              />
            </div>
            <div>
              <label className={labelCls}>
                Preview text (optional, shows after the subject in inboxes)
              </label>
              <input
                className={inputCls}
                value={event.preheader}
                onChange={(e) => set({ preheader: e.target.value })}
              />
            </div>
            <div>
              <label className={labelCls}>Headline</label>
              <input
                className={inputCls}
                value={event.headline}
                onChange={(e) => set({ headline: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Date</label>
                <input
                  className={inputCls}
                  placeholder="July 28, 2026"
                  value={event.dateLabel}
                  onChange={(e) => set({ dateLabel: e.target.value })}
                />
              </div>
              <div>
                <label className={labelCls}>Time (optional)</label>
                <input
                  className={inputCls}
                  placeholder="4:45 - 8:00 PM"
                  value={event.time}
                  onChange={(e) => set({ time: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className={labelCls}>Location</label>
              <input
                className={inputCls}
                value={event.location}
                onChange={(e) => set({ location: e.target.value })}
              />
            </div>
            <div>
              <label className={labelCls}>Intro paragraph</label>
              <textarea
                className={inputCls}
                rows={3}
                value={event.intro}
                onChange={(e) => set({ intro: e.target.value })}
              />
            </div>
            <div>
              <label className={labelCls}>Sessions (optional)</label>
              {sessions.map((s, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <input
                    className={inputCls}
                    placeholder="Name"
                    value={s.name}
                    onChange={(e) =>
                      setSessions(
                        sessions.map((row, j) => (j === i ? { ...row, name: e.target.value } : row))
                      )
                    }
                  />
                  <input
                    className={inputCls}
                    placeholder="Time"
                    value={s.time}
                    onChange={(e) =>
                      setSessions(
                        sessions.map((row, j) => (j === i ? { ...row, time: e.target.value } : row))
                      )
                    }
                  />
                  <input
                    className={`${inputCls} max-w-24`}
                    placeholder="Price"
                    value={s.price}
                    onChange={(e) =>
                      setSessions(
                        sessions.map((row, j) => (j === i ? { ...row, price: e.target.value } : row))
                      )
                    }
                  />
                  <button
                    type="button"
                    aria-label="Remove session"
                    className="text-text-light text-sm px-1"
                    onClick={() => setSessions(sessions.filter((_, j) => j !== i))}
                  >
                    &times;
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="text-xs text-tangerine underline hover:no-underline"
                onClick={() => setSessions([...sessions, { name: "", time: "", price: "" }])}
              >
                Add a session
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Button label (optional)</label>
                <input
                  className={inputCls}
                  placeholder="Sign Up"
                  value={event.ctaLabel}
                  onChange={(e) => set({ ctaLabel: e.target.value })}
                />
              </div>
              <div>
                <label className={labelCls}>Button link</label>
                <input
                  className={inputCls}
                  placeholder="https://"
                  value={event.ctaUrl}
                  onChange={(e) => set({ ctaUrl: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className={labelCls}>Closing note (optional)</label>
              <textarea
                className={inputCls}
                rows={2}
                value={event.closingNote}
                onChange={(e) => set({ closingNote: e.target.value })}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Subject line</label>
              <input
                className={inputCls}
                value={update.subject}
                onChange={(e) => setU({ subject: e.target.value })}
              />
            </div>
            <div>
              <label className={labelCls}>Preview text (optional)</label>
              <input
                className={inputCls}
                value={update.preheader}
                onChange={(e) => setU({ preheader: e.target.value })}
              />
            </div>
            <div>
              <label className={labelCls}>Headline (optional)</label>
              <input
                className={inputCls}
                value={update.headline}
                onChange={(e) => setU({ headline: e.target.value })}
              />
            </div>
            <div>
              <label className={labelCls}>Message (blank line between paragraphs)</label>
              <textarea
                className={inputCls}
                rows={8}
                value={update.body}
                onChange={(e) => setU({ body: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Button label (optional)</label>
                <input
                  className={inputCls}
                  value={update.ctaLabel}
                  onChange={(e) => setU({ ctaLabel: e.target.value })}
                />
              </div>
              <div>
                <label className={labelCls}>Button link</label>
                <input
                  className={inputCls}
                  placeholder="https://"
                  value={update.ctaUrl}
                  onChange={(e) => setU({ ctaUrl: e.target.value })}
                />
              </div>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-coral/10 bg-white p-4 space-y-3">
          <p className="text-sm font-semibold text-text-dark">Who gets this?</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setTags([]);
                setConfirming(false);
                countAction([]).then(({ count }) => setCount(count));
              }}
              className={`px-3 py-1.5 rounded-pill text-xs font-semibold border ${
                tags.length === 0
                  ? "bg-text-dark text-white border-text-dark"
                  : "bg-white text-text-mid border-coral/10"
              }`}
            >
              Everyone subscribed
            </button>
            {existingTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`px-3 py-1.5 rounded-pill text-xs font-semibold border ${
                  tags.includes(tag)
                    ? "bg-tangerine text-white border-tangerine"
                    : "bg-white text-text-mid border-coral/10"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
          <p className="text-sm text-text-mid">
            Will send to <span className="font-bold text-text-dark">{count}</span>{" "}
            {count === 1 ? "person" : "people"}.
          </p>
        </div>

        {!addressSet && (
          <p className="text-xs text-red-500">
            Real sends are blocked until the business mailing address is set in
            lib/business.ts. Test sends still work.
          </p>
        )}

        {notice && (
          <div className={`text-sm ${notice.kind === "ok" ? "text-tangerine" : "text-red-500"}`}>
            {notice.lines.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        )}

        <div className="flex gap-2 items-center">
          <button
            type="button"
            onClick={handleTest}
            disabled={isPending}
            className="px-4 py-2 rounded-pill text-sm font-semibold border border-coral/20 text-text-dark bg-white disabled:opacity-50"
          >
            Send myself a test
          </button>
          {confirming ? (
            <>
              <button
                type="button"
                onClick={handleSend}
                disabled={isPending || !addressSet}
                className="px-4 py-2 rounded-pill text-sm font-semibold bg-gradient-to-r from-coral to-tangerine text-white disabled:opacity-50"
              >
                Yes, send to {count} {count === 1 ? "person" : "people"} now
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="text-xs text-text-mid underline hover:no-underline"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={isPending || !addressSet || count === 0}
              className="px-4 py-2 rounded-pill text-sm font-semibold bg-text-dark text-white disabled:opacity-50"
            >
              Send...
            </button>
          )}
          {isPending && <span className="text-xs text-text-light">Working...</span>}
          <Link
            href="/admin/sends"
            className="ml-auto text-xs text-text-mid underline hover:no-underline"
          >
            Past sends
          </Link>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-text-mid mb-2">
          Preview (exactly what recipients see)
        </p>
        <iframe
          title="Email preview"
          sandbox=""
          srcDoc={previewHtml}
          className="w-full h-[640px] rounded-2xl border border-coral/10 bg-white"
        />
      </div>
    </div>
  );
}
