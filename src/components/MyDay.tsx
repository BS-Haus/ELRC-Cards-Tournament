"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "motion/react";
import { pingMoments } from "@/components/LevelMoments";
import { Shuffle } from "@/components/DrawSlides";
import { ScoreSheet } from "@/components/ScoreSheet";
import { Court } from "@/components/Nets";
import { Section, card } from "@/components/ui";
import { drawPool, DECIDER_TO, type Game, type StageKind } from "@/lib/cards";
import { groupsOf, myDay, myCheckIn, type MyGame } from "@/lib/views";
import type { EventView } from "@/lib/data";
import { PROV_N } from "@/lib/standings";

// Your day at today's tournament, on the Me tab: your next game (tap to score it), the ones after,
// then how the day's gone. The tournament page is the shared screen (every net, every table); this
// is the personal one, so the event page has no tabs of its own.

/** Tell the bottom nav whether your game is on now (the dot on Me). Kept as well as sent, since
 *  the page can say so before the nav is listening. */
let turnNow = false;
export const myTurnNow = () => turnNow;
export const signalMyTurn = (on: boolean) => { turnNow = on; try { window.dispatchEvent(new CustomEvent("cards:myturn", { detail: on })); } catch {} };

export const ordinal = (n: number) => `${n}${["th", "st", "nd", "rd"][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10 < 4 ? n % 10 : 0]}`;

/** `xp`: your rating either side of this weekend so far (src/lib/standings.ts). `veiled`: the newest
 *  stage is drawn but you haven't watched its draw story, so your next game stays hidden.
 *  `children` (your check-in and photos) sits between what's next and what's been. */
