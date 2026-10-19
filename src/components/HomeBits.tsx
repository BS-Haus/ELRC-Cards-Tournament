"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { setMyEntry, createEvent } from "@/app/actions";
import { useAction } from "@/components/useAction";
import { btnPrimary, btnGhost, input } from "@/components/ui";
import type { EntryState } from "@/lib/data";

export function RsvpButton({ eventId, mine, signedIn }: { eventId: string; mine: EntryState | null; signedIn: boolean }) {
  const { run, pending, toast } = useAction();
  if (!signedIn) return <Link href={`/me?next=/e/${eventId}`} className={`${btnPrimary} shrink-0`}>Join</Link>;
  const inIt = mine === "going" || mine === "here";
  return (
    <>
      {toast}
      <button
        disabled={pending}
        onClick={() => run(() => setMyEntry(eventId, inIt ? "out" : "going"), inIt ? "You're down as not coming" : "You're in. See you there!")}
        className={`${inIt ? btnGhost : btnPrimary} shrink-0`}
        aria-pressed={inIt}
      >
        {inIt ? "✓ In" : "I'm in"}
      </button>
    </>
  );
}

/** Next Sunday at 11:00, London time, as a datetime-local value. */
function nextSunday(): string {
  const d = new Date();
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7 || 7));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T11:00`;
}

export function NewEvent() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { run, pending, toast } = useAction();
  const [f, setF] = useState({ title: "Saturday ladder", startsAt: nextSunday(), location: "Victoria Park", notes: "", nets: 3, groupTo: 15, finalTo: 15, format: "ladder" as "ladder" | "cards" });
  if (!open) return <button onClick={() => setOpen(true)} className="spk-press font-bold text-accent">+ New event</button>;
  const field = (k: keyof typeof f, label: string, type = "text") => (
    <label className="grid gap-1 text-[12.5px] font-semibold text-muted">
      {label}
      <input className={input} type={type} value={f[k] as string | number} onChange={(e) => setF({ ...f, [k]: type === "number" ? Number(e.target.value) : e.target.value })} />
    </label>
  );
  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/60" onClick={() => setOpen(false)}>
      {toast}
      <form
        className="spk-sheet mx-auto grid w-full max-w-[480px] gap-3 rounded-t-3xl border-t border-white/[.08] bg-surface p-5 pb-[calc(20px+env(safe-area-inset-bottom))] text-left"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          run(() => createEvent({ ...f, startsAt: new Date(f.startsAt).toISOString() }), "Event posted", (r) => {
            if (r.ok && r.id) { setOpen(false); router.push(`/e/${r.id}`); }
          });
        }}
      >
        <h2 className="text-[20px] font-black text-fg">New event</h2>
        {field("title", "Name")}
        {field("startsAt", "Date and time", "datetime-local")}
        {field("location", "Where")}
        {/* Ladder is the everyday format; cards (groups, then finals) suits a big field. */}
        <div className="grid grid-cols-2 gap-1 rounded-xl border border-white/[.06] bg-panel p-1" role="radiogroup" aria-label="Format">
          {(["ladder", "cards"] as const).map((x) => (
            <button key={x} type="button" role="radio" aria-checked={f.format === x} onClick={() => setF({ ...f, format: x, title: f.title === "Saturday ladder" || f.title === "Saturday cards" ? `Saturday ${x}` : f.title })} className={`spk-press h-10 rounded-lg text-[14px] font-black ${f.format === x ? "bg-accent text-ink" : "text-muted"}`}>
              {x === "ladder" ? "Ladder" : "Cards"}
            </button>
          ))}
        </div>
        <p className="-mt-1 text-[12.5px] text-dim">{f.format === "ladder" ? "Nets top to bottom: win and go up, lose and go down. A new partner every game." : "Groups, then A/B finals. Best with a big turnout."}</p>
        {f.format === "ladder" ? (
          <div className="grid grid-cols-2 gap-2">
            {field("nets", "Nets", "number")}
            <label className="grid gap-1 text-[12.5px] font-semibold text-muted">
              Games to
              <select className={input} value={f.groupTo} onChange={(e) => setF({ ...f, groupTo: Number(e.target.value) })}>
                {[11, 15, 17, 21].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {field("nets", "Nets", "number")}
            {field("groupTo", "Groups to", "number")}
            {field("finalTo", "Finals to", "number")}
          </div>
        )}
        <label className="grid gap-1 text-[12.5px] font-semibold text-muted">
          Notes for players (optional)
          <textarea className={`${input} min-h-20 py-3`} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Bring water. We'll be by the boating lake." />
        </label>
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={() => setOpen(false)} className={`${btnGhost} flex-1`}>Cancel</button>
          <button disabled={pending} className={`${btnPrimary} flex-[2]`}>{pending ? "Posting…" : "Post event"}</button>
        </div>
      </form>
    </div>
  );
}
