"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, LayoutGroup, AnimatePresence } from "motion/react";
import { startLadder, nextLadderRound, undoStage, finishEvent, reopenEvent, deleteEvent, updateEvent, setEntry, addWalkIn, resultOf, clearScore, swapLadderPlayer } from "@/app/actions";
import { useAction } from "@/components/useAction";
import { LiveBadge } from "@/components/CheckIn";
import { ScoreBoxes } from "@/components/ScoreBoxes";
import { Disclosure, SOFT } from "@/components/kit";
import { Avatar, Section, card, btnPrimary, btnGhost, btnQuiet, input, fmtDate } from "@/components/ui";
import { netsFor } from "@/lib/netLadder";
import { PROV_N } from "@/lib/standings";
import type { Game } from "@/lib/cards";
import type { EventView, PlayerLite, Moments } from "@/lib/data";

// A ladder event, as one screen: the nets stacked top to bottom with the four faces on each. A
// scored net shows who's going up and who's going down; when the last score is in, the next round
// is drawn and everyone slides to their new net. Tap a net to score it (or see its result) in a
// sheet. Ratings, tables and check-in live on other tabs: this screen is just the nets.

const GAME_LENGTHS = [11, 15, 17, 21];
const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n)}`;

export function LadderScreen({ view, me, org, roster }: { view: EventView; me: string | null; org: boolean; roster: PlayerLite[] }) {
  const router = useRouter();
  const { run, pending, toast } = useAction();
  const [open, setOpen] = useState<string | null>(null);
  const { event: ev, entries, stages, games, people } = view;
  const live = ev.status === "live", done = ev.status === "done";

  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => { if (!document.hidden && !open) router.refresh(); }, 4000);
    return () => clearInterval(t);
  }, [live, open, router]);

  const rounds = stages.filter((s) => s.kind === "ladder");
  const current = rounds.at(-1);
  const now = current ? games.filter((g) => g.stageNo === current.no && g.status !== "void").sort((a, b) => a.net - b.net) : [];
  const scored = now.filter((g) => g.status === "done").length;
  const here = entries.filter((e) => e.state === "here").map((e) => e.playerId);
  const openGame = games.find((g) => g.id === open) ?? null;
  const playingNow = new Set(now.flatMap((g) => [...g.a, ...g.b]));

  return (
    <main>
      {toast}
      <header className="px-5 pt-[calc(14px+env(safe-area-inset-top))] pb-3">
        <div className="flex items-center justify-between">
          <Link href="/?all=1" className="spk-press text-[13px] font-bold text-muted">← All events</Link>
          {live ? <LiveBadge /> : done ? <span className="text-[11px] font-bold uppercase tracking-[.14em] text-gold">Finished</span> : <span className="text-[11px] font-bold uppercase tracking-[.14em] text-accent">{fmtDate(ev.startsAt)}</span>}
        </div>
        <h1 className="mt-3 text-[28px] font-black leading-[1.05] tracking-[-.02em]">{ev.title}</h1>
      </header>

      {done && (
        <div className="px-4 pb-4">
          <Link href={`/e/${ev.id}/recap`} className="spk-press flex items-center gap-3 rounded-2xl bg-gradient-to-r from-accent to-[#9be15d] p-4 text-ink">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink text-accent" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            </span>
            <span className="text-[17px] font-black">Watch the day back</span>
          </Link>
        </div>
      )}

      {!current && !done && <Waiting view={view} me={me} />}

      {current && (
        <div className="px-4 pb-6">
          <div className="mb-3 flex items-baseline justify-between px-1">
            <span className="text-[13px] font-black uppercase tracking-[.16em] text-muted">Round {rounds.length}</span>
            {live && <span className="text-[12.5px] font-bold text-dim">{scored === now.length ? "Next round coming up…" : `${scored} of ${now.length} nets in`}</span>}
          </div>
          <LayoutGroup>
            <div className="grid gap-2.5">
              {now.map((g) => <NetCourt key={g.net} g={g} nets={now.length} people={people} live={live} onTap={() => setOpen(g.id)} />)}
            </div>
            {current.sitting.length > 0 && (
              <div className="mt-3 flex items-center gap-3 rounded-2xl border border-dashed border-white/10 px-4 py-3">
                <span className="shrink-0 text-[11px] font-black uppercase tracking-[.14em] text-dim">Sitting out</span>
                <div className="flex flex-wrap gap-2">
                  {current.sitting.map((id) => <Face key={id} id={id} p={people[id]} dim />)}
                </div>
              </div>
            )}
          </LayoutGroup>
          <Link href="/players" className="mt-4 block text-center text-[13px] font-bold text-dim">Ratings and the full ladder →</Link>
        </div>
      )}

      {org && <Organiser view={view} roster={roster} here={here} playingNow={playingNow} run={run} pending={pending} />}

      <AnimatePresence>
        {openGame && <NetSheet key={openGame.id} g={openGame} nets={Math.max(1, games.filter((x) => x.stageNo === openGame.stageNo && x.status !== "void").length)} people={people} to={ev.groupTo} me={me} org={org} candidates={here.filter((id) => !playingNow.has(id))} onClose={() => { setOpen(null); router.refresh(); }} />}
      </AnimatePresence>
    </main>
  );
}

/** One face that slides to its new net when the round changes (shared layout id). */
function Face({ id, p, size = 40, dim = false, badge }: { id: string; p?: PlayerLite; size?: number; dim?: boolean; badge?: "up" | "down" }) {
  return (
    <motion.div layoutId={`face-${id}`} transition={SOFT} className="relative flex flex-col items-center">
      <Avatar p={p} size={size} dim={dim} />
      {badge && (
        <span className={`absolute -right-1 -top-1 flex h-[18px] w-[18px] items-center justify-center rounded-full text-[11px] font-black ${badge === "up" ? "bg-win text-ink" : "bg-loss text-ink"}`} aria-label={badge === "up" ? "going up" : "going down"}>
          {badge === "up" ? "↑" : "↓"}
        </span>
      )}
    </motion.div>
  );
}

/** A net as a little court: the net number on the left, each pair either side of the net, and
 *  once it's scored, the winners lit with ↑ and the losers dimmed with ↓. */
function NetCourt({ g, nets, people, live, onTap }: { g: Game; nets: number; people: Record<string, PlayerLite>; live: boolean; onTap: () => void }) {
  const done = g.status === "done";
  const aWon = done && g.scoreA! > g.scoreB!;
  const side = (ids: string[], won: boolean, right: boolean) => (
    <div className={`flex min-w-0 flex-1 flex-col gap-1.5 ${right ? "items-end" : "items-start"}`}>
      <div className={`flex gap-1.5 ${right ? "flex-row-reverse" : ""}`}>
        {ids.map((id) => <Face key={id} id={id} p={people[id]} size={38} dim={done && !won} badge={done ? (won ? (g.net === 1 ? undefined : "up") : g.net === nets ? undefined : "down") : undefined} />)}
      </div>
      <span className={`w-full truncate text-[12.5px] font-bold ${right ? "text-right" : ""} ${done ? (won ? "text-fg" : "text-dim") : "text-fg/85"}`}>{ids.map((id) => people[id]?.name ?? "?").join(" & ")}</span>
    </div>
  );
  return (
    <motion.button
      layout transition={SOFT} whileTap={{ scale: 0.98 }} onClick={onTap}
      className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left ${done ? "border-white/[.05] bg-surface/60" : g.net === 1 ? "border-accent/30 bg-accent/[.06]" : "border-white/[.07] bg-surface"}`}
      aria-label={`Net ${g.net}${done ? `, ${g.scoreA}–${g.scoreB}` : ", tap to score"}`}
    >
      <div className="flex w-9 shrink-0 flex-col items-center">
        <span className={`font-mono text-[24px] font-black leading-none ${g.net === 1 ? "text-accent" : "text-fg"}`}>{g.net}</span>
        <span className="mt-1 text-[8.5px] font-black uppercase tracking-[.12em] text-dim">{g.net === 1 ? "Top" : g.net === nets ? "Bottom" : "Net"}</span>
      </div>
      {side(g.a, aWon, false)}
      <div className="flex w-14 shrink-0 flex-col items-center">
        {done ? (
          <span className="tnum font-mono text-[15px] font-black"><span className={aWon ? "text-accent" : "text-dim"}>{g.scoreA}</span><span className="text-dimmer">–</span><span className={!aWon ? "text-accent" : "text-dim"}>{g.scoreB}</span></span>
        ) : (
          <span className={`flex h-12 w-12 items-center justify-center rounded-full border-2 ${live ? "spk-live border-accent/70 text-accent" : "border-white/15 text-dim"}`} aria-hidden="true">
            <span className="h-6 w-6 rounded-full border border-current" />
          </span>
        )}
        {!done && live && <span className="mt-1 text-[9px] font-black uppercase tracking-[.1em] text-accent">Score</span>}
      </div>
      {side(g.b, done && !aWon, true)}
    </motion.button>
  );
}

