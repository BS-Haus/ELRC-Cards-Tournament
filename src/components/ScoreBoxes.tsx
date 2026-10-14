"use client";

import { pingMoments } from "@/components/LevelMoments";
import { useState } from "react";
import { enterScore } from "@/app/actions";
import { useAction } from "@/components/useAction";
import { isFinalScore, type Game } from "@/lib/cards";

/** Two dark boxes, one under each team, to type the score straight in; the tick between them saves
 *  once it's a real result (to `to`, win by two). Subs, skipping and corrections stay in the full
 *  sheet (`onOpen`), which is also where a tap goes if you're not signed in. */
export function ScoreBoxes({ game, to, canScore, onOpen, onAccent = false, flip = false }: { game: Game; to: number; canScore: boolean; onOpen: () => void; onAccent?: boolean; flip?: boolean }) {
  // `flip`: the left box is team B (your side first, on your own card).
  const { run, pending, toast } = useAction();
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const na = a === "" ? null : Number(a);
  const nb = b === "" ? null : Number(b);
  const both = na !== null && nb !== null;
  const ready = both && isFinalScore(na, nb, to);
  const save = () => run(() => enterScore(game.id, flip ? nb! : na!, flip ? na! : nb!), "Score saved", (r) => { if (r.ok) { setA(""); setB(""); pingMoments(); } });
  const box = (v: string, set: (x: string) => void, who: string) =>
    canScore ? (
      <input
        value={v} onChange={(e) => set(e.target.value.replace(/\D/g, "").slice(0, 2))}
        onKeyDown={(e) => { if (e.key === "Enter" && ready) save(); }}
        inputMode="numeric" pattern="[0-9]*" maxLength={2} placeholder="–" aria-label={`${who} score`} enterKeyHint="done"
        className="tnum h-12 w-full rounded-xl bg-black/85 text-center font-mono text-[22px] font-black text-white placeholder:text-white/25 focus:outline-2 focus:outline-accent"
      />
    ) : (
      <button type="button" onClick={onOpen} aria-label="Sign in to enter the score" className="h-12 w-full rounded-xl bg-black/85 font-mono text-[22px] font-black text-white/25">–</button>
    );
  return (
    <div>
      {toast}
      <div className="grid grid-cols-[1fr_44px_1fr] items-center gap-2">
        {box(a, setA, "First team's")}
        <button
          type="button" disabled={!ready || pending} onClick={save} aria-label={ready ? `Save ${na}–${nb}` : "Enter both scores"}
          className={`spk-press flex h-12 items-center justify-center rounded-xl transition ${ready ? (onAccent ? "bg-ink text-accent" : "bg-accent text-ink") : onAccent ? "text-ink/30" : "text-white/20"}`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
        </button>
        {box(b, setB, "Second team's")}
      </div>
      {both && !ready && <p className={`mt-2 text-center text-[12px] font-semibold ${onAccent ? "text-ink/70" : "text-muted"}`}>Games go to {to}, win by two.</p>}
    </div>
  );
}
