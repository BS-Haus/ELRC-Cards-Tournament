"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { setEntry, addWalkIn, drawStage, undoStage, finishEvent, reopenEvent, deleteEvent, updateEvent, addDecider, swapPlayers, movePlayer, redrawStage } from "@/app/actions";
import { useAction } from "@/components/useAction";
import { pingMoments } from "@/components/LevelMoments";
import { Shuffle } from "@/components/DrawSlides";
import { ScoreSheet } from "@/components/ScoreSheet";
import { EventPhotos } from "@/components/EventPhotos";
import { CheckIn, LiveBadge } from "@/components/CheckIn";
import { ScoreBoxes } from "@/components/ScoreBoxes";
import { PodiumStand, FinalWinners } from "@/components/Podium";
import { Avatar, PlayerLink, Section, card, btnPrimary, btnGhost, btnQuiet, input, tierColor, fmtDate } from "@/components/ui";
import { netQueues, needsSub, splitSizes, stageMinutes, gamesEachForSize, isDone, drawPool, gameLabel, deciderPoints, DECIDER_TO, currentMembers, finalName, type Game, type StageKind, finalWinTitle } from "@/lib/cards";
import { groupsOf, finalsOf, myDay, myCheckIn, type GroupView, type MyDay, type MyGame } from "@/lib/views";
import type { EventView, PlayerLite, EntryState } from "@/lib/data";
import { Disclosure, AnimatedNumber, SOFT } from "@/components/kit";
import { motion, LayoutGroup } from "motion/react";
import { PROV_N } from "@/lib/standings";

const STAGE_TITLE: Record<StageKind, string> = { random: "Random groups", seeded: "Seeded groups", final: "Finals" };

/** `myXp`: your rating either side of this weekend so far, and your games in all (src/lib/standings.ts),
 *  loaded on the server. */
/** `drawPending`: you're in the newest stage but haven't watched its draw story yet, so its groups,
 *  nets and your next game stay hidden: the story is how you find out. */
