"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar, fmtDate, tierColor } from "@/components/ui";
import { Climb } from "@/components/Climb";
import { AnimatedNumber, Disclosure, FormDots, ResultCard, Sparkline, StatLine } from "@/components/kit";
import { Reel } from "@/components/LevelMoments";
import { replayGame } from "@/app/actions";
import { tierFor } from "@/lib/levels";
import { PROV_N } from "@/lib/standings";
import type { Moments, Profile, ProfileGame, Season } from "@/lib/data";

const ordinal = (n: number) => `${n}${["th", "st", "nd", "rd"][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10 < 4 ? n % 10 : 0]}`;
const signed = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n)}`;
const day = (ms: number) => fmtDate(ms, false).split(" ").slice(1).join(" ");

type Pr = Pick<Profile, "player" | "tierWins" | "bestPartner" | "recent" | "names" | "form" | "trail" | "biggestWin" | "bestRun">;

/**
 * Everything about one player, the same for you on Me and for anyone you tap in Players, laid out
 * like a profile in the ranked app: one hero card (rating, tier, place, form) and then a stack of
 * folded rows, each with a teaser, so the page says plenty at a glance and the detail is a tap
 * away. Each game shows what it did to the rating; tapping it replays its story.
 */
/** `today` sits right under the rating card: on Me during a tournament, your day (src/components/MyDay). */
export function PlayerBody({ season: s, pr, mine = false, today }: { season: Season; pr: Pr; mine?: boolean; today?: React.ReactNode }) {
  const [story, setStory] = useState<Moments | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const replay = async (g: ProfileGame) => {
    if (opening) return;
    setOpening(g.id);
    try { setStory(await replayGame(pr.player.id, g.id)); } catch {} finally { setOpening(null); }
  };
  const { names, player } = pr;
  const lv = tierFor(s);
  const played = s.events.filter((e) => e.w + e.l > 0);
  const last = played.find((e) => e.change != null);
  const { stats } = s;
  const pd = stats.pf - stats.pa;
  const titles = Object.entries(pr.tierWins).sort(([x], [y]) => x.localeCompare(y));
  const bp = pr.bestPartner;
  const them = mine ? "you" : player.name;

  if (!stats.gp) {
    return (
      <section className="px-4 pb-6">
        <div className="rounded-[18px] border border-white/[.06] bg-surface px-5 py-10 text-center">
          <div className="text-[15px] font-bold text-num">No games yet</div>
          <div className="mt-1 text-[13px] text-dim">{mine ? "Play your first weekend and your climb starts here." : `${player.name}'s climb starts with their first weekend.`}</div>
        </div>
        {today && <div className="mt-2.5 flex flex-col gap-2">{today}</div>}
      </section>
    );
  }

  return (
    <section className="px-4 pb-6">
      {/* HERO: the one number, where it puts them, and how they're going. */}
      <div className="mb-2.5 rounded-[18px] border border-white/[.08] bg-surface px-4 pt-4 pb-3.5">
        <div className="flex items-end justify-between gap-3">
          {lv.placing ? (
            <div>
              <div className="font-mono text-[44px] font-extrabold leading-none text-fg">{s.games}<span className="text-[24px] text-dim">/{PROV_N}</span></div>
              <div className="mt-1.5 spk-label text-dimmer">Placement games · 🐣 Fresh Meat</div>
            </div>
          ) : (
            <div>
              <AnimatedNumber value={s.rating} className="block font-mono text-[44px] font-extrabold leading-none text-fg" />
              <div className="mt-1.5 spk-label text-dimmer">Rating{s.position > 0 ? ` · ${ordinal(s.position)} of ${s.of}` : ""}</div>
            </div>
          )}
          {last && (
            <div className="text-right">
              <div className={`font-mono text-[15px] font-extrabold ${last.change! > 0 ? "text-win" : last.change! < 0 ? "text-loss" : "text-dim"}`}>{signed(last.change!)}</div>
              <div className="mt-0.5 text-[10px] text-dimmer">{last.live ? "today" : "last weekend"}</div>
            </div>
          )}
        </div>
        {lv.placing ? (
          <div className="mt-3.5 flex gap-1">{Array.from({ length: PROV_N }, (_, i) => <span key={i} className={`h-1.5 flex-1 rounded-full ${i < s.games ? "bg-accent" : "bg-white/10"}`} />)}</div>
        ) : (
          <div className="mt-3.5 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full" style={{ width: `${lv.progress * 100}%`, background: lv.level.color }} />
          </div>
        )}
        <div className="mt-1.5 text-[11.5px] text-dim">{lv.placing ? `${lv.toNext} more ${lv.toNext === 1 ? "game" : "games"} and ${mine ? "your" : "the"} rating is revealed.` : <>{lv.level.icon} {lv.level.name}{lv.next ? ` · ${lv.toNext} to ${lv.next.icon} ${lv.next.name}` : " · the top tier"}</>}</div>
        <div className="mt-3 flex items-center gap-2.5 border-t border-white/[.07] pt-3">
          <FormDots form={pr.form} />
          <span className="font-mono text-[12.5px] text-muted">{stats.w}–{stats.l}</span>
          {pr.bestRun >= 3 && <span className="font-mono text-[12px] font-extrabold text-gold">best run {pr.bestRun}</span>}
          <span className="flex-1" />
          <Sparkline points={pr.trail} w={64} />
        </div>
      </div>

      {today && <div className="mb-2 flex flex-col gap-2">{today}</div>}

      {/* Everything else is opt-in. Teasers keep the page informative while it's closed. */}
      <div className="flex flex-col gap-2">
        {pr.trail.length > 0 && (
          <Disclosure title="Rating over time" teaser={`${signed(pr.trail.at(-1)! - pr.trail[0])} since placing`}>
            <Climb values={pr.trail} />
          </Disclosure>
        )}

        <Disclosure title="Weekends" teaser={last ? `${last.w}–${last.l} latest` : String(played.length)}>
          <div className="-mx-1">
            {played.map((e) => (
              <Link key={e.id} href={e.live ? `/e/${e.id}` : `/e/${e.id}/recap?p=${s.id}`} className="spk-press flex items-center gap-3 border-b border-white/[.04] px-1 py-2.5 last:border-0">
                <span className="w-12 shrink-0 text-[12px] font-bold text-dim">{day(e.startsAt)}</span>
                <span className="min-w-0 flex-1 truncate text-[13.5px]"><span className="tnum font-mono font-bold">{e.w}–{e.l}</span>{e.live ? <span className="text-accent"> · so far, live</span> : e.finish && <span className="text-muted"> · {e.finish}</span>}</span>
                <span className={`tnum shrink-0 font-mono text-[12.5px] font-bold ${e.change == null ? "text-dim" : e.change >= 0 ? "text-win" : "text-loss"}`}>{e.change == null ? "–" : signed(e.change)}</span>
                <span className="shrink-0 text-[11px] text-dim" aria-hidden="true">▶</span>
              </Link>
            ))}
          </div>
        </Disclosure>

        <Disclosure title="The numbers" teaser={`${Math.round((100 * stats.w) / stats.gp)}% win`}>
          <StatLine label="Won–lost" value={`${stats.w}–${stats.l}`} />
          <StatLine label="Win rate" value={`${Math.round((100 * stats.w) / stats.gp)}%`} />
          <StatLine label="Points for / against" value={`${stats.pf} / ${stats.pa}`} />
          <StatLine label="Point difference" value={signed(pd)} color={pd > 0 ? "#5CD37D" : pd < 0 ? "#FF6B6B" : undefined} />
          <StatLine label="Average game" value={`${(stats.pf / stats.gp).toFixed(1)}–${(stats.pa / stats.gp).toFixed(1)}`} />
          <StatLine label="Biggest win" value={pr.biggestWin ? `+${pr.biggestWin}` : "–"} color="#5CD37D" />
          <StatLine label="Longest winning run" value={pr.bestRun} color="#FFCF5C" />
          <StatLine label="Weekends played" value={stats.events} />
        </Disclosure>

        {(titles.length > 0 || bp) && (
          <Disclosure title="Titles & partners" teaser={titles.length ? `★ ${titles.reduce((n, [, k]) => n + k, 0)}` : names[bp!.id]?.name}>
            <div className="grid grid-cols-2 gap-2">
              {titles.map(([t, n]) => (
                <div key={t} className="rounded-[14px] p-3" style={{ background: `${tierColor(t)}14`, border: `1px solid ${tierColor(t)}40` }}>
                  <div className="text-[10px] font-bold tracking-[.05em]" style={{ color: tierColor(t) }}>{t === "A" ? "CHAMPION" : `${t} FINAL WON`}</div>
                  <div className="mt-1.5 flex items-center gap-1.5"><span className="text-[20px] leading-none" style={{ color: tierColor(t) }} aria-hidden="true">★</span><span className="font-mono text-[18px] font-black">×{n}</span></div>
                </div>
              ))}
              {bp && (
                <Link href={`/p/${bp.id}`} className="spk-press rounded-[14px] border border-win/20 bg-surface p-3">
                  <div className="text-[10px] font-bold tracking-[.05em] text-win">BEST PARTNER</div>
                  <div className="mt-2 flex items-center gap-2"><Avatar p={names[bp.id]} size={28} /><span className="truncate text-[14px] font-bold">{names[bp.id]?.name}</span></div>
                  <div className="mt-1.5 font-mono text-[11.5px] text-dim">{bp.w}–{bp.gp - bp.w} · {Math.round((100 * bp.w) / bp.gp)}% win</div>
                </Link>
              )}
            </div>
          </Disclosure>
        )}

        {pr.recent.length > 0 && (
          <Disclosure title="Games" teaser={pr.recent.length >= 30 ? "latest 30" : String(pr.recent.length)}>
            <div className="-mx-1.5 flex flex-col gap-1.5">
              {pr.recent.map((g) => (
                <ResultCard
                  key={g.id} a={[player.id, g.partner]} b={g.opponents} scoreA={g.mine} scoreB={g.theirs} people={{ ...names, [player.id]: names[player.id] ?? player }}
                  left={<>{day(g.at)}<br /><span className="text-dimmer">{g.sub ? "sub" : g.label.replace(/^Group /, "Grp ")}</span></>}
                  aside={g.xp != null || g.placing != null ? <XpChip xp={g.xp} placing={g.placing} busy={opening === g.id} /> : undefined}
                  onClick={g.xp != null || g.placing != null ? () => replay(g) : undefined}
                  label={g.xp != null ? `Replay this game: ${signed(g.xp)}` : g.placing != null ? `Replay placement game ${g.placing}` : undefined}
                />
              ))}
            </div>
            <p className="mt-2 text-[10.5px] text-dimmer">Tap a game to replay its story{mine ? "" : ` from ${them}'s side`}.</p>
          </Disclosure>
        )}
      </div>

      {story && <Reel m={story} onClose={() => setStory(null)} title={mine ? "Replay" : `${story.me.name}'s game`} done="Done" self={mine} />}
    </section>
  );
}

/** What a game did to the rating, as a chip with a play mark: the hint that tapping it replays
 *  the story. A placement game shows which one it was. */
function XpChip({ xp, placing, busy }: { xp: number | null; placing: number | null; busy: boolean }) {
  const up = xp == null || xp >= 0;
  return (
    <span className={`tnum flex shrink-0 items-center gap-1 rounded-full px-2 py-1 font-mono text-[12px] font-black ${xp == null ? "bg-white/[.07] text-fg/70" : up ? "bg-accent/15 text-accent" : "bg-white/[.07] text-fg/70"}`}>
      {xp == null ? `🐣 ${placing}/${PROV_N}` : signed(xp)}
      <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden="true" className={busy ? "animate-pulse" : ""}><path d="M2 1.2v7.6L8.6 5z" fill="currentColor" /></svg>
    </span>
  );
}
