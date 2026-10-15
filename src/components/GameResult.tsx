"use client";

import { useEffect, useState } from "react";
import { resultOf, seenMoments } from "@/app/actions";
import { holdMoments, pingMoments } from "@/components/LevelMoments";
import { CountUp, Confetti } from "@/components/StoryReel";
import { Avatar } from "@/components/ui";
import { PROV_N } from "@/lib/standings";
import type { GameResult as Result } from "@/lib/data";
import type { ResultLine } from "@/lib/moments";

/** A win the winners had less than this chance of is an upset (the same line the stories use). */
const UPSET_BELOW = 0.4;

// The moment a score is saved, the phone that saved it shows the whole game: the score, the odds
// going in, and what it did to all four players' ratings, tiers and ladder places. One phone gets passed round the
// net, so it's everyone's result, not just yours. (Each player's own story still pops up on their
// own phone, unless they're the one holding this one.)

type Shown = Result & { viewer: string | null };

/** Show the result of a game this phone just scored. */
export const showResult = (gameId: string) => { try { window.dispatchEvent(new CustomEvent("cards:result", { detail: gameId })); } catch {} };

export function GameResult() {
  const [r, setR] = useState<Shown | null>(null);
  useEffect(() => {
    const on = async (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      holdMoments(true);
      const res = await resultOf(id).catch(() => null);
      if (res) setR(res);
      else { holdMoments(false); pingMoments(); } // couldn't load it: fall back to your own story
    };
    window.addEventListener("cards:result", on);
    return () => window.removeEventListener("cards:result", on);
  }, []);
  if (!r) return null;
  const close = () => {
    const mine = r.lines.some((p) => p.id === r.viewer);
    setR(null);
    holdMoments(false);
    // You've just seen your line here, so your own story doesn't pop up for this game as well.
    if (mine) seenMoments(r.updatedAt).catch(() => {}).finally(pingMoments);
    else pingMoments();
  };
  return <Screen r={r} onClose={close} />;
}

function Screen({ r, onClose }: { r: Shown; onClose: () => void }) {
  const aWon = r.scoreA > r.scoreB;
  const winChance = r.chanceA == null ? null : aWon ? r.chanceA : 1 - r.chanceA;
  const upset = winChance != null && winChance < UPSET_BELOW;
  const viewerWon = r.lines.some((p) => p.id === r.viewer && p.won);
  const name = (id: string) => r.names[id]?.name ?? "?";
  const order = [...r.lines].sort((x, y) => Number(y.won) - Number(x.won));

  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);

  const team = (ids: string[], score: number, won: boolean, right: boolean) => (
    <div className={`flex min-w-0 flex-1 flex-col ${right ? "items-end text-right" : ""}`}>
      <div className={`w-full truncate text-[13px] font-bold ${won ? "text-fg" : "text-white/45"}`}>{ids.map(name).join(" & ")}</div>
      <div className={`tnum font-mono text-[68px] font-black leading-[.95] tracking-[-.05em] ${won ? "text-fg" : "text-white/30"}`}><CountUp to={score} /></div>
    </div>
  );

  return (
    <div role="dialog" aria-modal="true" aria-label="Game result" className="fixed inset-0 z-[70] mx-auto flex max-w-[480px] flex-col bg-[#0c0e10] text-fg">
      <div className={`absolute inset-0 bg-gradient-to-b ${upset ? "from-[#2a2208]" : "from-[#16200e]"} to-[#0c0e10]`} />
      {(upset || viewerWon) && <Confetti />}

      <div className="relative z-10 flex items-center justify-between gap-3 px-4 pt-[calc(14px+env(safe-area-inset-top))]">
        <div className="flex min-w-0 items-center gap-2">
          <span className="spk-crown flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-[11px] font-black uppercase tracking-[.12em] text-ink">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5 10 17 19 7" /></svg>
            Logged
          </span>
          <span className="truncate text-[12px] font-bold uppercase tracking-[.14em] text-white/45">{r.eventTitle} · {r.label}</span>
        </div>
        <button onClick={onClose} className="spk-press -mr-2 p-2 text-white/70" aria-label="Close">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col justify-center gap-6 overflow-y-auto px-5 py-4">
        <div className="spk-rise">
          <div className="flex items-end gap-3">
            {team(r.a, r.scoreA, aWon, false)}
            <span className="pb-3 text-[12px] font-black uppercase tracking-[.2em] text-white/30">vs</span>
            {team(r.b, r.scoreB, !aWon, true)}
          </div>
          {r.chanceA != null && <Odds chanceA={r.chanceA} aWon={aWon} upset={upset} />}
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {order.map((p, i) => <PlayerCard key={p.id} p={p} r={r} delay={300 + i * 140} you={p.id === r.viewer} />)}
        </div>
      </div>

      <div className="relative z-10 px-5 pb-[calc(20px+env(safe-area-inset-bottom))]">
        <button onClick={onClose} className="spk-press h-14 w-full rounded-2xl bg-accent text-[16px] font-black text-ink">Next game</button>
      </div>
    </div>
  );
}

