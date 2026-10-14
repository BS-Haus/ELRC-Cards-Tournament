"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar, card, tierColor } from "@/components/ui";
import { MySeason, ShowAll } from "@/components/MySeason";
import { Reel } from "@/components/LevelMoments";
import { replayGame } from "@/app/actions";
import type { Moments, Profile, ProfileGame, Season } from "@/lib/data";

const RECENT = 6;

/** Everything about one player, the same for you on Me and for anyone you tap in Players: at a
 *  glance, highlights three across, and their latest games (six, the rest a tap away). Each game
 *  shows the XP it earned or cost; tapping it replays its story. */
export function PlayerBody({ season, pr, mine = false }: { season: Season; pr: Pick<Profile, "player" | "tierWins" | "bestPartner" | "recent" | "names">; mine?: boolean }) {
  const [allGames, setAllGames] = useState(false);
  const [story, setStory] = useState<Moments | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const replay = async (g: ProfileGame) => {
    if (opening) return;
    setOpening(g.id);
    try { setStory(await replayGame(pr.player.id, g.id)); } catch {} finally { setOpening(null); }
  };
  const { names } = pr;
  const titles = Object.entries(pr.tierWins).sort(([x], [y]) => x.localeCompare(y));
  const bp = pr.bestPartner;
  return (
    <>
      <MySeason s={season} />

      {(titles.length > 0 || bp) && (
        <section className="px-4 pb-6">
          <h2 className="mb-2.5 px-1 text-[12px] font-bold uppercase tracking-[.12em] text-muted">Highlights</h2>
          <div className="grid grid-cols-3 gap-2">
            {titles.map(([t, n]) => (
              <div key={t} className="flex flex-col items-center gap-1 rounded-2xl p-3 text-center" style={{ background: `${tierColor(t)}14`, border: `1px solid ${tierColor(t)}40` }}>
                <span className="text-[20px] leading-none" style={{ color: tierColor(t) }} aria-hidden="true">★</span>
                <span className="tnum text-[18px] font-black leading-none">×{n}</span>
                <span className="text-[11px] font-bold leading-tight text-muted">{t === "A" ? "Champion" : `${t} final won`}</span>
              </div>
            ))}
            {bp && (
              <Link href={`/p/${bp.id}`} className={`${card} spk-press flex flex-col items-center gap-1 p-3 text-center`}>
                <Avatar p={names[bp.id]} size={26} />
                <span className="w-full truncate text-[13.5px] font-black leading-tight">{names[bp.id]?.name}</span>
                <span className="text-[11px] font-bold leading-tight text-muted">Best partner · {bp.w}/{bp.gp}</span>
              </Link>
            )}
          </div>
        </section>
      )}

      {pr.recent.length > 0 && (
        <section className="px-4 pb-6">
          <h2 className="mb-2.5 px-1 text-[12px] font-bold uppercase tracking-[.12em] text-muted">Recent games</h2>
          <div className={`${card} overflow-hidden`}>
            {(allGames ? pr.recent : pr.recent.slice(0, RECENT)).map((g) => {
              const body = (
                <>
                  <span className={`w-6 shrink-0 text-center text-[12px] font-black ${g.won ? "text-win" : "text-loss"}`}>{g.won ? "W" : "L"}</span>
                  <div className="min-w-0 flex-1 text-left text-[13.5px]">
                    <div className="truncate">with <b>{names[g.partner]?.name}</b> vs {g.opponents.map((o) => names[o]?.name).join(" & ")}</div>
                    <div className="truncate text-[12px] text-dim">
                      <span className="tnum font-mono font-bold text-fg/80">{g.mine}–{g.theirs}</span> · {g.label} · {g.eventTitle}{g.sub ? " · as a sub, not counted" : ""}
                    </div>
                  </div>
                  {g.xp != null && <XpChip xp={g.xp} busy={opening === g.id} />}
                </>
              );
              const row = "flex w-full items-center gap-3 border-b border-white/[.04] px-4 py-2.5 last:border-0";
              return g.xp != null ? (
                <button key={g.id} onClick={() => replay(g)} className={`spk-press ${row}`} aria-label={`Replay this game: ${g.xp >= 0 ? "+" : "−"}${Math.abs(g.xp)} XP`}>{body}</button>
              ) : (
                <div key={g.id} className={row}>{body}</div>
              );
            })}
            {pr.recent.length > RECENT && <ShowAll open={allGames} n={pr.recent.length - RECENT} what={pr.recent.length - RECENT === 1 ? "game" : "games"} onClick={() => setAllGames(!allGames)} />}
          </div>
        </section>
      )}

      {story && <Reel m={story} onClose={() => setStory(null)} title={mine ? "Replay" : `${story.me.name}'s game`} done="Done" />}
    </>
  );
}

/** A game's XP as a chip with a play mark: the hint that tapping it replays the story. */
function XpChip({ xp, busy }: { xp: number; busy: boolean }) {
  const up = xp >= 0;
  return (
    <span className={`tnum flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[12.5px] font-black ${up ? "bg-accent/15 text-accent" : "bg-white/[.07] text-fg/70"}`}>
      {up ? "+" : "−"}{Math.abs(xp)}
      <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden="true" className={busy ? "animate-pulse" : ""}><path d="M2 1.2v7.6L8.6 5z" fill="currentColor" /></svg>
    </span>
  );
}
