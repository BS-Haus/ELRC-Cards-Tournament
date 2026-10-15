"use client";

import { showResult } from "@/components/GameResult";
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { enterScore } from "@/app/actions";
import { useAction } from "@/components/useAction";
import { ScoreEntry, scoresOf, type Pick } from "@/components/ScoreEntry";
import { SPRING, SOFT } from "@/components/kit";
import type { Game } from "@/lib/cards";
import type { PlayerLite } from "@/lib/data";

/** Scoring a game where it's shown (a net, your own next game): tap the winners, slide the losers'
 *  score, save. Subs, skipping and corrections stay in the full sheet (`onOpen`), which is also
 *  where a tap goes if you're not signed in. `flip`: team B on the left (your side first). */
export function ScoreBoxes({ game, to, canScore, onOpen, people, onAccent = false, flip = false }: { game: Game; to: number; canScore: boolean; onOpen: () => void; people: Record<string, PlayerLite>; onAccent?: boolean; flip?: boolean }) {
  const { run, pending, toast } = useAction();
  const [pick, setPick] = useState<Pick>({ winner: null, loser: 0 });
  // The entry works left/right; map back to the game's own A/B.
  const left = flip ? game.b : game.a, right = flip ? game.a : game.b;
  const s = scoresOf(pick, to);
  const save = () => {
    if (!s) return;
    const [l, r] = s;
    run(() => enterScore(game.id, flip ? r : l, flip ? l : r), "Score saved", (x) => { if (x.ok) { setPick({ winner: null, loser: 0 }); showResult(game.id); } });
  };
  if (!canScore) {
    return <button type="button" onClick={onOpen} className={`spk-press h-11 w-full rounded-xl text-[13.5px] font-bold ${onAccent ? "bg-ink/10" : "bg-raised text-muted"}`}>Sign in to enter the score</button>;
  }
  return (
    <div className="min-w-0">
      {toast}
      <ScoreEntry a={left} b={right} people={people} to={to} value={pick} onChange={setPick} onAccent={onAccent} />
      {/* The save button only appears once there's a result to save, so an unscored card stays short. */}
      <AnimatePresence initial={false}>
        {s && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={SOFT} className="overflow-hidden">
            <motion.button
              type="button" onClick={save} disabled={pending} whileTap={{ scale: 0.97 }} transition={SPRING}
              className={`mt-3 h-12 w-full rounded-[13px] text-[15px] font-extrabold ${onAccent ? "bg-ink text-accent" : "bg-accent text-ink"}`}
              aria-label={`Save ${s[0]}–${s[1]}`}
            >
              Save {s[0]}–{s[1]}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
