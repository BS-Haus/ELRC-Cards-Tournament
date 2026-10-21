"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { setEntry, addWalkIn, drawStage, undoStage, finishEvent, reopenEvent, deleteEvent, updateEvent, addDecider, swapPlayers, movePlayer, redrawStage } from "@/app/actions";
import { useAction } from "@/components/useAction";
import { DrawVeil, ordinal } from "@/components/MyDay";
import { ScoreSheet } from "@/components/ScoreSheet";
import { EventPhotos } from "@/components/EventPhotos";
import { CheckIn, LiveBadge } from "@/components/CheckIn";
import { Court } from "@/components/Nets";
import { PodiumStand, FinalWinners } from "@/components/Podium";
import { Avatar, PlayerLink, Section, card, btnPrimary, btnGhost, btnQuiet, input, tierColor, fmtDate } from "@/components/ui";
import { netQueues, needsSub, splitSizes, seedOrder, spreadRepeats, dayPoints, tally, TIERS, stageMinutes, gamesEachForSize, isDone, drawPool, gameLabel, deciderPoints, DECIDER_TO, currentMembers, finalName, finalLabel, type Game, type StageKind, finalWinTitle } from "@/lib/cards";
import { groupsOf, finalsOf, myDay, myCheckIn, type GroupView } from "@/lib/views";
import type { EventView, PlayerLite, EntryState } from "@/lib/data";
import { Disclosure, SOFT } from "@/components/kit";
import { motion, LayoutGroup } from "motion/react";

const STAGE_TITLE: Record<StageKind, string> = { random: "Mixed groups", seeded: "Groups by level", final: "Finals", ladder: "Ladder" };

/** `myXp`: your rating either side of this weekend so far, and your games in all (src/lib/standings.ts),
 *  loaded on the server. */
/** `drawPending`: you're in the newest stage but haven't watched its draw story yet, so its groups,
 *  nets and your next game stay hidden: the story is how you find out. */
export function EventScreen({ view, me, org, myXp = null, drawPending = false }: { view: EventView; me: string | null; org: boolean; myXp?: { before: number; after: number; games: number } | null; drawPending?: boolean }) {
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
  // Where everyone would land if the finals were drawn now: the bars on every table.
  const bound = current && current.kind !== "final" && !drawPending ? projectFinals(view, here) : null;

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
  // Once groups are drawn this page is the shared screen: every net, its table and fixtures. Your
  // own day (what's next for you, your games) is on Me (src/components/MyDay.tsx).
  const started = !!current || done;
  const mine = useMemo(() => (me ? myDay(games, ev.nets, me) : null), [games, ev.nets, me]);

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
        <div className="mt-4 flex items-center gap-2 spk-label">
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
            <span className="block spk-label opacity-70">{finalLabel(crown.tier)} final</span>
            <span className="block truncate text-[20px] font-black">{crown.id === me ? `You win the ${finalLabel(crown.tier)} final!` : `${p(crown.id)?.name ?? "Someone"} wins the ${finalLabel(crown.tier)} final!`}</span>
          </span>
        </button>
      )}

      {!started && (
        <>
          <CheckIn me={me} state={myEntry} eventId={ev.id} started={false} />
          <WhoIsIn view={view} />
        </>
      )}

      {started && (
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

          {done && iPlayed && me && (
            <div className="-mt-2 px-4 pb-5">
              <Link href={`/e/${ev.id}/recap?p=${me}`} className={`${card} spk-press flex items-center justify-between gap-3 p-4`}>
                <span className="text-[15px] font-black">Your review</span>
                <span className="text-[13px] font-bold text-accent">Every game, your partners →</span>
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

          {/* Net by net, one slide each (swipe, or tap a net's pill): the game on it now (tap to
              score), then the table and fixtures of each group playing there. Opens on your net. */}
          {current && !drawPending && (
            <Section title={`${current.kind === "final" ? "Finals" : `Stage ${current.no}`} · ${current.kind === "final" ? `to ${ev.finalTo}` : STAGE_TITLE[current.kind]}`} aside={current.kind === "final" ? "Decided on wins" : "Points decide the finals"}>
              <NetCarousel
                start={mine?.next[0]?.net ?? curGroups.find((g) => !!me && g.table.some((r) => r.id === me))?.net ?? 0}
                slides={netNumbers(queues, curGroups).map((n) => {
                  const q = queues[n - 1] ?? [];
                  const onNet = curGroups.filter((g) => g.net === n);
                  return {
                    n, live: live && !!q[0],
                    label: onNet.map((g) => (g.kind === "final" ? finalLabel(g.name) : `Group ${g.name}`)).join(" · ") || (q[0] ? gameLabel(q[0]) : "Free"),
                    mine: !!me && onNet.some((g) => g.table.some((r) => r.id === me)),
                    body: (
                    <div className="grid gap-2.5">
                      {live && q[0] && (
                        <Court
                          title={`Net ${n}`} tag={`${gameLabel(q[0])} · game ${q[0].seq}`}
                          a={q[0].a} b={q[0].b} scoreA={null} scoreB={null} people={people} live orbit
                          warn={needsSub(q[0], out).length ? `${needsSub(q[0], out).map((id) => p(id)?.name).join(" & ")} left: tap to sub someone in` : undefined}
                          onTap={() => setOpen(q[0].id)}
                        />
                      )}
                      {onNet.map((g) => <GroupCard key={g.groupNo} g={g} people={people} delta={view.delta} me={me} out={out} onOpen={setOpen} org={org && live} run={run} pending={pending} eventId={ev.id} bound={bound} />)}
                    </div>
                    ),
                  };
                })}
              />
            </Section>
          )}

          {/* Where everyone stands across the day's rounds (they all count for the finals), with
              the final each would be in now. Updates as scores come in. */}
          {bound && <Standings view={view} pool={here} me={me} />}

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
                      {groupsOf(view, s.no).map((g) => <GroupCard key={g.groupNo} g={g} people={people} delta={view.delta} me={me} out={out} onOpen={setOpen} org={org && live} run={run} pending={pending} eventId={ev.id} />)}
                    </div>
                  </details>
                ))}
              </div>
            </Section>
          )}


        </>
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