export function EventScreen({ view, me, org, roster, myXp = null, drawPending = false }: { view: EventView; me: string | null; org: boolean; roster: PlayerLite[]; myXp?: { before: number; after: number; games: number } | null; drawPending?: boolean }) {
  const router = useRouter();
  const { run, pending, toast } = useAction();
  const [open, setOpen] = useState<string | null>(null); // game id in the score sheet
  const { event: ev, entries, stages, games, people } = view;

  // Live: keep every phone in step without anyone refreshing.
  useEffect(() => {
    if (ev.status !== "live") return;
    const t = setInterval(() => { if (!document.hidden && !open) router.refresh(); }, 5000);
    return () => clearInterval(t);
  }, [ev.status, open, router]);

  // Once the draw story's been watched (LevelMoments says so), fetch the page again to reveal it.
  useEffect(() => {
    if (!drawPending) return;
    const reveal = () => router.refresh();
    window.addEventListener("cards:drawseen", reveal);
    return () => window.removeEventListener("cards:drawseen", reveal);
  }, [drawPending, router]);

  const p = (id: string) => people[id];
  // Who's in the tournament right now: checked in, plus everyone from the last stage not marked
  // out (drawPool). The same list the next draw takes, so the page never disagrees with it.
  const here = useMemo(() => drawPool(entries, games), [entries, games]);
  const inPool = new Set(here);
  const myEntry = me ? myCheckIn(entries, games, me) : null;
  const out = new Set(entries.filter((e) => e.state === "out").map((e) => e.playerId));
  const current = stages.at(-1);
  const curGroups = current ? groupsOf(view, current.no) : [];
  const inCurrent = new Set(curGroups.flatMap((g) => g.games.flatMap((x) => [...x.a, ...x.b])));
  const waiting = here.filter((id) => !inCurrent.has(id));
  const queues = netQueues(games, ev.nets);
  const subAlerts = games.filter((g) => needsSub(g, out).length);
  const finals = finalsOf(view);

  // Crown each final's winner the moment it's decided, on every phone that's watching. Winners
  // already decided when the page opened don't pop up; only ones that arrive while you watch.
  const [crown, setCrown] = useState<{ tier: string; id: string } | null>(null);
  const crowned = useRef<Set<string> | null>(null);
  const winnersKey = (finals?.groups ?? []).filter((g) => g.winner).map((g) => `${finals!.stageNo}:${g.name}:${g.winner}`).join("|");
  useEffect(() => {
    const now = new Set(winnersKey ? winnersKey.split("|") : []);
    if (crowned.current) {
      const fresh = [...now].find((k) => !crowned.current!.has(k));
      if (fresh) {
        const [, tier, id] = fresh.split(":");
        setCrown({ tier, id });
        const t = setTimeout(() => setCrown(null), 6000);
        crowned.current = now;
        return () => clearTimeout(t);
      }
    }
    crowned.current = now;
  }, [winnersKey]);
  const iPlayed = !!me && games.some((g) => g.status === "done" && [...g.a, ...g.b].includes(me) && !g.subs.includes(me));
  const openGame = games.find((g) => g.id === open) ?? null;
  const toFor = (g: Game) => (g.decider ? DECIDER_TO : g.kind === "final" ? ev.finalTo : ev.groupTo);
  const live = ev.status === "live";
  const done = ev.status === "done";
  // Once groups are drawn the page has two jobs, so two tabs: the whole event (nets, tables,
  // results) and your own day (status, what's next for you, your games, photos). Before the
  // draw it's just sign-up, so no tabs. Players open it on their own day while it's live.
  const started = !!current || done;
  const takingPart = !!me && (inPool.has(me) || iPlayed);
  const [tab, setTab] = useState<"event" | "you">(live && takingPart ? "you" : "event");
  const mine = useMemo(() => (me ? myDay(games, ev.nets, me) : null), [games, ev.nets, me]);
  const myTurn = !!mine?.next.length && mine.next[0].ahead === 0;

  const share = async () => {
    const url = `${location.origin}/e/${ev.id}`;
    const text = `${ev.title}, ${fmtDate(ev.startsAt)}${ev.location ? ` at ${ev.location}` : ""}. Add yourself here:`;
    try {
      if (navigator.share) await navigator.share({ title: ev.title, text, url });
      else { await navigator.clipboard.writeText(`${text} ${url}`); run(async () => ({ ok: true }), "Link copied. Paste it in the WhatsApp group"); }
    } catch {}
  };

  return (
    <main>
      {toast}
      <header className="px-5 pt-[calc(14px+env(safe-area-inset-top))] pb-4">
        <div className="flex items-center justify-between">
          <Link href="/?all=1" className="spk-press text-[13px] font-bold text-muted">← All events</Link>
          <button onClick={share} className="spk-press rounded-full border border-white/[.08] bg-raised px-3.5 py-1.5 text-[13px] font-bold">Share link</button>
        </div>
        <div className="mt-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.14em]">
          {live ? <LiveBadge /> : done ? <span className="text-gold">Finished</span> : <span className="text-accent">Coming up</span>}
        </div>
        <h1 className="mt-1 text-[28px] font-black leading-[1.05] tracking-[-.02em] text-balance">{ev.title}</h1>
        <p className="mt-1.5 text-[14px] text-muted">{fmtDate(ev.startsAt)}{ev.location ? ` · ${ev.location}` : ""}</p>
        {ev.notes && <p className="mt-2 whitespace-pre-line text-[14px] leading-relaxed text-fg/80">{ev.notes}</p>}
      </header>

      {crown && (
        <button onClick={() => setCrown(null)} className="spk-crown fixed inset-x-4 top-[calc(16px+env(safe-area-inset-top))] z-40 mx-auto flex max-w-[448px] items-center gap-3 rounded-3xl p-4 text-left shadow-2xl" style={{ background: tierColor(crown.tier), color: "#0c0e10" }} aria-live="polite">
          <span className="text-[34px]" aria-hidden="true">🏆</span>
          <span className="min-w-0">
            <span className="block text-[12px] font-black uppercase tracking-[.16em] opacity-70">{crown.tier} final</span>
            <span className="block truncate text-[20px] font-black">{crown.id === me ? `You win the ${crown.tier} final!` : `${p(crown.id)?.name ?? "Someone"} wins the ${crown.tier} final!`}</span>
          </span>
        </button>
      )}

      {!started && (
        <>
          <CheckIn me={me} state={myEntry} eventId={ev.id} started={false} />
          <WhoIsIn view={view} />
          {org && <OrganiserPanel view={view} roster={roster} run={run} pending={pending} waiting={waiting} pool={inPool} />}
        </>
      )}

      {started && <Tabs tab={tab} setTab={setTab} done={done} nudge={myTurn} />}

      {started && tab === "event" && (
        <>
          {(done || finals?.groups.some((g) => g.winner)) && games.some(isDone) && (
            <div className="px-4 pb-5">
              <Link href={`/e/${ev.id}/recap`} className="spk-press flex items-center gap-3 rounded-2xl bg-gradient-to-r from-accent to-[#9be15d] p-4 text-ink">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink text-accent" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                </span>
                <span className="min-w-0">
                  <span className="block text-[17px] font-black">{done ? "Watch the tournament story" : "The story so far"}</span>
                  <span className="block text-[13px] font-semibold opacity-70">Who won, the stories of the day, records broken</span>
                </span>
              </Link>
            </div>
          )}

          {done && finals && <Podium groups={finals.groups} people={people} />}
          {/* On the day, photos are added from Me (the Today card); afterwards they live here. */}
          {done && <EventPhotos eventId={ev.id} photos={view.photos} me={me} org={org} />}

          {subAlerts.length > 0 && !done && (
            <Section title="Needs a sub">
              <div className="grid gap-2">
                {subAlerts.map((g) => (
                  <button key={g.id} onClick={() => setOpen(g.id)} className="spk-press flex items-center justify-between gap-3 rounded-2xl border border-loss/40 bg-loss/10 p-3.5 text-left">
                    <span className="text-[14px]"><b>{needsSub(g, out).map((id) => p(id)?.name).join(" & ")}</b> left. {gameLabel(g)}, game {g.seq} needs someone.</span>
                    <span className="shrink-0 text-[13px] font-bold text-loss">Sort it →</span>
                  </button>
                ))}
              </div>
            </Section>
          )}

          {drawPending && <DrawVeil kind={current?.kind} />}

          {!drawPending && live && queues.some((q) => q.length) && (
            <Section title="On the nets" aside="Tap the winners, slide the score">
              <div className="grid gap-2.5">
                {queues.map((q, i) => (
                  <NetCard key={i} net={i + 1} now={q[0]} next={q[1]} people={people} out={out} onOpen={setOpen} to={q[0] ? toFor(q[0]) : 0} canScore={!!me} />
                ))}
              </div>
            </Section>
          )}

          {current && !drawPending && (
            <Section title={`${current.kind === "final" ? "Finals" : `Stage ${current.no}`} · ${current.kind === "final" ? `to ${ev.finalTo}` : STAGE_TITLE[current.kind]}`}>
              <div className="grid gap-3">
                {curGroups.map((g) => <GroupCard key={g.groupNo} g={g} people={people} me={me} out={out} onOpen={setOpen} org={org && live} run={run} pending={pending} eventId={ev.id} />)}
              </div>
            </Section>
          )}

          {live && waiting.length > 0 && (
            <Section title="Joining next stage">
              <div className={`${card} p-4`}>
                <div className="flex flex-wrap gap-2">
                  {waiting.map((id) => <Chip key={id} p={p(id)} />)}
                </div>
                <p className="mt-3 text-[13px] leading-relaxed text-muted">Arrived after the draw. They go into the next stage, and can sub in for anyone who has to leave in the meantime.</p>
              </div>
            </Section>
          )}

          {org && !done && <OrganiserPanel view={view} roster={roster} run={run} pending={pending} waiting={waiting} pool={inPool} />}

          {stages.length > 1 && (
            <Section title="Earlier stages">
              <div className="grid gap-2">
                {stages.slice(0, -1).reverse().map((s) => (
                  <details key={s.id} className={`${card} group`}>
                    <summary className="flex cursor-pointer list-none items-center justify-between p-4 text-[15px] font-bold">
                      {s.kind === "final" ? "Finals" : `Stage ${s.no} · ${STAGE_TITLE[s.kind]}`}
                      <span className="text-muted transition group-open:rotate-90">›</span>
                    </summary>
                    <div className="grid gap-3 px-3 pb-3">
                      {groupsOf(view, s.no).map((g) => <GroupCard key={g.groupNo} g={g} people={people} me={me} out={out} onOpen={setOpen} org={org && live} run={run} pending={pending} eventId={ev.id} />)}
                    </div>
                  </details>
                ))}
              </div>
            </Section>
          )}

          {org && done && (
            <Section title="Organiser">
              <button disabled={pending} onClick={() => run(() => reopenEvent(ev.id), "Event reopened")} className={btnGhost}>Reopen event</button>
            </Section>
          )}

        </>
      )}

      {started && tab === "you" && (
        <YouTab
          view={view} me={me} state={myEntry} day={mine} iPlayed={iPlayed} waiting={!!me && waiting.includes(me)}
          groups={curGroups} live={live} done={done} org={org} run={run} pending={pending} onOpen={setOpen} xp={myXp} veiled={drawPending}
        />
      )}

      {openGame && (
        <ScoreSheet
          game={openGame} people={people} to={toFor(openGame)} canScore={!!me} org={org}
          candidates={here.filter((id) => ![...openGame.a, ...openGame.b].includes(id) && !out.has(id))} out={out}
          onClose={() => setOpen(null)}
        />
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------------------------

type Run = ReturnType<typeof useAction>["run"];

const TAB_ICON = {
  overall: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
  results: "M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2Z",
  you: "M20 21v-1a6 6 0 0 0-6-6h-4a6 6 0 0 0-6 6v1M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
};

/** The event's own navigation, under the header: the whole event (Overall, Results once done), or
 *  your day. LIVE is said once, by the pulsing badge in the header, not by a tab. Drawn as a tab bar
 *  (icons, underline, full width) rather than a toggle, so it reads as a place to go. */
function Tabs({ tab, setTab, done, nudge }: { tab: "event" | "you"; setTab: (t: "event" | "you") => void; done: boolean; nudge: boolean }) {
  return (
    <div className="sticky top-0 z-20 mb-4 border-b border-white/[.08] bg-bg/90 backdrop-blur-md" role="tablist">
      <div className="grid grid-cols-2">
        {(["event", "you"] as const).map((t) => {
          const on = tab === t;
          const icon = t === "you" ? TAB_ICON.you : done ? TAB_ICON.results : TAB_ICON.overall;
          return (
            <button key={t} role="tab" aria-selected={on} onClick={() => { setTab(t); window.scrollTo({ top: 0 }); }} className={`spk-press relative flex items-center justify-center gap-2 py-3.5 text-[15px] font-bold ${on ? "text-fg" : "text-dim"}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={on ? "text-accent" : ""}><path d={icon} /></svg>
              {t === "event" ? (done ? "Results" : "Overall") : "You"}
              {t === "you" && nudge && !on && <span className="spk-live h-2 w-2 rounded-full bg-accent" aria-label="your game is on" />}
              {on && <span className="absolute inset-x-6 -bottom-px h-[3px] rounded-full bg-accent" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const ordinal = (n: number) => `${n}${["th", "st", "nd", "rd"][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10 < 4 ? n % 10 : 0]}`;

/** Your own day: are you in, what's next for you and where, how it's gone so far, and the photos. */
function YouTab({ view, me, state, day, iPlayed, waiting, groups, live, done, org, run, pending, onOpen, xp, veiled }: {
  view: EventView; me: string | null; state: EntryState | null; day: MyDay | null; iPlayed: boolean; waiting: boolean;
  groups: GroupView[]; live: boolean; done: boolean; org: boolean; run: Run; pending: boolean; onOpen: (id: string) => void;
  xp: { before: number; after: number; games: number } | null;
  veiled: boolean;
}) {
  const { event: ev, games, people } = view;
  const toFor = (g: Game) => (g.decider ? DECIDER_TO : g.kind === "final" ? ev.finalTo : ev.groupTo);
  const name = (id: string) => people[id]?.name ?? "Someone";
  const both = (ids: string[]) => ids.map(name).join(" & ");
  if (!me || !day) return <CheckIn me={me} state={state} eventId={ev.id} started />;
  const [first, ...later] = day.next;
  const myGroup = groups.find((g) => g.table.some((r) => r.id === me));
  const place = myGroup ? myGroup.table.findIndex((r) => r.id === me) + 1 : 0;
  const moved = xp ? xp.after - xp.before : 0;
  const pd = day.line.pf - day.line.pa;
  return (
    <>
      {done && iPlayed && (
        <div className="px-4 pb-5">
          <Link href={`/e/${ev.id}/recap?p=${me}`} className="spk-press flex items-center gap-3 rounded-2xl bg-gradient-to-r from-accent to-[#9be15d] p-4 text-ink">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink text-accent" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            </span>
            <span className="min-w-0">
              <span className="block text-[17px] font-black">Watch your review</span>
              <span className="block text-[13px] font-semibold opacity-70">Every game, your partners, what it did to your rating</span>
            </span>
          </Link>
        </div>
      )}

      {veiled && <DrawVeil kind={view.stages.at(-1)?.kind} />}

      {live && !veiled && (
        <Section title="Up next">
          {first ? (
            <div className="grid gap-2">
              <div className={`min-w-0 rounded-2xl p-4 ${first.ahead === 0 ? "bg-accent text-ink" : card}`}>
                <button onClick={() => onOpen(first.game.id)} className="spk-press block w-full text-left">
                  <div className={`text-[12px] font-bold uppercase tracking-[.1em] ${first.ahead === 0 ? "opacity-70" : "text-accent"}`}>
                    Net {first.net} · {first.ahead === 0 ? "you're on now" : first.ahead === 1 ? "you're next" : `${first.ahead} games before yours`}
                  </div>
                  <div className="mt-2 text-[20px] font-black leading-tight">With {name(first.partner)}</div>
                  <div className={`mt-0.5 text-[15px] font-semibold ${first.ahead === 0 ? "opacity-75" : "text-muted"}`}>vs {both(first.opponents)}{first.sub ? " · you're subbing" : ""}</div>
                </button>
                {first.ahead === 0 && (
                  <div className="mt-4">
                    <ScoreBoxes key={first.game.id} game={first.game} to={toFor(first.game)} canScore onOpen={() => onOpen(first.game.id)} people={view.people} onAccent flip={!first.game.a.includes(me)} />
                  </div>
                )}
              </div>
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
              {waiting ? "You're in for the next stage. It starts when the organiser draws it." : state === "out" ? <>You&apos;re marked as left. Back? Check in on <Link href="/me" className="font-bold text-accent">Me</Link>.</> : day.played.length ? "No more games for you in this stage." : <>Nothing on for you yet. Check in on <Link href="/me" className="font-bold text-accent">Me</Link> and you&apos;ll be in the next stage.</>}
            </div>
          )}
        </Section>
      )}

      {day.played.length > 0 && (
        <Section title="Your games" aside={!veiled && myGroup && place ? `${ordinal(place)} in ${myGroup.kind === "final" ? `the ${myGroup.name} final` : `Group ${myGroup.name}`}` : undefined}>
          <div className={`${card} overflow-hidden`}>
            <div className="grid grid-cols-3 text-center">
              {([[`${day.line.w}–${day.line.l}`, "won–lost"], [`${pd > 0 ? "+" : ""}${pd}`, "points +/−"], xp && xp.games < PROV_N ? [`${xp.games}/${PROV_N}`, "placing"] : [xp ? `${moved >= 0 ? "+" : "−"}${Math.abs(moved)}` : "–", "rating today"]] as const).map(([v, l]) => (
                <div key={l} className="py-3">
                  <div className="tnum text-[20px] font-black">{v}</div>
                  <div className="text-[10.5px] font-bold uppercase tracking-[.1em] text-dim">{l}</div>
                </div>
              ))}
            </div>
            {day.played.map((x) => <MyGameRow key={x.game.id} x={x} name={name} onOpen={onOpen} />)}
          </div>
        </Section>
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
 *  so this asks for it (it also pops up on its own within a few seconds). */
function DrawVeil({ kind }: { kind?: StageKind }) {
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

function Chip({ p, note }: { p?: PlayerLite; note?: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/[.06] bg-raised py-1 pl-1 pr-3 text-[13.5px] font-semibold">
      <Avatar p={p} size={24} />
      {p?.name ?? "Someone"}
      {note && <span className="text-[11.5px] font-medium text-dim">{note}</span>}
    </span>
  );
}

function WhoIsIn({ view }: { view: EventView }) {
  const by = (s: EntryState) => view.entries.filter((e) => e.state === s);
  const going = [...by("here"), ...by("going")];
  return (
    <Section title="Who's in" aside={`${going.length} ${going.length === 1 ? "player" : "players"}`}>
      <div className={`${card} p-4`}>
        {going.length ? (
          <div className="flex flex-wrap gap-2">{going.map((e) => <Chip key={e.playerId} p={view.people[e.playerId]} note={e.state === "here" ? "here" : undefined} />)}</div>
        ) : (
          <p className="text-[14px] text-muted">Nobody yet. Be the first.</p>
        )}
        {by("out").length > 0 && <p className="mt-3 text-[12.5px] text-dim">Can&apos;t make it: {by("out").map((e) => view.people[e.playerId]?.name).join(", ")}</p>}
      </div>
    </Section>
  );
}

function teamLine(ids: string[], people: Record<string, PlayerLite>, subs: string[] = [], out?: Set<string>) {
  return ids.map((id) => (
    <span key={id} className={out?.has(id) ? "text-loss line-through" : ""}>
      {people[id]?.name ?? "?"}{subs.includes(id) && <span className="ml-0.5 text-[10px] font-bold text-dim align-super">SUB</span>}
    </span>
  )).reduce<React.ReactNode[]>((acc, x, i) => (i ? [...acc, " & ", x] : [x]), []);
}

/** A net: the game on it now, scored right here (tap the winners, slide the losers' score), and
 *  what's on after. The header opens the full sheet: subs, skipping, corrections. */
function NetCard({ net, now, next, people, out, onOpen, to, canScore }: { net: number; now?: Game; next?: Game; people: Record<string, PlayerLite>; out: Set<string>; onOpen: (id: string) => void; to: number; canScore: boolean }) {
  if (!now) return <div className={`${card} p-4 text-[14px] text-muted`}><b className="text-fg">Net {net}</b> · free</div>;
  return (
    <div className={`${card} overflow-hidden`}>
      <div className="p-4">
        <button onClick={() => onOpen(now.id)} className="spk-press flex w-full items-center justify-between text-[12px] font-bold uppercase tracking-[.1em]">
          <span className="text-accent">Net {net} · on now</span>
          <span className="text-dim">{gameLabel(now)} · game {now.seq} ›</span>
        </button>
        {needsSub(now, out).length > 0 && <div className="mt-2 text-[12.5px] font-semibold text-loss">{needsSub(now, out).map((id) => people[id]?.name).join(" & ")} left: tap above to sub someone in.</div>}
        <div className="mt-3"><ScoreBoxes key={now.id} game={now} to={to} canScore={canScore} onOpen={() => onOpen(now.id)} people={people} /></div>
      </div>
      {next && (
        <div className="border-t border-white/[.05] bg-panel px-4 py-2.5 text-[13px] text-muted">
          Next: <span className="text-fg">{teamLine(next.a, people, next.subs, out)}</span> vs <span className="text-fg">{teamLine(next.b, people, next.subs, out)}</span>
        </div>
      )}
    </div>
  );
}

function GroupCard({ g, people, me, out, onOpen, org, run, pending, eventId }: { g: GroupView; people: Record<string, PlayerLite>; me: string | null; out: Set<string>; onOpen: (id: string) => void; org: boolean; run: Run; pending: boolean; eventId: string }) {
  const final = g.kind === "final";
  const tint = final ? tierColor(g.name) : "#CBFB4F";
  const name = (id: string) => people[id]?.name ?? "Someone";
  const deciders = g.games.filter((x) => x.decider && x.status !== "void");
  const pts = deciderPoints(deciders, g.tied);
  const tiedNames = g.tied.map(name).join(" and ");
  return (
    <div className={`${card} spk-up overflow-hidden`}>
      <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full" style={{ background: tint }} aria-hidden="true" />
          <span className="text-[16px] font-black">{final ? `${g.name} final` : `Group ${g.name}`}</span>
        </div>
        <span className="text-[12px] font-bold text-dim">Net {g.net}{g.complete ? " · done" : ""}</span>
      </div>
      {(g.winner || g.tied.length > 0) && (
        <div className="mx-3 mb-2 rounded-xl px-3 py-2 text-[13.5px] font-bold" style={{ background: `${tint}22`, color: tint }}>
          {g.winner
            ? `★ ${name(g.winner)} ${final ? `wins the ${g.name} final` : "tops the group"}${g.decider === "decided" ? ` on the decider, ${Math.max(...pts)}–${Math.min(...pts)}` : ""}`
            : g.decider === "playing"
              ? `Decider: one game to ${DECIDER_TO}, ${tiedNames} on opposite sides. Whoever's side wins tops the group.`
              : g.decider === "level"
                ? `Still level after the decider (${pts[0]}–${pts[1]}). Play it again, or toss a coin.`
                : g.tied.length > 2 ? `Tied at the top: ${tiedNames}, level on wins and points. The organiser calls it, or toss a coin.` : `Tied at the top: ${tiedNames}, level on wins, points and head to head.${org ? "" : " The organiser can set up a decider."}`}
          {org && g.tied.length === 2 && (g.decider === "none" || g.decider === "level") && (
            <button disabled={pending} onClick={() => run(() => addDecider(eventId, g.stageNo, g.groupNo), "Decider added. It's next on the net")} className={`${btnPrimary} mt-2 w-full`}>
              {g.decider === "level" ? "Play the decider again" : "Play decider"}
            </button>
          )}
        </div>
      )}
      <div className="tnum text-[14px]">
        <div className="grid grid-cols-[28px_1fr_36px_44px_44px] items-center px-4 py-1 text-[10.5px] font-bold uppercase tracking-[.1em] text-dim">
          <span>#</span><span>Player</span><span className="text-right">Pts</span><span className="text-right">W–L</span><span className="text-right">+/−</span>
        </div>
        <LayoutGroup id={`group-${g.stageNo}-${g.groupNo}`}>
          {g.table.map((r, i) => {
            const pd = r.pf - r.pa;
            return (
              <motion.div key={r.id} layout="position" transition={SOFT} className={`grid grid-cols-[28px_1fr_36px_44px_44px] items-center border-t border-white/[.04] px-4 py-2 ${r.id === me ? "bg-accent/[.06]" : ""}`}>
                <span className="font-mono text-[12.5px] text-dim">{i + 1}</span>
                <span className="flex min-w-0 items-center gap-2"><Avatar p={people[r.id]} size={22} dim={out.has(r.id)} /><PlayerLink p={people[r.id]} className={`truncate font-semibold ${out.has(r.id) ? "text-dim" : ""}`} />{out.has(r.id) && <span className="text-[11px] text-dim">left</span>}</span>
                <AnimatedNumber value={r.w} className="text-right font-black" />
                <span className="text-right text-num">{r.w}–{r.l}</span>
                <span className={`text-right font-mono text-[12.5px] ${pd > 0 ? "text-win" : pd < 0 ? "text-loss" : "text-dim"}`}>{r.gp ? (pd > 0 ? "+" : "") + pd : "–"}</span>
              </motion.div>
            );
          })}
        </LayoutGroup>
      </div>
      <GroupGames g={g} people={people} out={out} onOpen={onOpen} />
    </div>
  );
}

/** A group's fixtures under its table, in playing order: every game with its score, or a dashed
 *  box to tap and score it. Rows slide in place as results come in. */
function GroupGames({ g, people, out, onOpen }: { g: GroupView; people: Record<string, PlayerLite>; out: Set<string>; onOpen: (id: string) => void }) {
  const games = [...g.games].sort((x, y) => x.ord - y.ord);
  return (
    <div className="mt-1 border-t border-white/[.06]">
      {games.map((x) => <GameRow key={x.id} g={x} people={people} out={out} onOpen={onOpen} />)}
    </div>
  );
}

function GameRow({ g, people, out, onOpen }: { g: Game; people: Record<string, PlayerLite>; out: Set<string>; onOpen: (id: string) => void }) {
  const fin = isDone(g);
  const aWon = fin && g.scoreA! > g.scoreB!;
  return (
    <motion.button
      layout="position" transition={SOFT} whileTap={{ scale: 0.98 }} onClick={() => onOpen(g.id)} aria-label={`${gameLabel(g)}, game ${g.seq}${fin ? `, ${g.scoreA}–${g.scoreB}` : ""}`}
      className={`grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-white/[.03] px-4 py-2.5 text-left text-[13.5px] last:border-0 ${g.status === "void" ? "opacity-40" : ""}`}
    >
      <span className={fin && aWon ? "font-bold text-accent" : "text-fg/85"}>{g.decider && <span className="mr-1.5 rounded bg-accent/15 px-1 py-0.5 text-[10px] font-bold uppercase tracking-[.08em] text-accent">Decider</span>}{teamLine(g.a, people, g.subs, out)}</span>
      <span className={`tnum min-w-[58px] rounded-lg px-2 py-1 text-center font-mono text-[13px] font-bold ${fin ? "bg-raised" : g.status === "void" ? "text-dim" : "border border-dashed border-white/15 text-dim"}`}>
        {fin ? `${g.scoreA}–${g.scoreB}` : g.status === "void" ? "skipped" : "score"}
      </span>
      <span className={`text-right ${fin && !aWon ? "font-bold text-accent" : "text-fg/85"}`}>{teamLine(g.b, people, g.subs, out)}</span>
    </motion.button>
  );
}

function Podium({ groups, people }: { groups: GroupView[]; people: Record<string, PlayerLite> }) {
  const [a, ...rest] = groups;
  const tie = (g: GroupView) => (g.tied.length ? `Tie: ${g.tied.map((id) => people[id]?.name).join(" / ")}` : undefined);
  const others = a?.winner ? a.table.map((r) => r.id).filter((id) => id !== a.winner) : [];
  return (
    <Section title="Results">
      {a && (a.winner ? (
        <div className={`${card} overflow-hidden px-3 pt-4`}>
          <div className="mb-2 text-center text-[11px] font-bold uppercase tracking-[.16em] text-accent">{a.name} final</div>
          <PodiumStand first={people[a.winner]} second={people[others[0]]} third={people[others[1]]} />
        </div>
      ) : (
        <div className={`${card} p-4 text-[15px] font-bold`}>{a.name} final: {tie(a) ?? "not finished"}</div>
      ))}
      {rest.length > 0 && (
        <div className="mt-2.5">
          <FinalWinners finals={rest.map((g) => ({ name: g.name, winner: g.winner ? people[g.winner] : undefined, tied: tie(g) }))} />
        </div>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------------------------------------

function OrganiserPanel({ view, roster, run, pending, waiting, pool }: { view: EventView; roster: PlayerLite[]; run: Run; pending: boolean; waiting: string[]; pool: Set<string> }) {
  const { event: ev, entries, stages, games, people } = view;
  const [name, setName] = useState("");
  const [edit, setEdit] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);
  const here = pool.size;
  const sizes = splitSizes(here);
  const current = stages.at(-1);
  const left = current ? games.filter((g) => g.stageNo === current.no && g.status === "todo").length : 0;
  const stageDone = current && left === 0;
  const twice = (key: string, fn: () => void) => { if (confirm === key) { setConfirm(null); fn(); } else { setConfirm(key); setTimeout(() => setConfirm((c) => (c === key ? null : c)), 3500); } };
  const plan = sizes.length
    ? `${here} playing → groups of ${sizes.join(" + ")}. Everyone plays ${[...new Set(sizes.map(gamesEachForSize))].join(" or ")} games, about ${stageMinutes(sizes, ev.nets, ev.groupTo)} min.`
    : "Check in at least 4 players to draw groups.";
  // A–Z and nothing else: re-sorting by state moved rows under the organiser's finger (and on every
  // 5-second refresh), so a tap meant for one player could land on another's buttons.
  const sorted = [...entries].sort((a, b) => (people[a.playerId]?.name ?? "").localeCompare(people[b.playerId]?.name ?? "") || a.playerId.localeCompare(b.playerId));

  return (
    <Section title="Organiser">
      <div className={`${card} grid gap-4 p-4`}>
        <div>
          <div className="text-[15px] font-extrabold">{current ? "Next step" : "Start the tournament"}</div>
          <p className="mt-1 text-[13.5px] leading-relaxed text-muted">
            {current ? (left ? `${left} game${left === 1 ? "" : "s"} left in this stage. Drawing the next stage skips them.` : "This stage is finished.") : "Check people in below as they arrive, then draw. "}
            {waiting.length > 0 && current ? ` ${waiting.length} waiting to join.` : ""}
          </p>
          <p className="mt-1 text-[13px] text-dim">{plan}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {!current && <button disabled={pending || here < 4} onClick={() => run(() => drawStage(ev.id, "random"), "Groups drawn")} className={btnPrimary}>Draw random groups</button>}
            {/* Two stages is the format: random groups, then A / B finals. A middle
                "regroup by level" stage only earns its place in a big field (16+). */}
            {current && current.kind !== "final" && (
              <>
                <button disabled={pending || here < 4} onClick={() => twice("final", () => run(() => drawStage(ev.id, "final"), "Finals drawn"))} className={stageDone ? btnPrimary : btnGhost}>{confirm === "final" ? "Tap again for finals" : "Start finals"}</button>
                {here >= 16 && current.kind === "random" && <button disabled={pending} onClick={() => twice("seeded", () => run(() => drawStage(ev.id, "seeded"), "Next stage drawn"))} className={btnGhost}>{confirm === "seeded" ? "Tap again to draw" : "Extra stage: regroup by level"}</button>}
              </>
            )}
            {current && <button disabled={pending} onClick={() => twice("undo", () => run(() => undoStage(ev.id), "Stage taken back"))} className={btnQuiet}>{confirm === "undo" ? "Tap again to undo" : "Undo last draw"}</button>}
            {current && <button disabled={pending} onClick={() => twice("finish", () => run(() => finishEvent(ev.id), "Event finished"))} className={btnQuiet}>{confirm === "finish" ? "Tap again to finish" : "Finish event"}</button>}
          </div>
        </div>

        {current && <EditGroups view={view} run={run} pending={pending} pool={pool} />}
      </div>

      {/* The rest of the toolbox, folded: each line says where things stand without opening it. */}
      <div className="mt-2 grid gap-2">
        <Disclosure title="Game length" teaser={`to ${ev.groupTo} · finals ${ev.finalTo}`}>
          <GameLength view={view} run={run} pending={pending} />
        </Disclosure>
        <Disclosure title="Check-in" teaser={`${here} here`} defaultOpen={!current}>
          <p className="text-[13px] text-muted">Mark people <b className="text-fg">here</b> as they arrive. After the first stage everyone who played stays in, so only mark someone <b className="text-fg">out</b> if they leave: their games get flagged for a sub.</p>
          <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) run(() => addWalkIn(ev.id, name), `${name.trim()} checked in`, (r) => r.ok && setName("")); }}>
            <input className={input} list="roster" value={name} onChange={(e) => setName(e.target.value)} placeholder="Add someone by name" aria-label="Add someone by name" />
            <datalist id="roster">{roster.map((r) => <option key={r.id} value={r.name} />)}</datalist>
            <button disabled={pending || !name.trim()} className={`${btnPrimary} shrink-0`}>Add</button>
          </form>
          <div className="mt-3 divide-y divide-white/[.04]">
            {sorted.map((e) => (
              <div key={e.playerId} className="flex items-center gap-2.5 py-2">
                <Avatar p={people[e.playerId]} size={26} dim={e.state === "out"} />
                <span className={`min-w-0 flex-1 truncate text-[14px] font-semibold ${e.state === "out" ? "text-dim" : ""}`}>{people[e.playerId]?.name}</span>
                <div className="flex rounded-lg border border-white/[.06] bg-panel p-0.5 text-[12px] font-bold">
                  {/* Once groups are drawn, "Coming" means nothing (everyone who played stays in),
                      so it's only Here or Out, and the row shows what the next draw will do. */}
                  {(current ? (["here", "out"] as const) : (["going", "here", "out"] as const)).map((s) => {
                    const shown = e.state !== "out" && pool.has(e.playerId) ? "here" : e.state;
                    return (
                    <button key={s} disabled={pending} onClick={() => run(() => setEntry(ev.id, e.playerId, s))} className={`rounded-md px-2.5 py-1.5 ${shown === s ? (s === "out" ? "bg-loss text-ink" : "bg-accent text-ink") : "text-muted"}`} aria-pressed={shown === s}>
                      {s === "going" ? "Coming" : s === "here" ? "Here" : "Out"}
                    </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </Disclosure>

        <Disclosure title="Event details" teaser={ev.location ?? undefined}>
          {!edit ? (
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setEdit(true)} className={btnGhost}>Edit event details</button>
              {!current && <button disabled={pending} onClick={() => twice("delete", () => run(() => deleteEvent(ev.id), "Event deleted", (r) => { if (r.ok) location.href = "/?all=1"; }))} className={btnQuiet}>{confirm === "delete" ? "Tap again to delete" : "Delete event"}</button>}
            </div>
          ) : (
            <EditEvent view={view} run={run} pending={pending} onDone={() => setEdit(false)} />
          )}
        </Disclosure>
      </div>
    </Section>
  );
}

/**
 * Organiser: change who's in which group mid-stage. Tap a player to pick them up, then tap someone
 * in another group to swap, or a group's "Move here", or take them out. Played games never change.
 */
function EditGroups({ view, run, pending, pool }: { view: EventView; run: Run; pending: boolean; pool: Set<string> }) {
  const { event: ev, stages, games, people } = view;
  const current = stages.at(-1)!;
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const name = (id: string) => people[id]?.name ?? "Someone";
  const inStage = games.filter((g) => g.stageNo === current.no);
  const groups = [...new Set(inStage.map((g) => g.groupNo))].sort((a, b) => a - b).map((no) => {
    const gs = inStage.filter((g) => g.groupNo === no);
    const first = gs[0];
    return { no, members: currentMembers(inStage, no), label: first.kind === "final" ? `${finalName(first.groupName)} final` : `Group ${first.groupName}`, net: first.net };
  });
  const groupOf = (id: string | null) => (id ? groups.find((g) => g.members.includes(id))?.no ?? null : null);
  const inAny = new Set(groups.flatMap((g) => g.members));
  const waiting = [...pool].filter((id) => !inAny.has(id));
  const selGroup = groupOf(sel);

  const tap = (id: string) => {
    if (!sel || sel === id) return setSel(sel === id ? null : id);
    const a = groupOf(sel), b = groupOf(id);
    if (a === b) return setSel(id); // same group (or both waiting): just pick the other one
    run(() => swapPlayers(ev.id, sel, id), a !== null && b !== null ? `${name(sel)} and ${name(id)} swapped` : `${a === null ? name(sel) : name(id)} is in for ${a === null ? name(id) : name(sel)}`, (r) => r.ok && setSel(null));
  };
  const chip = (id: string) => (
    <button key={id} disabled={pending} onClick={() => tap(id)} aria-pressed={sel === id}
      className={`spk-press inline-flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-[13.5px] font-semibold ${sel === id ? "bg-accent text-ink" : "border border-white/[.08] bg-raised"}`}>
      <Avatar p={people[id]} size={24} />{name(id)}
    </button>
  );

  return (
    <div className="border-t border-white/[.05] pt-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[15px] font-extrabold">Edit groups</div>
        <button onClick={() => { setOpen(!open); setSel(null); }} className="spk-press text-[13px] font-bold text-accent">{open ? "Done" : "Change groups"}</button>
      </div>
      {!open ? (
        <p className="mt-1 text-[13px] text-muted">Swap players between groups, move someone, take them out, or redraw. Scores already entered never change.</p>
      ) : (
        <div className="mt-2 grid gap-3">
          <p className="text-[13px] leading-relaxed text-muted">
            {sel
              ? <>Tap someone in another group to swap with <b className="text-fg">{name(sel)}</b>, or use <b className="text-fg">Move here</b>.</>
              : "Tap a player to pick them up."}
          </p>
          {groups.map((g) => (
            <div key={g.no} className="rounded-xl border border-white/[.06] bg-panel p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[13px] font-bold">{g.label} <span className="font-semibold text-dim">· Net {g.net} · {g.members.length}</span></span>
                {sel && selGroup !== g.no && (
                  <button disabled={pending} onClick={() => run(() => movePlayer(ev.id, sel, g.no), `${name(sel)} moved to ${g.label}`, (r) => r.ok && setSel(null))} className="spk-press rounded-full bg-accent px-3 py-1 text-[12.5px] font-black text-ink">Move here</button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">{g.members.map(chip)}</div>
            </div>
          ))}
          {waiting.length > 0 && (
            <div className="rounded-xl border border-dashed border-white/[.1] p-3">
              <div className="mb-2 text-[13px] font-bold text-muted">Not in a group</div>
              <div className="flex flex-wrap gap-2">{waiting.map(chip)}</div>
            </div>
          )}
          {sel && selGroup !== null && (
            <button disabled={pending} onClick={() => run(() => movePlayer(ev.id, sel, null), `${name(sel)} is out of this stage`, (r) => r.ok && setSel(null))} className={btnGhost}>Take {name(sel)} out of this stage</button>
          )}
          <p className="text-[12.5px] leading-relaxed text-dim">Games already played keep their scores. Only games still to play change, including one on a net right now, so enter finished scores first. Moving someone redraws the rest of both groups so nobody repeats a partner.</p>
          <button disabled={pending} onClick={() => { if (confirm) { setConfirm(false); run(() => redrawStage(ev.id), "Groups redrawn"); } else { setConfirm(true); setTimeout(() => setConfirm(false), 3500); } }} className={btnQuiet}>
            {confirm ? "Tap again to redraw" : "Redraw all groups (scores so far still count)"}
          </button>
        </div>
      )}
    </div>
  );
}

/** One tap to change how long games are, mid-tournament. Scores already entered stay as they are. */
function GameLength({ view, run, pending }: { view: EventView; run: Run; pending: boolean }) {
  const e = view.event;
  const set = (k: "groupTo" | "finalTo", to: number) =>
    run(() => updateEvent(e.id, { title: e.title, startsAt: new Date(e.startsAt).toISOString(), location: e.location, notes: e.notes, nets: e.nets, groupTo: k === "groupTo" ? to : e.groupTo, finalTo: k === "finalTo" ? to : e.finalTo }), `${k === "groupTo" ? "Group" : "Finals"} games now to ${to}`);
  const row = (k: "groupTo" | "finalTo", label: string) => (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[13.5px] font-semibold text-muted">{label}</span>
      <div className="flex rounded-lg border border-white/[.06] bg-panel p-0.5 text-[13px] font-bold">
        {[7, 9, 11, 15, 21].map((n) => (
          <button key={n} disabled={pending || e[k] === n} onClick={() => set(k, n)} aria-pressed={e[k] === n} className={`tnum min-w-9 rounded-md px-2 py-1.5 ${e[k] === n ? "bg-accent text-ink" : "text-muted"}`}>{n}</button>
        ))}
      </div>
    </div>
  );
  return (
    <div className="grid gap-2">
      {row("groupTo", "Groups to")}
      {row("finalTo", "Finals to")}
      <p className="text-[12.5px] text-dim">Win by 2. Changes apply to games from now on, on every phone. Scores already entered stay as they are.</p>
    </div>
  );
}

function EditEvent({ view, run, pending, onDone }: { view: EventView; run: Run; pending: boolean; onDone: () => void }) {
  const e = view.event;
  const local = (d: Date) => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 16); };
  const [f, setF] = useState({ title: e.title, startsAt: local(e.startsAt), location: e.location, notes: e.notes, nets: e.nets, groupTo: e.groupTo, finalTo: e.finalTo });
  const field = (k: keyof typeof f, label: string, type = "text") => (
    <label className="grid gap-1 text-[12.5px] font-semibold text-muted">
      {label}
      <input className={input} type={type} value={f[k] as string | number} onChange={(x) => setF({ ...f, [k]: type === "number" ? Number(x.target.value) : x.target.value })} />
    </label>
  );
  return (
    <form className="grid gap-3" onSubmit={(x) => { x.preventDefault(); run(() => updateEvent(e.id, { ...f, startsAt: new Date(f.startsAt).toISOString() }), "Saved", (r) => r.ok && onDone()); }}>
      {field("title", "Name")}
      {field("startsAt", "Date and time", "datetime-local")}
      {field("location", "Where")}
      <div className="grid grid-cols-3 gap-2">{field("nets", "Nets", "number")}{field("groupTo", "Groups to", "number")}{field("finalTo", "Finals to", "number")}</div>
      <label className="grid gap-1 text-[12.5px] font-semibold text-muted">Notes<textarea className={`${input} min-h-20 py-3`} value={f.notes} onChange={(x) => setF({ ...f, notes: x.target.value })} /></label>
      <p className="text-[12.5px] text-dim">Changing nets only affects stages drawn from now on.</p>
      <div className="flex gap-2"><button type="button" onClick={onDone} className={`${btnGhost} flex-1`}>Cancel</button><button disabled={pending} className={`${btnPrimary} flex-[2]`}>Save</button></div>
    </form>
  );
}
