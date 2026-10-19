"use client";

import { useEffect, useState } from "react";
import { resultOf, seenMoments } from "@/app/actions";
import { Reel, holdMoments, pingMoments } from "@/components/LevelMoments";
import type { Moments, LadderNext } from "@/lib/data";

// The moment a score is saved, the phone that saved it shows the game's story: the whole game
// (everyone's result, so the phone can go round the net), then, if you played, anything it did to
// your tier. It's the same story every player gets on their own phone.

/** Show the story of a game this phone just scored. */
export const showResult = (gameId: string) => { try { window.dispatchEvent(new CustomEvent("cards:result", { detail: gameId })); } catch {} };

type Shown = Moments & { played: boolean };

export function GameResult() {
  const [r, setR] = useState<Shown | null>(null);
  useEffect(() => {
    const on = async (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      holdMoments(true);
      const res = await resultOf(id).catch(() => null);
      if (res) setR(res);
      else { holdMoments(false); pingMoments(); } // couldn't load it: fall back to the usual check
    };
    window.addEventListener("cards:result", on);
    return () => window.removeEventListener("cards:result", on);
  }, []);
  if (!r) return null;
  const close = () => {
    setR(null);
    holdMoments(false);
    // You've just seen your story of this game here, so it doesn't pop up again.
    if (r.played) seenMoments(r.upTo).catch(() => {}).finally(pingMoments);
    else pingMoments();
  };
  return <Reel m={r} onClose={close} title="Logged ✓" done={r.ladder?.next ? "Go to your nets" : "Done"} extra={r.ladder && <LadderNextPanel l={r.ladder} names={r.names} />} />;
}

/** Under a ladder game's result: where everyone goes for the next round, or who's still playing. */
function LadderNextPanel({ l, names }: { l: LadderNext; names: Moments["names"] }) {
  const n = (ids: string[]) => ids.map((id) => names[id]?.name ?? "?").join(" & ");
  if (!l.next) {
    return (
      <p className="mb-3 rounded-2xl bg-white/[.06] px-4 py-3 text-[13.5px] font-semibold text-white/70">
        {l.waiting.length ? `Waiting on Net ${l.waiting.join(", Net ")}. The next round draws itself when ${l.waiting.length === 1 ? "it's" : "they're"} in.` : "That's the round."}
      </p>
    );
  }
  return (
    <div className="mb-3 rounded-2xl bg-white/[.06] px-4 py-3">
      <div className="mb-1.5 text-[11px] font-black uppercase tracking-[.16em] text-accent">Round {l.round} · next up</div>
      <div className="grid gap-1">
        {l.next.map((g) => (
          <div key={g.net} className="flex gap-2 text-[13px] leading-snug">
            <span className="w-11 shrink-0 font-bold text-white/50">Net {g.net}</span>
            <span className="min-w-0"><b>{n(g.a)}</b> <span className="text-white/40">v</span> <b>{n(g.b)}</b></span>
          </div>
        ))}
        {l.sitting.length > 0 && <div className="text-[12.5px] text-white/50">Sitting out: {n(l.sitting)}</div>}
      </div>
    </div>
  );
}