/** `bound`: which final each player would be in if the finals were drawn now (projectFinals),
 *  shown as a gold / silver / bronze bar down the row's left edge. (Before: `cut`, the A final's line; the top `sure` are
 *  in, and with `extra` places left over, the next one might be. */
/** The nets to show, in order: every net with a game waiting or a group of this stage on it. */
const netNumbers = (queues: Game[][], groups: GroupView[]) =>
  [...new Set([...queues.flatMap((q, i) => (q.length ? [i + 1] : [])), ...groups.map((g) => g.net)])].sort((a, b) => a - b);

/** Which final each player is heading for if the finals were drawn now: exactly the draw's own
 *  rule (seedOrder, then spreadRepeats), cut into finals by splitSizes. Empty with one final. */
function projectFinals(view: EventView, pool: string[]): Map<string, string> {
  const order = spreadRepeats(seedOrder(view.games, pool, "final", dayPoints(view.games, view.delta)), view.games, "final");
  const sizes = splitSizes(order.length);
  const to = new Map<string, string>();
  if (sizes.length < 2) return to;
  let at = 0;
  sizes.forEach((k, i) => order.slice(at, (at += k)).forEach((id) => to.set(id, TIERS[i] ?? String(i + 1))));
  return to;
}

/** The day so far across every round (they all count for the finals), in the order the finals
 *  would be drawn now, each row with a bar for the final that puts them in. Rows slide as scores
 *  come in. */
