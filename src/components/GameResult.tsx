"use client";

import { useEffect, useState } from "react";
import { AnimatePresence } from "motion/react";
import { resultOf } from "@/app/actions";
import { Sheet, MatchResult } from "@/components/Nets";
import type { Moments } from "@/lib/data";

// The moment a score is saved, a small sheet shows the game's result: who won and each player's
// rating change. That's the whole reward: no full-screen story, nothing that pops up later.

/** Show the result of a game this phone just scored. */
export const showResult = (gameId: string) => { try { window.dispatchEvent(new CustomEvent("cards:result", { detail: gameId })); } catch {} };

export function GameResult() {
  const [r, setR] = useState<{ id: string; res: Moments } | null>(null);
  useEffect(() => {
    const on = async (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      const res = await resultOf(id).catch(() => null);
      if (res) setR({ id, res });
    };
    window.addEventListener("cards:result", on);
    return () => window.removeEventListener("cards:result", on);
  }, []);
  const close = () => setR(null);
  return (
    <AnimatePresence>
      {r && (
        <Sheet key={r.id} title="Score saved" onClose={close}>
          <MatchResult res={r.res} people={r.res.names} onDone={close} />
        </Sheet>
      )}
    </AnimatePresence>
  );
}
