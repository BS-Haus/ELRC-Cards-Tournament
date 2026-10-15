"use client";

import { useEffect, useState } from "react";
import { CountUp } from "@/components/StoryReel";
import { Avatar } from "@/components/ui";
import { PROV_N } from "@/lib/standings";
import type { PlayerLite } from "@/lib/data";
import type { Match, ResultLine } from "@/lib/moments";

// A game as everyone at the net saw it: the score, the odds going in, and what it did to all four
// players' ratings, tiers and ladder places. It's the first slide of every game's story (yours
// picked out, with your cheer), and all a scorer at the side sees.

/** A win the winners had less than this chance of is an upset (the same line the story cheers use). */
const UPSET_BELOW = 0.4;
export const isUpset = (m: Match) => (m.scoreA > m.scoreB ? m.chanceA : 1 - m.chanceA) < UPSET_BELOW;

export function MatchView({ match: m, names, title, you, cheer }: { match: Match; names: Record<string, PlayerLite>; title: string; you?: string; cheer?: string }) {
  const aWon = m.scoreA > m.scoreB;
  const name = (id: string) => (id === you ? "You" : names[id]?.name ?? "?");
  const order = [...m.lines].sort((x, y) => Number(y.won) - Number(x.won) || Number(y.id === you) - Number(x.id === you));
  const team = (ids: string[], score: number, won: boolean, right: boolean) => (
    <div className={`flex min-w-0 flex-1 flex-col ${right ? "items-end text-right" : ""}`}>
      <div className={`w-full truncate text-[13px] font-bold ${won ? "text-fg" : "text-white/45"}`}>{ids.map(name).join(" & ")}</div>
      <div className={`tnum font-mono text-[64px] font-black leading-[.95] tracking-[-.05em] ${won ? "text-fg" : "text-white/30"}`}><CountUp to={score} /></div>
    </div>
  );
  return (
    <div className="flex flex-1 flex-col justify-center gap-5 py-3">
      <div className="spk-rise truncate text-[12px] font-bold uppercase tracking-[.14em] text-white/45">{title}</div>
      <div className="spk-rise">
        <div className="flex items-end gap-3">
          {team(m.a, m.scoreA, aWon, false)}
          <span className="pb-3 text-[12px] font-black uppercase tracking-[.2em] text-white/30">vs</span>
          {team(m.b, m.scoreB, !aWon, true)}
        </div>
        <Odds chanceA={m.chanceA} aWon={aWon} upset={isUpset(m)} />
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {order.map((p, i) => <PlayerCard key={p.id} p={p} names={names} delay={300 + i * 140} you={p.id === you} />)}
      </div>
      {cheer && <p className="spk-rise text-[20px] font-black leading-snug" style={{ animationDelay: "900ms" }}>{cheer}</p>}
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

function PlayerCard({ p, names, delay, you }: { p: ResultLine; names: Record<string, PlayerLite>; delay: number; you: boolean }) {
  // While placing (this game included, even the one that places them) the number stays hidden:
  // the reveal is the "Placement complete" slide on their own story.
  const placed = p.placingGame === PROV_N;
  const hidden = p.placingGame != null;
  const up = !hidden && !placed && p.tier.level.level > p.tierBefore.level;
  const down = !hidden && !placed && p.tier.level.level < p.tierBefore.level;
  const moved = p.rankBefore != null && p.rankAfter != null ? p.rankBefore - p.rankAfter : 0;
  const c = p.tier.level.color === "#8A9196" ? "#CBFB4F" : p.tier.level.color;
  // The bar fills from where they were before this game.
  const [w, setW] = useState(hidden ? (p.placingGame! - 1) / PROV_N : p.tier.progress);
  const target = hidden ? p.placingGame! / PROV_N : p.tier.progress;
  useEffect(() => { const t = setTimeout(() => setW(target), delay + 300); return () => clearTimeout(t); }, [target, delay]);
  return (
    <div className="spk-rise flex flex-col gap-2.5 rounded-2xl p-3" style={{ animationDelay: `${delay}ms`, background: p.won ? "rgba(203,251,79,.08)" : "rgba(255,255,255,.04)", border: `${you ? 2 : 1}px solid ${you ? "rgba(244,245,246,.7)" : p.won ? "rgba(203,251,79,.25)" : "rgba(255,255,255,.06)"}` }}>
      <div className="flex min-w-0 items-center gap-2">
        <Avatar p={names[p.id]} size={30} />
        <span className="min-w-0 flex-1 truncate text-[14px] font-black">{you ? "You" : names[p.id]?.name ?? "?"}</span>
      </div>
      {hidden ? (
        <div className="flex items-baseline justify-between gap-2">
          <span className={`text-[22px] font-black leading-none ${p.won ? "text-accent" : "text-white/70"}`}>{p.won ? "Win" : "Loss"}</span>
          <span className="text-[11px] font-bold uppercase tracking-[.1em] text-white/40">{placed ? "Placed!" : "Placing"}</span>
        </div>
      ) : (
        <div className="flex items-baseline justify-between gap-2">
          <span className={`tnum text-[28px] font-black leading-none ${p.delta >= 0 ? "text-accent" : "text-white/70"}`}>{p.delta >= 0 ? "+" : "−"}<CountUp to={Math.abs(p.delta)} /></span>
          <span className="tnum text-[13px] font-bold text-white/55"><CountUp to={p.after} /></span>
        </div>
      )}
      <div>
        <div className="mb-1 flex items-center justify-between gap-1 text-[11.5px] font-bold">
          <span className="flex min-w-0 items-center gap-1 truncate"><span aria-hidden="true">{placed ? "🐣" : p.tier.level.icon}</span><span className="truncate">{hidden ? (placed ? "Rating revealed" : `Game ${p.placingGame} of ${PROV_N}`) : p.tier.level.name}</span></span>
          {placed ? <span className="spk-stamp shrink-0 rounded-md px-1.5 py-px text-[10.5px] font-black text-ink" style={{ background: c, animationDelay: `${delay + 500}ms` }}>PLACED</span>
            : up ? <span className="spk-stamp shrink-0 rounded-md px-1.5 py-px text-[10.5px] font-black text-ink" style={{ background: c, animationDelay: `${delay + 500}ms` }}>▲ TIER</span>
            : down ? <span className="shrink-0 rounded-md bg-white/15 px-1.5 py-px text-[10.5px] font-black">▼ TIER</span>
            : moved ? <span className={`shrink-0 text-[11px] font-black ${moved > 0 ? "text-win" : "text-loss"}`}>{moved > 0 ? "▲" : "▼"}{Math.abs(moved)} · #{p.rankAfter}</span>
            : p.rankAfter ? <span className="shrink-0 text-white/40">#{p.rankAfter}</span> : null}
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${Math.max(3, w * 100)}%`, background: hidden ? "#CBFB4F" : p.delta < 0 ? "#8A9196" : c }} />
        </div>
      </div>
    </div>
  );
}