/** Before it starts: who's coming, and where check-in lives. */
function Waiting({ view, me }: { view: EventView; me: string | null }) {
  const coming = view.entries.filter((e) => e.state !== "out");
  return (
    <Section title={`Coming · ${coming.length}`}>
      <div className={`${card} p-4`}>
        <div className="flex flex-wrap gap-2">
          {coming.map((e) => (
            <span key={e.playerId} className="flex items-center gap-1.5 rounded-full bg-panel py-1 pl-1 pr-3 text-[13px] font-semibold"><Avatar p={view.people[e.playerId]} size={22} />{view.people[e.playerId]?.name}{e.state === "here" && <span className="text-accent">✓</span>}</span>
          ))}
        </div>
        <p className="mt-3 text-[13.5px] leading-relaxed text-muted">Everyone starts on a net by rating. Win and you go up, lose and you go down, with a new partner every game.</p>
        <Link href="/me" className={`${btnPrimary} mt-3 w-full`}>{me ? "Check in on Me" : "Sign up to play"}</Link>
      </div>
    </Section>
  );
}

/** Tap a net: score it (tap the winners, slide the score), then see the result right here: who's
 *  going up and down, and everyone's ±. A scored net opens straight to its result. */
function NetSheet({ g, nets, people, to, me, org, candidates, onClose }: { g: Game; nets: number; people: Record<string, PlayerLite>; to: number; me: string | null; org: boolean; candidates: string[]; onClose: () => void }) {
  const { run, pending, toast } = useAction();
  const [res, setRes] = useState<Moments | null>(null);
  const [loading, setLoading] = useState(g.status === "done");
  const [swapOut, setSwapOut] = useState<string | null>(null);
  const load = async (id: string) => { setLoading(true); try { setRes(await resultOf(id)); } finally { setLoading(false); } };
  useEffect(() => { if (g.status === "done") load(g.id); }, [g.id, g.status]);

  const slide = res?.slides[0];
  const match = slide && (slide.kind === "game" || slide.kind === "match") ? slide.match : null;
  return (
    <motion.div className="fixed inset-0 z-50 flex items-end bg-black/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      {toast}
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={SOFT}
        className="mx-auto w-full max-w-[480px] rounded-t-3xl border-t border-white/[.08] bg-surface p-5 pb-[calc(20px+env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <span className="text-[13px] font-black uppercase tracking-[.16em] text-accent">Net {g.net}</span>
          <button onClick={onClose} className="spk-press -mr-2 p-2 text-muted" aria-label="Close">✕</button>
        </div>

        {match ? (
          <div>
            <div className="text-[22px] font-black leading-tight">
              {(match.scoreA > match.scoreB ? match.a : match.b).map((id) => people[id]?.name ?? "?").join(" & ")} win{" "}
              <span className="tnum font-mono text-accent">{Math.max(match.scoreA, match.scoreB)}–{Math.min(match.scoreA, match.scoreB)}</span>
            </div>
            <div className="mt-4 grid gap-2">
              {[...match.lines].sort((x, y) => Number(y.won) - Number(x.won)).map((l) => {
                const move = l.won ? (g.net === 1 ? "Stays on top" : `Up to Net ${g.net - 1}`) : g.net >= nets ? "Stays at the bottom" : `Down to Net ${g.net + 1}`;
                return (
                  <motion.div key={l.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={SOFT} className="flex items-center gap-3 rounded-xl bg-panel px-3 py-2.5">
                    <Avatar p={people[l.id]} size={32} dim={!l.won} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14.5px] font-bold">{people[l.id]?.name}</span>
                      <span className={`block text-[12px] font-bold ${l.won ? "text-win" : "text-loss"}`}>{l.won ? "↑" : "↓"} {move}</span>
                    </span>
                    {l.placingGame != null
                      ? <span className="shrink-0 text-[12px] font-bold text-dim">🐣 {l.placingGame}/{PROV_N}</span>
                      : <span className={`tnum shrink-0 font-mono text-[17px] font-black ${l.delta >= 0 ? "text-accent" : "text-muted"}`}>{signed(l.delta)}</span>}
                  </motion.div>
                );
              })}
            </div>
            {res?.ladder && (
              <p className="mt-4 text-center text-[13px] font-semibold text-muted">
                {res.ladder.next ? `Round ${res.ladder.round} is up. Check the nets.` : res.ladder.waiting.length ? `Waiting on Net ${res.ladder.waiting.join(", ")}. Everyone moves when they're in.` : ""}
              </p>
            )}
            <button onClick={onClose} className={`${btnPrimary} mt-4 h-12 w-full`}>{res?.ladder?.next ? "See the nets" : "Done"}</button>
            {org && g.status === "done" && !res?.ladder?.next && (
              <button disabled={pending} onClick={() => run(() => clearScore(g.id), "Score cleared", (r) => r.ok && onClose())} className={`${btnQuiet} mt-1 w-full`}>Clear this score</button>
            )}
          </div>
        ) : loading ? (
          <div className="py-10 text-center text-[14px] text-muted">Loading…</div>
        ) : !me ? (
          <Link href="/me" className={`${btnPrimary} w-full`}>Sign in to score</Link>
        ) : (
          <>
            <ScoreBoxes game={g} to={to} canScore people={people} onOpen={() => {}} onSaved={load} />
            {org && (
              <div className="mt-4 border-t border-white/[.06] pt-3">
                {!swapOut ? (
                  <>
                    <div className="mb-2 text-[12px] font-bold text-dim">Someone has to drop out? Tap them to swap someone in.</div>
                    <div className="flex flex-wrap gap-2">
                      {[...g.a, ...g.b].map((id) => (
                        <button key={id} onClick={() => setSwapOut(id)} className="spk-press flex items-center gap-1.5 rounded-full bg-panel py-1 pl-1 pr-3 text-[13px] font-semibold"><Avatar p={people[id]} size={22} />{people[id]?.name}</button>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mb-2 text-[12px] font-bold text-dim">Who takes {people[swapOut]?.name}&apos;s place?</div>
                    <div className="flex flex-wrap gap-2">
                      {candidates.length ? candidates.map((id) => (
                        <button key={id} disabled={pending} onClick={() => run(() => swapLadderPlayer(g.id, swapOut, id), "Swapped", (r) => r.ok && onClose())} className="spk-press flex items-center gap-1.5 rounded-full bg-panel py-1 pl-1 pr-3 text-[13px] font-semibold"><Avatar p={people[id]} size={22} />{people[id]?.name}</button>
                      )) : <span className="text-[13px] text-muted">Nobody's free. Check someone in first.</span>}
                      <button onClick={() => setSwapOut(null)} className="text-[13px] font-bold text-muted">Cancel</button>
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

type Run = ReturnType<typeof useAction>["run"];

function Organiser({ view, roster, here, playingNow, run, pending }: { view: EventView; roster: PlayerLite[]; here: string[]; playingNow: Set<string>; run: Run; pending: boolean }) {
  const { event: ev, entries, stages, games, people } = view;
  const [name, setName] = useState("");
  const [confirm, setConfirm] = useState<string | null>(null);
  const twice = (key: string, fn: () => void) => { if (confirm === key) { setConfirm(null); fn(); } else { setConfirm(key); setTimeout(() => setConfirm((c) => (c === key ? null : c)), 3500); } };
  const current = stages.filter((s) => s.kind === "ladder").at(-1);
  const unplayed = current ? games.filter((g) => g.stageNo === current.no && g.status === "todo").length : 0;
  const used = netsFor(here.length, ev.nets);
  const save = (patch: Partial<{ nets: number; groupTo: number }>, msg: string) =>
    run(() => updateEvent(ev.id, { title: ev.title, startsAt: new Date(ev.startsAt).toISOString(), location: ev.location, notes: ev.notes, nets: patch.nets ?? ev.nets, groupTo: patch.groupTo ?? ev.groupTo, finalTo: ev.finalTo }), msg);
  const sorted = [...entries].sort((a, b) => (people[a.playerId]?.name ?? "").localeCompare(people[b.playerId]?.name ?? ""));

  if (ev.status === "done") {
    return (
      <Section title="Organiser">
        <button disabled={pending} onClick={() => run(() => reopenEvent(ev.id), "Event reopened")} className={btnGhost}>Reopen</button>
      </Section>
    );
  }
  return (
    <Section title="Organiser">
      <div className="grid gap-2">
        <div className={`${card} p-4`}>
          <p className="text-[13px] text-muted">{here.length} here · {used ? `${used} net${used === 1 ? "" : "s"}` : "need 4"}{used && here.length > used * 4 ? ` · ${here.length - used * 4} sit out in turn` : ""}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {!current && <button disabled={pending || here.length < 4} onClick={() => run(() => startLadder(ev.id), "Ladder started")} className={btnPrimary}>Start the ladder</button>}
            {current && unplayed > 0 && <button disabled={pending} onClick={() => twice("next", () => run(() => nextLadderRound(ev.id), "Next round drawn"))} className={btnGhost}>{confirm === "next" ? "Tap again: skip unscored" : "Next round now"}</button>}
            {current && <button disabled={pending} onClick={() => twice("undo", () => run(() => undoStage(ev.id), "Round taken back"))} className={btnQuiet}>{confirm === "undo" ? "Tap again to undo" : "Undo round"}</button>}
            {current && <button disabled={pending} onClick={() => twice("finish", () => run(() => finishEvent(ev.id), "Day finished"))} className={btnQuiet}>{confirm === "finish" ? "Tap again to finish" : "Finish the day"}</button>}
            {!current && <button disabled={pending} onClick={() => twice("delete", () => run(() => deleteEvent(ev.id), "Event deleted", (r) => { if (r.ok) location.href = "/?all=1"; }))} className={btnQuiet}>{confirm === "delete" ? "Tap again to delete" : "Delete event"}</button>}
          </div>
        </div>
        <Disclosure title="Games and nets" teaser={`to ${ev.groupTo} · ${ev.nets} nets`}>
          <div className="grid gap-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13.5px] font-semibold text-muted">Games to</span>
              <div className="flex rounded-lg border border-white/[.06] bg-panel p-0.5 text-[13px] font-bold">
                {GAME_LENGTHS.map((n) => (
                  <button key={n} disabled={pending || ev.groupTo === n} onClick={() => save({ groupTo: n }, `Games now to ${n}`)} aria-pressed={ev.groupTo === n} className={`tnum min-w-10 rounded-md px-2 py-1.5 ${ev.groupTo === n ? "bg-accent text-ink" : "text-muted"}`}>{n}</button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13.5px] font-semibold text-muted">Nets set up</span>
              <div className="flex items-center gap-2">
                <button disabled={pending || ev.nets <= 1} onClick={() => save({ nets: ev.nets - 1 }, `${ev.nets - 1} nets`)} className={`${btnGhost} min-h-9 w-9 px-0`} aria-label="One fewer net">−</button>
                <span className="tnum w-6 text-center text-[16px] font-black">{ev.nets}</span>
                <button disabled={pending || ev.nets >= 8} onClick={() => save({ nets: ev.nets + 1 }, `${ev.nets + 1} nets`)} className={`${btnGhost} min-h-9 w-9 px-0`} aria-label="One more net">+</button>
              </div>
            </div>
          </div>
        </Disclosure>
        <Disclosure title="Check-in" teaser={`${here.length} here`} defaultOpen={!current}>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) run(() => addWalkIn(ev.id, name), `${name.trim()} checked in`, (r) => r.ok && setName("")); }}>
            <input className={input} list="ladder-roster" value={name} onChange={(e) => setName(e.target.value)} placeholder="Add someone by name" aria-label="Add someone by name" />
            <datalist id="ladder-roster">{roster.map((r) => <option key={r.id} value={r.name} />)}</datalist>
            <button disabled={pending || !name.trim()} className={`${btnPrimary} shrink-0`}>Add</button>
          </form>
          <div className="mt-3 divide-y divide-white/[.04]">
            {sorted.map((e) => (
              <div key={e.playerId} className="flex items-center gap-2.5 py-2">
                <Avatar p={people[e.playerId]} size={26} dim={e.state === "out"} />
                <span className={`min-w-0 flex-1 truncate text-[14px] font-semibold ${e.state === "out" ? "text-dim" : ""}`}>{people[e.playerId]?.name}{playingNow.has(e.playerId) && e.state === "out" && <span className="ml-1.5 text-[11px] font-bold text-loss">swap them out of their net</span>}</span>
                <div className="flex rounded-lg border border-white/[.06] bg-panel p-0.5 text-[12px] font-bold">
                  {(["here", "out"] as const).map((s) => (
                    <button key={s} disabled={pending} onClick={() => run(() => setEntry(ev.id, e.playerId, s))} className={`rounded-md px-2.5 py-1.5 ${e.state === s ? (s === "out" ? "bg-loss text-ink" : "bg-accent text-ink") : "text-muted"}`} aria-pressed={e.state === s}>
                      {s === "here" ? "Here" : "Out"}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Disclosure>
      </div>
    </Section>
  );
}
