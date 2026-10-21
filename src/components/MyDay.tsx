"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { setMyEntry } from "@/app/actions";
import { useAction } from "@/components/useAction";
import { pingMoments } from "@/components/LevelMoments";
import { Shuffle } from "@/components/DrawSlides";
import { ScoreSheet } from "@/components/ScoreSheet";
import { EventPhotos } from "@/components/EventPhotos";
import { card } from "@/components/ui";
import { drawPool, DECIDER_TO, finalLabel, type Game, type StageKind } from "@/lib/cards";
import { groupsOf, myDay, myCheckIn, type MyGame } from "@/lib/views";
import type { EventView } from "@/lib/data";
import { PROV_N } from "@/lib/standings";

// Your day at today's tournament, on the Me tab, under your rating: a small Today card (the day in
// three numbers, your check-in folded underneath), then your results (tap a game for its result). The tournament page is the shared screen (every net, every table), so it has no
// tabs of its own.

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
      {/* Today: the day in three numbers, and your check-in folded underneath. */}
      <div className={`${card} overflow-hidden`}>
        {day.played.length > 0 && (
          <div className="flex items-center gap-3 px-4 py-3">
            <span className="shrink-0 spk-label text-muted">Today</span>
            <span className="flex min-w-0 flex-1 items-baseline justify-end gap-4 tnum">
              {([[`${day.line.w}–${day.line.l}`, "W–L"], [`${pd > 0 ? "+" : ""}${pd}`, "pts"], xp && xp.games < PROV_N ? [`${xp.games}/${PROV_N}`, "placing"] : [xp ? `${moved >= 0 ? "+" : "−"}${Math.abs(moved)}` : "–", "rating"]] as const).map(([v, l]) => (
                <span key={l} className="whitespace-nowrap"><b className="text-[16px] font-black">{v}</b> <span className="spk-label text-dim">{l}</span></span>
              ))}
            </span>
          </div>
        )}
        <CheckInRow view={view} me={me} org={org} divided={day.played.length > 0} />
      </div>

      {day.played.length > 0 && (
        <div className={`${card} overflow-hidden`}>
          <div className="flex items-baseline justify-between gap-3 px-4 pt-3 pb-1">
            <span className="spk-label text-muted">Your results</span>
            {!veiled && myGroup && place > 0 && <span className="text-[12px] text-dim">{ordinal(place)} in {myGroup.kind === "final" ? `the ${finalLabel(myGroup.name)} final` : `Group ${myGroup.name}`}</span>}
          </div>
          {day.played.map((x) => <MyGameRow key={x.game.id} x={x} name={name} onOpen={setOpen} />)}
        </div>
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

/** Your check-in, one line inside the Today card ("● Saturday cards · Checked in ›"). Open it to
 *  leave (or come back), add photos, or go to the tournament. */
function CheckInRow({ view, me, org, divided }: { view: EventView; me: string; org: boolean; divided: boolean }) {
  const { run, pending, toast } = useAction();
  const [open, setOpen] = useState(false);
  const ev = view.event;
  const state = myCheckIn(view.entries, view.games, me);
  const here = state === "here";
  const set = (s: "here" | "out", msg: string) => run(() => setMyEntry(ev.id, s), msg);
  return (
    <div className={divided ? "border-t border-white/[.05]" : ""}>
      {toast}
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="spk-press flex w-full items-center gap-2.5 px-4 py-3 text-left">
        {ev.status === "live" && <span className="spk-ping h-2 w-2 shrink-0 rounded-full bg-accent" aria-hidden="true" />}
        <span className="min-w-0 flex-1 truncate text-[13.5px] font-bold">{ev.title}</span>
        <span className={`shrink-0 text-[12.5px] font-bold ${here ? "text-win" : state === "out" ? "text-loss" : "text-dim"}`}>{here ? "Checked in" : state === "out" ? "Left" : "Not checked in"}</span>
        <motion.span animate={{ rotate: open ? 90 : 0 }} className="flex shrink-0 text-dimmer">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-4 pb-4">
              <div className="grid grid-cols-2 gap-1 rounded-xl border border-white/[.06] bg-panel p-1" role="radiogroup" aria-label="Your check-in">
                <button role="radio" aria-checked={here} disabled={pending || here} onClick={() => set("here", "Checked in. You'll join the next stage")} className={`spk-press flex h-10 items-center justify-center gap-1.5 rounded-lg text-[14px] font-black ${here ? "bg-fg text-ink" : "text-muted"}`}>
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MyGameRow({ x, name, onOpen }: { x: MyGame; name: (id: string) => string; onOpen: (id: string) => void }) {
  return (
    <button onClick={() => onOpen(x.game.id)} className="spk-press flex w-full items-center gap-3 border-t border-white/[.04] px-4 py-2.5 text-left">
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-black ${x.won ? "bg-win/15 text-win" : "bg-loss/15 text-loss"}`}>{x.won ? "W" : "L"}</span>
      <span className="min-w-0 flex-1 truncate text-[13.5px]">
        With <b>{name(x.partner)}</b> <span className="text-muted">vs {x.opponents.map(name).join(" & ")}</span>
        {(x.sub || x.game.decider) && <span className="ml-1.5 spk-label text-dim">{x.sub ? "sub" : "decider"}</span>}
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
