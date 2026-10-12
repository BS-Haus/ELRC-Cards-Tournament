"use client";

import Link from "next/link";
import { setMyEntry } from "@/app/actions";
import { useAction } from "@/components/useAction";
import { card, btnPrimary, btnGhost, btnQuiet } from "@/components/ui";
import type { EntryState } from "@/lib/data";

/** The pulsing LIVE pill: the event header, and anywhere a live event is named. */
export function LiveBadge() {
  return (
    <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-accent/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[.14em] text-accent">
      <span className="spk-ping h-2 w-2 rounded-full bg-accent" aria-hidden="true" />Live
    </span>
  );
}

/** Are you coming / here / leaving. Before the draw it's the event page's sign-up; once a tournament
 *  is under way it lives on the Me page (src/app/me), titled with the event. */
export function CheckIn({ me, state, eventId, started, title, children }: { me: string | null; state: EntryState | null; eventId: string; started: boolean; title?: string; children?: React.ReactNode }) {
  const { run, pending, toast } = useAction();
  if (!me) {
    return (
      <div className="px-4 pb-6">
        <div className={`${card} flex items-center justify-between gap-3 p-4`}>
          <p className="text-[14px] text-muted">Make a profile to add yourself and enter scores. It&apos;s just your name and a 4-digit code.</p>
          <Link href={`/me?next=/e/${eventId}`} className={`${btnPrimary} shrink-0`}>Join</Link>
        </div>
      </div>
    );
  }
  const set = (s: EntryState, msg: string) => run(() => setMyEntry(eventId, s), msg);
  const head = title && (
    <Link href={`/e/${eventId}`} className="spk-press mb-3 flex items-center justify-between gap-3 border-b border-white/[.05] pb-3">
      <span className="min-w-0 truncate text-[16px] font-black">{title}</span>
      {started ? <LiveBadge /> : <span className="text-[13px] font-bold text-accent">Open →</span>}
    </Link>
  );
  const below = children && <div className="mt-4 border-t border-white/[.05] pt-4">{children}</div>;
  // Once it's under way there are only two answers, so it's a toggle you can see and flip.
  if (started) {
    const here = state === "here";
    return (
      <div className="px-4 pb-6">
        {toast}
        <div className={`${card} p-4`}>
          {head}
          <div className="grid grid-cols-2 gap-1 rounded-xl border border-white/[.06] bg-panel p-1" role="radiogroup" aria-label="Your check-in">
            <button role="radio" aria-checked={here} disabled={pending || here} onClick={() => set("here", "Checked in. You'll join the next stage")} className={`spk-press flex h-11 items-center justify-center gap-1.5 rounded-lg text-[14.5px] font-black ${here ? "bg-accent text-ink" : "text-muted"}`}>
              {here && <span aria-hidden="true">✓</span>}{here ? "Checked in" : "I'm here"}
            </button>
            <button role="radio" aria-checked={state === "out"} disabled={pending || state === "out"} onClick={() => set("out", "Marked as left. Your remaining games will get a sub")} className={`spk-press h-11 rounded-lg text-[14.5px] font-black ${state === "out" ? "bg-loss/20 text-loss" : "text-muted"}`}>
              {state === "out" ? "Left" : "I have to leave"}
            </button>
          </div>
          {below}
        </div>
      </div>
    );
  }
  const label = state === "here" ? "You're checked in" : state === "going" ? "You're in" : state === "out" ? "You're out" : "Are you coming?";
  // Checked in is the usual state on the day, and its only action is leaving: one line, not a card.
  if (state === "here") {
    return (
      <div className="px-4 pb-5">
        {toast}
        <div className={`${card} ${head ? "p-4" : "py-1.5 pr-1.5 pl-4"}`}>
          {head}
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-[14.5px] font-extrabold"><span className="text-accent" aria-hidden="true">✓</span>{label}</span>
            <button disabled={pending} onClick={() => set("out", started ? "Marked as left. Your remaining games will get a sub" : "No worries, you're off the list")} className={btnQuiet}>{started ? "I have to leave" : "Can't make it"}</button>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="px-4 pb-6">
      {toast}
      <div className={`${card} p-4`}>
        {head}
        <div className="text-[15px] font-extrabold">{label}</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {/* Once it's under way, "coming" means nothing: you're either here or not. */}
          {!started && state !== "going" && <button disabled={pending} onClick={() => set("going", "You're in. See you there!")} className={btnPrimary}>I&apos;m in</button>}
          <button disabled={pending} onClick={() => set("here", started ? "Checked in. You'll join the next stage" : "Checked in")} className={state === "going" || started ? btnPrimary : btnGhost}>I&apos;m here</button>
          {state !== "out" && <button disabled={pending} onClick={() => set("out", started ? "Marked as left. Your remaining games will get a sub" : "No worries, you're off the list")} className={btnQuiet}>Can&apos;t make it</button>}
        </div>
      </div>
    </div>
  );
}