function Standings({ view, pool, me }: { view: EventView; pool: string[]; me: string | null }) {
  const { games, people } = view;
  const groupGames = games.filter((g) => g.kind !== "final" && g.status !== "void");
  const rounds = new Set(groupGames.map((g) => g.stageNo)).size;
  const points = dayPoints(games, view.delta);
  const order = spreadRepeats(seedOrder(games, pool, "final", points), games, "final");
  const to = projectFinals(view, pool);
  const lines = tally(groupGames, order);
  const tiers = [...new Set(order.map((id) => to.get(id)).filter(Boolean))] as string[];
  return (
    <Section title={rounds > 2 ? "Standings · all rounds" : rounds === 2 ? "Standings · both rounds" : "Standings"} aside="Points = rating ± today">
      <div className={`${card} overflow-hidden tnum text-[14px]`}>
        {tiers.length > 0 && (
          <div className="flex items-center gap-3 px-4 pt-3 pb-1">
            {tiers.map((t) => <span key={t} className="flex items-center gap-1.5 text-[12px] font-bold text-muted"><span className="h-2.5 w-0.5 rounded-full" style={{ background: tierColor(t) }} />{finalLabel(t)}</span>)}
            <span className="ml-auto text-[11.5px] text-dim">if drawn now</span>
          </div>
        )}
        <div className="grid grid-cols-[28px_1fr_44px_52px] items-center px-4 pt-2 pb-1 spk-label">
          <span>#</span><span>Player</span><span className="text-right">W–L</span><span className="text-right">Pts</span>
        </div>
        <LayoutGroup id="standings">
          {order.map((id, i) => {
            const r = lines.get(id)!;
            const p = Math.round(points.get(id) ?? 0);
            const t = to.get(id);
            return (
              <motion.div key={id} layout="position" transition={SOFT}
                className={`grid grid-cols-[28px_1fr_44px_52px] items-center border-t border-white/[.04] px-4 py-2 ${id === me ? "bg-white/[.05]" : ""}`}
                style={t ? { boxShadow: `inset 1px 0 0 ${tierColor(t)}` } : undefined}>
                <span className="font-mono text-[12.5px] text-dim">{i + 1}</span>
                <span className="flex min-w-0 items-center gap-2"><Avatar p={people[id]} size={22} /><PlayerLink p={people[id]} className="truncate font-semibold" /></span>
                <span className="text-right text-num">{r.w}–{r.l}</span>
                <span className={`text-right font-mono font-black ${p > 0 ? "text-win" : p < 0 ? "text-loss" : "text-dim"}`}>{r.gp ? (p > 0 ? "+" : p < 0 ? "−" : "") + Math.abs(p) : "–"}</span>
              </motion.div>
            );
          })}
        </LayoutGroup>
      </div>
    </Section>
  );
}

type NetSlide = { n: number; label: string; live: boolean; mine: boolean; body: React.ReactNode };
const SLIDE_GAP = 8;

/** The nets as a carousel: each net is a slide a little narrower than the screen, so the next one
 *  peeks in at the edge, with dots underneath. Swipe, or tap a net in the switch above (it sticks
 *  under the tabs, so you can change net from halfway down a table). Opens on `start` (your net)
 *  and stays wherever you swipe to through the page's refreshes. Its height follows the net on
 *  screen, so a short group next to a long one leaves no gap. One net: just the net. */
