"use client";

import { useEffect, useState } from "react";
import { resultOf, seenMoments } from "@/app/actions";
import { Reel, holdMoments, pingMoments } from "@/components/LevelMoments";
import type { Moments } from "@/lib/data";

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
  return <Reel m={r} onClose={close} title="Logged ✓" done="Next game" />;
}