/** The odds going in as a split bar, and "Upset!" when the side with the smaller share won. */
function Odds({ chanceA, aWon, upset }: { chanceA: number; aWon: boolean; upset: boolean }) {
  const a = Math.round(chanceA * 100);
  const [w, setW] = useState(50);
  useEffect(() => { const t = setTimeout(() => setW(a), 200); return () => clearTimeout(t); }, [a]);
  return (
    <div className="spk-rise mt-4" style={{ animationDelay: "140ms" }}>
      <div className="mb-1.5 flex items-center justify-between text-[12px] font-bold">
        <span className={aWon ? "text-fg" : "text-white/45"}>{a}%</span>
        <span className="text-[10.5px] uppercase tracking-[.16em] text-white/40">Chance going in</span>
        <span className={!aWon ? "text-fg" : "text-white/45"}>{100 - a}%</span>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full transition-[width] duration-700 ease-out" style={{ width: `${w}%`, background: aWon ? "#CBFB4F" : "rgba(255,255,255,.25)" }} />
        <div className="h-full flex-1" style={{ background: !aWon ? "#CBFB4F" : "rgba(255,255,255,.08)" }} />
      </div>
      {upset && (
        <div className="mt-3 flex items-center gap-2.5">
          <span className="spk-stamp rounded-lg bg-gold px-2.5 py-1 text-[15px] font-black uppercase tracking-[.08em] text-ink" style={{ animationDelay: "500ms" }}>Upset!</span>
          <span className="text-[13px] font-semibold text-white/65">They had a {aWon ? a : 100 - a}% chance and won anyway.</span>
        </div>
      )}
    </div>
  );
}

function PlayerCard({ p, r, delay, you }: { p: ResultLine; r: Shown; delay: number; you: boolean }) {
  const placed = p.placingGame === PROV_N; // this game placed them: the number's revealed
  const hidden = p.placingGame != null && !placed;
  const up = !hidden && !placed && p.tier.level.level > p.tierBefore.level;
  const down = !hidden && !placed && p.tier.level.level < p.tierBefore.level;
  const moved = p.rankBefore != null && p.rankAfter != null ? p.rankBefore - p.rankAfter : 0;
  const c = p.tier.level.color === "#8A9196" ? "#CBFB4F" : p.tier.level.color;
  // The bar fills from where they were before this game.
  const [w, setW] = useState(hidden ? (p.placingGame! - 1) / PROV_N : p.tier.progress);
  useEffect(() => { const t = setTimeout(() => setW(p.tier.progress), delay + 300); return () => clearTimeout(t); }, [p.tier.progress, delay]);
  return (
    <div className="spk-rise flex flex-col gap-2.5 rounded-2xl p-3" style={{ animationDelay: `${delay}ms`, background: p.won ? "rgba(203,251,79,.08)" : "rgba(255,255,255,.04)", border: `1px solid ${p.won ? "rgba(203,251,79,.25)" : "rgba(255,255,255,.06)"}` }}>
      <div className="flex min-w-0 items-center gap-2">
        <Avatar p={r.names[p.id]} size={30} />
        <span className="min-w-0 flex-1 truncate text-[14px] font-black">{r.names[p.id]?.name ?? "?"}{you && <span className="font-bold text-white/45"> (you)</span>}</span>
      </div>
      {hidden ? (
        <div className="flex items-baseline justify-between gap-2">
          <span className={`text-[22px] font-black leading-none ${p.won ? "text-accent" : "text-white/70"}`}>{p.won ? "Win" : "Loss"}</span>
          <span className="text-[11px] font-bold uppercase tracking-[.1em] text-white/40">Placing</span>
        </div>
      ) : (
        <div className="flex items-baseline justify-between gap-2">
          <span className={`tnum text-[28px] font-black leading-none ${p.delta >= 0 ? "text-accent" : "text-white/70"}`}>{p.delta >= 0 ? "+" : "−"}<CountUp to={Math.abs(p.delta)} /></span>
          <span className="tnum text-[13px] font-bold text-white/55"><CountUp to={p.after} /></span>
        </div>
      )}
      <div>
        <div className="mb-1 flex items-center justify-between gap-1 text-[11.5px] font-bold">
          <span className="flex min-w-0 items-center gap-1 truncate"><span aria-hidden="true">{p.tier.level.icon}</span><span className="truncate">{hidden ? `Game ${p.placingGame} of ${PROV_N}` : p.tier.level.name}</span></span>
          {placed ? <span className="spk-stamp shrink-0 rounded-md px-1.5 py-px text-[10.5px] font-black text-ink" style={{ background: c, animationDelay: `${delay + 500}ms` }}>PLACED</span>
            : up ? <span className="spk-stamp shrink-0 rounded-md px-1.5 py-px text-[10.5px] font-black text-ink" style={{ background: c, animationDelay: `${delay + 500}ms` }}>▲ TIER</span>
            : down ? <span className="shrink-0 rounded-md bg-white/15 px-1.5 py-px text-[10.5px] font-black">▼ TIER</span>
            : moved ? <span className={`shrink-0 text-[11px] font-black ${moved > 0 ? "text-win" : "text-loss"}`}>{moved > 0 ? "▲" : "▼"}{Math.abs(moved)} · #{p.rankAfter}</span>
            : p.rankAfter ? <span className="shrink-0 text-white/40">#{p.rankAfter}</span> : null}
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${Math.max(3, w * 100)}%`, background: !hidden && p.delta < 0 ? "#8A9196" : c }} />
        </div>
      </div>
    </div>
  );
}
