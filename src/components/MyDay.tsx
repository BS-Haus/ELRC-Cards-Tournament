"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "motion/react";
import { setMyEntry } from "@/app/actions";
import { useAction } from "@/components/useAction";
import { pingMoments } from "@/components/LevelMoments";
import { Shuffle } from "@/components/DrawSlides";
import { ScoreSheet } from "@/components/ScoreSheet";
import { EventPhotos } from "@/components/EventPhotos";
import { Disclosure } from "@/components/kit";
import { card } from "@/components/ui";
import { drawPool, DECIDER_TO, type Game, type StageKind } from "@/lib/cards";
import { groupsOf, myDay, myCheckIn, type MyGame } from "@/lib/views";
import type { EventView } from "@/lib/data";
import { PROV_N } from "@/lib/standings";

// Your day at today's tournament, on the Me tab, just under your rating: how the day's gone (your
// games, tap one for its result), then your check-in folded into one line. The tournament page is
// the shared screen (every net, every table), so it has no tabs of its own.

/** Tell the bottom nav whether your game is on now (a dot on Tournament). Kept as well as sent,
 *  since the page can say so before the nav is listening. */
let turnNow = false;
export const myTurnNow = () => turnNow;
export const signalMyTurn = (on: boolean) => { turnNow = on; try { window.dispatchEvent(new CustomEvent("cards:myturn", { detail: on })); } catch {} };

export const ordinal = (n: number) => `${n}${["th", "st", "nd", "rd"][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10 < 4 ? n % 10 : 0]}`;

/** `xp`: your rating either side of this weekend so far (src/lib/standings.ts). `veiled`: the newest
 *  stage is drawn but you haven't watched its draw story, so where you are in it stays hidden. */
export function MyDay({ view, me, org, xp, veiled }: {
  view: EventView; me: string; org: boolean; xp: { before: number; after: number; games: number } | null; veiled: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const { event: ev, entries, games, people } = view;
  const live = ev.status === "live";

  // Live: keep in step with the nets, and catch up once a new draw's story has been watched.
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
  const stage = view.stages.at(-1);
  const groups = stage ? groupsOf(view, stage.no) : [];
  const name = (id: string) => people[id]?.name ?? "Someone";
  const toFor = (g: Game) => (g.decider ? DECIDER_TO : g.kind === "final" ? ev.finalTo : ev.groupTo);
  const myGroup = groups.find((g) => g.table.some((r) => r.id === me));
  const place = myGroup ? myGroup.table.findIndex((r) => r.id === me) + 1 : 0;
  const moved = xp ? xp.after - xp.before : 0;
  const pd = day.line.pf - day.line.pa;
  const openGame = games.find((g) => g.id === open) ?? null;

  return (
    <>
      {day.played.length > 0 && (
        <div className={`${card} overflow-hidden`}>
          <div className="flex items-baseline justify-between gap-3 px-4 pt-3">
            <span className="text-[12px] font-bold uppercase tracking-[.12em] text-muted">Today</span>
            {!veiled && myGroup && place > 0 && <span className="text-[12px] text-dim">{ordinal(place)} in {myGroup.kind === "final" ? `the ${myGroup.name} final` : `Group ${myGroup.name}`}</span>}
          </div>
          <div className="grid grid-cols-3 text-center">
            {([[`${day.line.w}–${day.line.l}`, "won–lost"], [`${pd > 0 ? "+" : ""}${pd}`, "points +/−"], xp && xp.games < PROV_N ? [`${xp.games}/${PROV_N}`, "placing"] : [xp ? `${moved >= 0 ? "+" : "−"}${Math.abs(moved)}` : "–", "rating today"]] as const).map(([v, l]) => (
              <div key={l} className="py-2.5">
                <div className="tnum text-[20px] font-black">{v}</div>
                <div className="text-[10.5px] font-bold uppercase tracking-[.1em] text-dim">{l}</div>
              </div>
            ))}
          </div>
          {day.played.map((x) => <MyGameRow key={x.game.id} x={x} name={name} onOpen={setOpen} />)}
        </div>
      )}

      <CheckInRow view={view} me={me} org={org} />

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

/** Your check-in, folded into one line ("Saturday cards · Checked in"). Open it to leave (or come
 *  back), add photos, or go to the tournament. */
function CheckInRow({ view, me, org }: { view: EventView; me: string; org: boolean }) {
  const { run, pending, toast } = useAction();
  const ev = view.event;
  const state = myCheckIn(view.entries, view.games, me);
  const here = state === "here";
  const set = (s: "here" | "out", msg: string) => run(() => setMyEntry(ev.id, s), msg);
  return (
    <>
      {toast}
      <Disclosure
        title={<span className="flex items-center gap-2">{ev.status === "live" && <span className="spk-ping h-2 w-2 shrink-0 rounded-full bg-accent" aria-hidden="true" />}<span className="truncate">{ev.title}</span></span>}
        teaser={<span className={here ? "text-accent" : state === "out" ? "text-loss" : ""}>{here ? "Checked in" : state === "out" ? "Left" : "Not checked in"}</span>}
      >
        <div className="grid grid-cols-2 gap-1 rounded-xl border border-white/[.06] bg-panel p-1" role="radiogroup" aria-label="Your check-in">
          <button role="radio" aria-checked={here} disabled={pending || here} onClick={() => set("here", "Checked in. You'll join the next stage")} className={`spk-press flex h-10 items-center justify-center gap-1.5 rounded-lg text-[14px] font-black ${here ? "bg-accent text-ink" : "text-muted"}`}>
            {here && <span aria-hidden="true">✓</span>}{here ? "Checked in" : "I'm here"}
          </button>
          <button role="radio" aria-checked={state === "out"} disabled={pending || state === "out"} onClick={() => set("out", "Marked as left. Your remaining games will get a sub")} className={`spk-press h-10 rounded-lg text-[14px] font-black ${state === "out" ? "bg-loss/20 text-loss" : "text-muted"}`}>
            {state === "out" ? "Left" : "I have to leave"}
          </button>
        </div>
        <div className="mt-3.5">
          <EventPhotos bare eventId={ev.id} photos={view.photos} me={me} org={org} />
        </div>
        <Link href={`/e/${ev.id}`} className="spk-press mt-3 block text-[13px] font-bold text-accent">Go to the tournament →</Link>
      </Disclosure>
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