function NetCarousel({ slides, start }: { slides: NetSlide[]; start: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState(() => Math.max(0, slides.findIndex((s) => s.n === start)));
  const [h, setH] = useState<number>();
  const step = () => ((ref.current?.children[0] as HTMLElement | undefined)?.offsetWidth ?? 1) + SLIDE_GAP;
  // Land on your net without a scroll animation, once.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (ref.current) ref.current.scrollLeft = at * step(); }, []);
  useEffect(() => {
    const el = ref.current?.children[at] as HTMLElement | undefined;
    if (!el) return;
    const fit = () => setH(el.offsetHeight);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [at, slides.length]);
  const i = Math.min(at, slides.length - 1);
  if (slides.length < 2) return <>{slides[0]?.body}</>;
  const go = (k: number) => ref.current?.scrollTo({ left: k * step(), behavior: "smooth" });
  return (
    <>
      <div className="sticky top-[env(safe-area-inset-top)] z-10 -mx-4 mb-3 bg-bg px-4 py-2 before:pointer-events-none before:absolute before:inset-x-0 before:bottom-full before:h-[env(safe-area-inset-top)] before:bg-bg before:content-['']">
        {/* Light on purpose: the nets below are the content, this just says which one. */}
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${slides.length}, minmax(0, 1fr))` }} role="tablist" aria-label="Nets">
          {slides.map((s, k) => (
            <button key={s.n} role="tab" aria-selected={k === i} onClick={() => go(k)}
              className={`spk-press flex min-w-0 items-baseline justify-center gap-1.5 rounded-full border px-2 py-1.5 ${k === i ? "border-accent/60 bg-accent/[.07] text-fg" : "border-white/[.06] text-muted"}`}>
              <span className="flex shrink-0 items-center gap-1 text-[13px] font-black">
                Net {s.n}
                {s.mine && <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-label="your net" />}
              </span>
              <span className="min-w-0 truncate text-[11.5px] font-semibold text-dim">{s.label}</span>
            </button>
          ))}
        </div>
      </div>
      <div
        ref={ref}
        onScroll={() => { const k = Math.round((ref.current?.scrollLeft ?? 0) / step()); if (k !== at) setAt(k); }}
        className="-mx-4 flex snap-x snap-mandatory items-start overflow-x-auto overflow-y-hidden overscroll-x-contain px-4 transition-[height] duration-300 [scrollbar-width:none]"
        style={{ height: h, gap: SLIDE_GAP }}
      >
        {slides.map((s, k) => (
          <div key={s.n} className={`w-[calc(100%-12px)] shrink-0 snap-center snap-always transition-opacity duration-300 ${k === i ? "" : "opacity-60"}`} onClickCapture={k === i ? undefined : (e) => { e.stopPropagation(); e.preventDefault(); go(k); }}>
            {s.body}
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-center gap-1.5" aria-hidden="true">
        {slides.map((s, k) => <span key={s.n} className={`h-1.5 rounded-full transition-all duration-300 ${k === i ? "w-5 bg-accent" : "w-1.5 bg-white/20"}`} />)}
      </div>
    </>
  );
}

function GroupCard({ g, people, me, out, onOpen, org, run, pending, eventId, bound = null, delta }: { g: GroupView; delta?: Record<string, Record<string, number>>; people: Record<string, PlayerLite>; me: string | null; out: Set<string>; onOpen: (id: string) => void; org: boolean; run: Run; pending: boolean; eventId: string; bound?: Map<string, string> | null }) {
  const final = g.kind === "final";
  const tint = final ? tierColor(g.name) : "#CBFB4F";
  const name = (id: string) => people[id]?.name ?? "Someone";
  const deciders = g.games.filter((x) => x.decider && x.status !== "void");
  const pts = deciderPoints(deciders, g.tied);
  const tiedNames = g.tied.map(name).join(" and ");
  // A round's table is the points race: each player's rating ± from this group's games, best first.
  // A final is won on wins, so its table stays wins first.
  const roundPts = !final && delta ? dayPoints(g.games, delta) : null;
  const table = roundPts ? [...g.table].sort((x, y) => (roundPts.get(y.id) ?? 0) - (roundPts.get(x.id) ?? 0) || y.w - x.w || (y.pf - y.pa) - (x.pf - x.pa)) : g.table;
  const cols = roundPts ? "grid-cols-[28px_1fr_44px_52px]" : "grid-cols-[28px_1fr_44px_44px]";
  return (
    <div className={`${card} spk-up overflow-hidden`}>
      <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full" style={{ background: tint }} aria-hidden="true" />
          <span className="text-[16px] font-black">{final ? `${finalLabel(g.name)} final` : `Group ${g.name}`}</span>
        </div>
        <span className="text-[12px] font-bold text-dim">Net {g.net}{g.complete ? " · done" : ""}</span>
      </div>
      {/* The rule for this table, in a line: a round ranks on points, a final on wins. */}
      <p className="-mt-1 px-4 pb-2 text-[12px] text-dim">
        {final ? "Most wins takes it · level on wins: +/− (score difference)" : roundPts ? "Ranked on points (Elo ±)" : "Ranked on wins, then points difference"}
      </p>
      {!roundPts && (g.winner || g.tied.length > 0) && (
        <div className="mx-3 mb-2 rounded-xl px-3 py-2 text-[13.5px] font-bold" style={{ background: `${tint}22`, color: tint }}>
          {g.winner
            ? `★ ${name(g.winner)} ${final ? `wins the ${finalLabel(g.name)} final` : "tops the group"}${g.decider === "decided" ? ` on the decider, ${Math.max(...pts)}–${Math.min(...pts)}` : ""}`
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
        <div className={`grid ${cols} items-center px-4 py-1 spk-label text-dim`}>
          {roundPts
            ? <><span>#</span><span>Player</span><span className="text-right">W–L</span><span className="text-right">Pts</span></>
            : <><span>#</span><span>Player</span><span className="text-right">W–L</span><span className="text-right">+/−</span></>}
        </div>
        <LayoutGroup id={`group-${g.stageNo}-${g.groupNo}`}>
          {table.map((r, i) => {
            const pd = r.pf - r.pa;
            const to = bound?.get(r.id);
            const p = roundPts ? Math.round(roundPts.get(r.id) ?? 0) : 0;
            return (
              <motion.div key={r.id} layout="position" transition={SOFT}
                className={`grid ${cols} items-center border-t border-white/[.04] px-4 py-2 ${r.id === me ? "bg-accent/[.06]" : ""}`}
                style={to ? { boxShadow: `inset 1px 0 0 ${tierColor(to)}` } : undefined}
                title={to ? `${finalLabel(to)} final if drawn now` : undefined}>
                <span className="font-mono text-[12.5px] text-dim">{i + 1}</span>
                <span className="flex min-w-0 items-center gap-2"><Avatar p={people[r.id]} size={22} dim={out.has(r.id)} /><PlayerLink p={people[r.id]} className={`truncate font-semibold ${out.has(r.id) ? "text-dim" : ""}`} />{out.has(r.id) && <span className="text-[11px] text-dim">left</span>}</span>
                {roundPts ? (
                  <>
                    <span className="text-right text-num">{r.w}–{r.l}</span>
                    <span className={`text-right font-mono font-black ${p > 0 ? "text-win" : p < 0 ? "text-loss" : "text-dim"}`}>{r.gp ? (p > 0 ? "+" : p < 0 ? "−" : "") + Math.abs(p) : "–"}</span>
                  </>
                ) : (
                  <>
                    <span className="text-right font-black">{r.w}–{r.l}</span>
                    <span className={`text-right font-mono text-[12.5px] ${pd > 0 ? "text-win" : pd < 0 ? "text-loss" : "text-dim"}`}>{r.gp ? (pd > 0 ? "+" : "") + pd : "–"}</span>
                  </>
                )}
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
      <span className={fin ? (aWon ? "font-bold text-fg" : "text-dim") : "text-fg/85"}>{g.decider && <span className="mr-1.5 rounded bg-accent/15 px-1 py-0.5 spk-label text-accent">Decider</span>}{teamLine(g.a, people, g.subs, out)}</span>
      <span className={`tnum min-w-[58px] rounded-lg px-2 py-1 text-center font-mono text-[13px] font-bold ${fin ? "bg-raised" : g.status === "void" ? "text-dim" : "border border-dashed border-white/15 text-dim"}`}>
        {fin ? `${g.scoreA}–${g.scoreB}` : g.status === "void" ? "skipped" : "score"}
      </span>
      <span className={`text-right ${fin ? (!aWon ? "font-bold text-fg" : "text-dim") : "text-fg/85"}`}>{teamLine(g.b, people, g.subs, out)}</span>
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
          <div className="mb-2 text-center spk-label text-accent">{finalLabel(a.name)} final</div>
          <PodiumStand first={people[a.winner]} second={people[others[0]]} third={people[others[1]]} />
        </div>
      ) : (
        <div className={`${card} p-4 text-[15px] font-bold`}>{finalLabel(a.name)} final: {tie(a) ?? "not finished"}</div>
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

/** One event's organiser tools, on the Organise tab (src/app/organise): the next step (draw,
 *  finals, undo, finish), editing groups, then check-in, game length and details. A finished
 *  event can be reopened. Keeps itself fresh while the event's live. */
export function OrganiserTools({ view, roster }: { view: EventView; roster: PlayerLite[] }) {
  const router = useRouter();
  const { run, pending, toast } = useAction();
  const live = view.event.status === "live";
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => { if (!document.hidden) router.refresh(); }, 5000);
    return () => clearInterval(t);
  }, [live, router]);
  const here = drawPool(view.entries, view.games);
  const cur = view.stages.at(-1);
  const inCurrent = new Set((cur ? groupsOf(view, cur.no) : []).flatMap((g) => g.games.flatMap((x) => [...x.a, ...x.b])));
  return (
    <>
      {toast}
      {view.event.status === "done" ? (
        <div className="px-4 pb-6">
          <button disabled={pending} onClick={() => run(() => reopenEvent(view.event.id), "Event reopened")} className={`${btnGhost} w-full`}>Reopen event</button>
        </div>
      ) : (
        <OrganiserPanel view={view} roster={roster} run={run} pending={pending} waiting={here.filter((id) => !inCurrent.has(id))} pool={new Set(here)} />
      )}
    </>
  );
}

function OrganiserPanel({ view, roster, run, pending, waiting, pool }: { view: EventView; roster: PlayerLite[]; run: Run; pending: boolean; waiting: string[]; pool: Set<string> }) {
  const { event: ev, entries, stages, games, people } = view;
  const [name, setName] = useState("");
  const [find, setFind] = useState("");
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
  const onList = new Set(entries.map((e) => e.playerId));
  const notIn = roster.filter((r) => !onList.has(r.id)).sort((a, b) => a.name.localeCompare(b.name));
  const sorted = [...entries].sort((a, b) => (people[a.playerId]?.name ?? "").localeCompare(people[b.playerId]?.name ?? "") || a.playerId.localeCompare(b.playerId));

  return (
    <section className="px-4 pb-6">
      <div className={`${card} grid gap-4 p-4`}>
        <div>
          <div className="text-[15px] font-extrabold">{current ? "Next step" : "Start the tournament"}</div>
          <p className="mt-1 text-[13.5px] leading-relaxed text-muted">
            {current ? (left ? `${left} game${left === 1 ? "" : "s"} left in this stage. Drawing the next stage skips them.` : "This stage is finished.") : "Check people in below as they arrive, then draw. "}
            {waiting.length > 0 && current ? ` ${waiting.length} waiting to join.` : ""}
          </p>
          <p className="mt-1 text-[13px] text-dim">{plan}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {!current && <button disabled={pending || here < 4} onClick={() => run(() => drawStage(ev.id, "random"), "Groups drawn")} className={btnPrimary}>Draw mixed groups</button>}
            {/* Two stages is the format: random groups, then A / B finals. A middle
                "regroup by level" stage only earns its place in a big field (16+). */}
            {current && current.kind !== "final" && (
              <>
                <button disabled={pending || here < 4} onClick={() => twice("final", () => run(() => drawStage(ev.id, "final"), "Finals drawn"))} className={stageDone ? btnPrimary : btnGhost}>{confirm === "final" ? "Tap again for finals" : "Start finals"}</button>
                {/* Another round before the finals, whenever there are two or more groups: mixed
                    again (levels spread, new groups) or by level (groups by the table). */}
                {sizes.length >= 2 && <button disabled={pending} onClick={() => twice("random", () => run(() => drawStage(ev.id, "random"), "Another mixed round drawn"))} className={btnGhost}>{confirm === "random" ? "Tap again to draw" : "Another round: mixed"}</button>}
                {sizes.length >= 2 && <button disabled={pending} onClick={() => twice("seeded", () => run(() => drawStage(ev.id, "seeded"), "Another round drawn by level"))} className={btnGhost}>{confirm === "seeded" ? "Tap again to draw" : "Another round: by level"}</button>}
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
          {/* Everyone who's ever played and isn't on the list yet: one tap checks them in. A new
              name below makes a profile they can claim later by signing in with it. */}
          {notIn.length > 0 && (
            <div className="mt-3">
              <div className="spk-label">Tap to check in</div>
              {notIn.length > 16 && <input className={`${input} mt-2`} value={find} onChange={(e) => setFind(e.target.value)} placeholder="Find a player" aria-label="Find a player" />}
              <div className="mt-2 flex flex-wrap gap-2">
                {notIn.filter((r) => !find.trim() || r.name.toLowerCase().includes(find.trim().toLowerCase())).map((r) => (
                  <button key={r.id} type="button" disabled={pending} onClick={() => run(() => setEntry(ev.id, r.id, "here"), `${r.name} checked in`)}
                    className="spk-press inline-flex items-center gap-2 rounded-full border border-white/[.08] bg-raised py-1 pl-1 pr-3 text-[13.5px] font-semibold">
                    <Avatar p={r} size={24} />{r.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) run(() => addWalkIn(ev.id, name), `${name.trim()} checked in`, (r) => r.ok && setName("")); }}>
            <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Not here? Add a new player" aria-label="Add a new player" />
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
                    <button key={s} disabled={pending} onClick={() => run(() => setEntry(ev.id, e.playerId, s))} className={`rounded-md px-2.5 py-1.5 ${shown === s ? (s === "out" ? "bg-loss text-ink" : "bg-fg text-ink") : "text-muted"}`} aria-pressed={shown === s}>
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
    </section>
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
    return { no, members: currentMembers(inStage, no), label: first.kind === "final" ? `${finalLabel(first.groupName)} final` : `Group ${first.groupName}`, net: first.net };
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
      className={`spk-press inline-flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-[13.5px] font-semibold ${sel === id ? "bg-fg text-ink" : "border border-white/[.08] bg-raised"}`}>
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
          <button key={n} disabled={pending || e[k] === n} onClick={() => set(k, n)} aria-pressed={e[k] === n} className={`tnum min-w-9 rounded-md px-2 py-1.5 ${e[k] === n ? "bg-fg text-ink" : "text-muted"}`}>{n}</button>
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