export function MyDay({ view, me, org, xp, veiled, children }: {
  view: EventView; me: string; org: boolean; xp: { before: number; after: number; games: number } | null; veiled: boolean; children?: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const { event: ev, entries, games, people } = view;
  const live = ev.status === "live";

  // Live: keep in step with the nets, and reveal a new draw once its story's been watched.
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => { if (!document.hidden && !open) router.refresh(); }, 5000);
    return () => clearInterval(t);
  }, [live, open, router]);
  useEffect(() => {
    if (!veiled) return;
    const reveal = () => router.refresh();
    window.addEventListener("cards:drawseen", reveal);
    return () => window.removeEventListener("cards:drawseen", reveal);
  }, [veiled, router]);

  const day = useMemo(() => myDay(games, ev.nets, me), [games, ev.nets, me]);
  const myTurn = live && !veiled && day.next[0]?.ahead === 0;
  useEffect(() => { signalMyTurn(myTurn); return () => signalMyTurn(false); }, [myTurn]);

  const here = drawPool(entries, games);
  const out = new Set(entries.filter((e) => e.state === "out").map((e) => e.playerId));
  const state = myCheckIn(entries, games, me);
  const stage = view.stages.at(-1);
  const groups = stage ? groupsOf(view, stage.no) : [];
  const waiting = live && here.includes(me) && !groups.some((g) => g.games.some((x) => [...x.a, ...x.b].includes(me)));
  const name = (id: string) => people[id]?.name ?? "Someone";
  const both = (ids: string[]) => ids.map(name).join(" & ");
  const toFor = (g: Game) => (g.decider ? DECIDER_TO : g.kind === "final" ? ev.finalTo : ev.groupTo);
  const [first, ...later] = day.next;
  const myGroup = groups.find((g) => g.table.some((r) => r.id === me));
  const place = myGroup ? myGroup.table.findIndex((r) => r.id === me) + 1 : 0;
  const moved = xp ? xp.after - xp.before : 0;
  const pd = day.line.pf - day.line.pa;
  const openGame = games.find((g) => g.id === open) ?? null;

  return (
    <>
      {veiled && <DrawVeil kind={stage?.kind} />}

      {live && !veiled && stage && (
        <Section title="Up next" aside={<Link href={`/e/${ev.id}`} className="font-bold text-accent">All nets →</Link>}>
          {first ? (
            <div className="grid gap-2">
              {/* The same court as the tournament page's nets, your pair on the left. */}
              <Court
                title={`Net ${first.net}`} tag={first.ahead === 0 ? "You're on now" : first.ahead === 1 ? "You're next" : `${first.ahead} games before yours`}
                a={[me, first.partner]} b={first.opponents} scoreA={null} scoreB={null} people={people}
                live={first.ahead === 0} highlight={first.ahead === 0}
                note={first.sub ? "You're subbing in this one: it doesn't count for you." : undefined}
                onTap={() => setOpen(first.game.id)}
              />
              {later.length > 0 && (
                <div className={`${card} divide-y divide-white/[.04]`}>
                  {later.map((x) => (
                    <div key={x.game.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[13.5px]">
                      <span className="min-w-0 truncate">With <b>{name(x.partner)}</b> <span className="text-muted">vs {both(x.opponents)}</span></span>
                      <span className="shrink-0 text-[12px] text-dim">Net {x.net}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className={`${card} p-4 text-[14px] text-muted`}>
              {waiting ? "You're in for the next stage. It starts when the organiser draws it." : state === "out" ? "You're marked as left. Back? Check in below." : day.played.length ? "No more games for you in this stage." : "Nothing on for you yet. Check in below and you'll be in the next stage."}
            </div>
          )}
        </Section>
      )}

      {children}

      {day.played.length > 0 && (
        <Section title="Your games today" aside={!veiled && myGroup && place ? `${ordinal(place)} in ${myGroup.kind === "final" ? `the ${myGroup.name} final` : `Group ${myGroup.name}`}` : undefined}>
          <div className={`${card} overflow-hidden`}>
            <div className="grid grid-cols-3 text-center">
              {([[`${day.line.w}–${day.line.l}`, "won–lost"], [`${pd > 0 ? "+" : ""}${pd}`, "points +/−"], xp && xp.games < PROV_N ? [`${xp.games}/${PROV_N}`, "placing"] : [xp ? `${moved >= 0 ? "+" : "−"}${Math.abs(moved)}` : "–", "rating today"]] as const).map(([v, l]) => (
                <div key={l} className="py-3">
                  <div className="tnum text-[20px] font-black">{v}</div>
                  <div className="text-[10.5px] font-bold uppercase tracking-[.1em] text-dim">{l}</div>
                </div>
              ))}
            </div>
            {day.played.map((x) => <MyGameRow key={x.game.id} x={x} name={name} onOpen={setOpen} />)}
          </div>
        </Section>
      )}

      {openGame && (
        <ScoreSheet
          game={openGame} people={people} to={toFor(openGame)} canScore org={org}
          candidates={here.filter((id) => ![...openGame.a, ...openGame.b].includes(id) && !out.has(id))} out={out}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}

function MyGameRow({ x, name, onOpen }: { x: MyGame; name: (id: string) => string; onOpen: (id: string) => void }) {
  return (
    <button onClick={() => onOpen(x.game.id)} className="spk-press flex w-full items-center gap-3 border-t border-white/[.04] px-4 py-2.5 text-left">
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-black ${x.won ? "bg-win/15 text-win" : "bg-loss/15 text-loss"}`}>{x.won ? "W" : "L"}</span>
      <span className="min-w-0 flex-1 truncate text-[13.5px]">
        With <b>{name(x.partner)}</b> <span className="text-muted">vs {x.opponents.map(name).join(" & ")}</span>
        {(x.sub || x.game.decider) && <span className="ml-1.5 text-[10.5px] font-bold uppercase tracking-[.08em] text-dim">{x.sub ? "sub" : "decider"}</span>}
      </span>
      <span className="tnum shrink-0 font-mono text-[13px] font-bold">{x.score![0]}–{x.score![1]}</span>
    </button>
  );
}

/** In place of a stage you haven't seen drawn yet: the draw story is how you find out your group,
 *  your net and your first game. Tapping it plays the story. */
export function DrawVeil({ kind }: { kind?: StageKind }) {
  const what = kind === "final" ? "finals" : "groups";
  return (
    <div className="px-4 pb-6">
      <motion.button
        onClick={pingMoments} whileTap={{ scale: 0.98 }}
        className="relative flex w-full flex-col items-center gap-3 overflow-hidden rounded-[18px] border border-accent/30 bg-accent/[.06] px-5 py-8 text-center"
      >
        <Shuffle n={10} compact />
        <span className="text-[19px] font-black">The {what} are drawn</span>
        <span className="max-w-[30ch] text-[13.5px] text-muted">Watch the draw to find out your {kind === "final" ? "final" : "group"}, your net and your first game.</span>
        <span className="mt-1 rounded-full bg-accent px-5 py-2.5 text-[14px] font-extrabold text-ink">Watch the draw</span>
      </motion.button>
    </div>
  );
}
