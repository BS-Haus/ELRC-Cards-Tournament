"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { startLadder, nextLadderRound, undoStage, finishEvent, reopenEvent, deleteEvent, updateEvent, setEntry, addWalkIn } from "@/app/actions";
import { useAction } from "@/components/useAction";
import { CheckIn, LiveBadge } from "@/components/CheckIn";
import { ScoreBoxes } from "@/components/ScoreBoxes";
import { ScoreSheet } from "@/components/ScoreSheet";
import { ResultCard, Disclosure } from "@/components/kit";
import { Avatar, Section, card, btnPrimary, btnGhost, btnQuiet, input, fmtDate, LevelPill } from "@/components/ui";
import { roundsFrom, roundDone, netsFor } from "@/lib/netLadder";
import { myCheckIn } from "@/lib/views";
import { tierOfRating } from "@/lib/levels";
import { PROV_N } from "@/lib/standings";
import type { EventView, PlayerLite, LadderDayRow } from "@/lib/data";

// A ladder event (src/lib/netLadder.ts): this round's nets, top to bottom, each scored right on its
// card; who's sitting out; today's table; and the organiser's few buttons. The next round appears
// by itself when the last net's score goes in.

const GAME_LENGTHS = [11, 15, 17, 21];
const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n)}`;

export function LadderScreen({ view, me, org, roster, day }: { view: EventView; me: string | null; org: boolean; roster: PlayerLite[]; day: LadderDayRow[] }) {
  const router = useRouter();
  const { run, pending, toast } = useAction();
  const [open, setOpen] = useState<string | null>(null);
  const { event: ev, entries, stages, games, people } = view;
  const live = ev.status === "live", done = ev.status === "done";

  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => { if (!document.hidden && !open) router.refresh(); }, 5000);
    return () => clearInterval(t);
  }, [live, open, router]);

  const rounds = roundsFrom(stages, games);
  const ladderStages = stages.filter((s) => s.kind === "ladder");
  const current = ladderStages.at(-1);
  const now = current ? games.filter((g) => g.stageNo === current.no && g.status !== "void").sort((a, b) => a.net - b.net) : [];
  const nets = now.length;
  const here = entries.filter((e) => e.state === "here").map((e) => e.playerId);
  const myEntry = me ? myCheckIn(entries, games, me) : null;
  const openGame = games.find((g) => g.id === open) ?? null;
  const p = (id: string) => people[id];
  const names = (ids: string[]) => ids.map((id) => p(id)?.name ?? "?").join(" & ");

  return (
    <main>
      {toast}
      <header className="px-5 pt-[calc(14px+env(safe-area-inset-top))] pb-4">
        <div className="flex items-center justify-between">
          <Link href="/?all=1" className="spk-press text-[13px] font-bold text-muted">← All events</Link>
          <span className="text-[12px] font-bold uppercase tracking-[.12em] text-dim">Ladder · to {ev.groupTo}</span>
        </div>
        <div className="mt-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.14em]">
          {live ? <LiveBadge /> : done ? <span className="text-gold">Finished</span> : <span className="text-accent">Coming up</span>}
        </div>
        <h1 className="mt-1 text-[28px] font-black leading-[1.05] tracking-[-.02em] text-balance">{ev.title}</h1>
        <p className="mt-1.5 text-[14px] text-muted">{fmtDate(ev.startsAt)}{ev.location ? ` · ${ev.location}` : ""}</p>
        {ev.notes && <p className="mt-2 whitespace-pre-line text-[14px] leading-relaxed text-fg/80">{ev.notes}</p>}
      </header>

      {done && rounds.length > 0 && (
        <div className="px-4 pb-5">
          <Link href={`/e/${ev.id}/recap`} className="spk-press flex items-center gap-3 rounded-2xl bg-gradient-to-r from-accent to-[#9be15d] p-4 text-ink">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink text-accent" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            </span>
            <span className="min-w-0">
              <span className="block text-[17px] font-black">Watch the day back</span>
              <span className="block text-[13px] font-semibold opacity-70">Your day, and who earned the most</span>
            </span>
          </Link>
        </div>
      )}

      {!done && <CheckIn me={me} state={myEntry} eventId={ev.id} started={live} />}

      {!current && !done && (
        <Section title={`Coming · ${entries.filter((e) => e.state !== "out").length}`}>
          <div className={`${card} p-4`}>
            <div className="flex flex-wrap gap-2">
              {entries.filter((e) => e.state !== "out").map((e) => (
                <span key={e.playerId} className="flex items-center gap-1.5 rounded-full bg-panel py-1 pl-1 pr-3 text-[13px] font-semibold"><Avatar p={p(e.playerId)} size={22} />{p(e.playerId)?.name}{e.state === "here" && <span className="text-accent">✓</span>}</span>
              ))}
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-muted">How it works: everyone's put on a net by rating, then win and you go up a net, lose and you go down. A new partner every game.</p>
          </div>
        </Section>
      )}

      {current && (
        <Section title={`Round ${ladderStages.length}`} aside={live ? (roundDone(rounds.at(-1)!) ? "Drawing the next round…" : "Tap the winners, slide the score") : undefined}>
          <div className="grid gap-2.5">
            {now.map((g) => {
              const scored = g.status === "done";
              return (
                <div key={g.id} className={`${card} overflow-hidden`}>
                  <div className="p-4">
                    <button onClick={() => setOpen(g.id)} className="spk-press flex w-full items-center justify-between text-[12px] font-bold uppercase tracking-[.1em]">
                      <span className={g.net === 1 ? "text-accent" : "text-muted"}>Net {g.net}{g.net === 1 ? " · top" : g.net === nets ? " · bottom" : ""}</span>
                      <span className="text-dim">{scored ? "Edit ›" : "More ›"}</span>
                    </button>
                    <div className="mt-3">
                      {scored || !live
                        ? <ResultCard a={g.a} b={g.b} scoreA={g.scoreA} scoreB={g.scoreB} people={people} flat />
                        : <ScoreBoxes key={g.id} game={g} to={ev.groupTo} canScore={!!me} onOpen={() => setOpen(g.id)} people={people} />}
                    </div>
                  </div>
                  {scored && (
                    <div className="border-t border-white/[.05] bg-panel px-4 py-2 text-[12.5px] text-muted">
                      <span className="text-win">↑</span> {names(g.scoreA! > g.scoreB! ? g.a : g.b)} {g.net === 1 ? "stay on top" : "go up"} · <span className="text-loss">↓</span> {names(g.scoreA! > g.scoreB! ? g.b : g.a)} {g.net === nets ? "stay" : "go down"}
                    </div>
                  )}
                </div>
              );
            })}
            {current.sitting.length > 0 && (
              <div className={`${card} p-3.5 text-[13.5px] text-muted`}>
                <b className="text-fg">Sitting out:</b> {names(current.sitting)}. Back in next round.
              </div>
            )}
          </div>
        </Section>
      )}

      {day.length > 0 && (current || done) && (
        <Section title="Today" aside={<Link href="/players" className="font-bold text-accent">Full ladder →</Link>}>
          <div className={`${card} overflow-hidden`}>
            {day.map((r, i) => (
              <Link key={r.id} href={`/p/${r.id}`} className="spk-press flex items-center gap-3 border-t border-white/[.04] px-4 py-2.5 first:border-t-0">
                <span className="w-5 shrink-0 text-center font-mono text-[13px] font-bold text-dim">{r.rating != null ? i + 1 : "🐣"}</span>
                <Avatar p={p(r.id)} size={30} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-bold">{p(r.id)?.name ?? "Someone"}</span>
                  <span className="mt-0.5 flex items-center gap-2">
                    {r.rating != null ? <LevelPill level={tierOfRating(r.rating).level} /> : <span className="text-[11.5px] font-semibold text-dim">Placing · {r.placed}/{PROV_N}</span>}
                    <span className="font-mono text-[11px] text-dim">{r.w}–{r.l}</span>
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-mono text-[16px] font-extrabold">{r.rating ?? "–"}</span>
                  {r.today != null && <span className={`block font-mono text-[11px] font-bold ${r.today >= 0 ? "text-win" : "text-loss"}`}>{signed(r.today)}</span>}
                </span>
              </Link>
            ))}
          </div>
        </Section>
      )}

      {rounds.length > 1 && (
        <Section title="Earlier rounds">
          <div className="grid gap-2">
            {ladderStages.slice(0, -1).reverse().map((s, i) => (
              <Disclosure key={s.id} title={`Round ${ladderStages.length - 1 - i}`} teaser={s.sitting.length ? `${s.sitting.length} sat out` : undefined}>
                <div className="grid gap-2">
                  {games.filter((g) => g.stageNo === s.no && g.status !== "void").sort((a, b) => a.net - b.net).map((g) => (
                    <ResultCard key={g.id} a={g.a} b={g.b} scoreA={g.scoreA} scoreB={g.scoreB} people={people} left={`Net ${g.net}`} onClick={() => setOpen(g.id)} />
                  ))}
                </div>
              </Disclosure>
            ))}
          </div>
        </Section>
      )}

      {org && <Organiser view={view} roster={roster} here={here} run={run} pending={pending} />}

      {openGame && (
        <ScoreSheet game={openGame} people={people} to={ev.groupTo} canScore={!!me} org={org} candidates={[]} out={new Set()} onClose={() => setOpen(null)} />
      )}
    </main>
  );
}

type Run = ReturnType<typeof useAction>["run"];

function Organiser({ view, roster, here, run, pending }: { view: EventView; roster: PlayerLite[]; here: string[]; run: Run; pending: boolean }) {
  const { event: ev, entries, stages, games, people } = view;
  const [name, setName] = useState("");
  const [confirm, setConfirm] = useState<string | null>(null);
  const twice = (key: string, fn: () => void) => { if (confirm === key) { setConfirm(null); fn(); } else { setConfirm(key); setTimeout(() => setConfirm((c) => (c === key ? null : c)), 3500); } };
  const current = stages.filter((s) => s.kind === "ladder").at(-1);
  const done = ev.status === "done";
  const unplayed = current ? games.filter((g) => g.stageNo === current.no && g.status === "todo").length : 0;
  const used = netsFor(here.length, ev.nets);
  const save = (patch: Partial<{ nets: number; groupTo: number }>, msg: string) =>
    run(() => updateEvent(ev.id, { title: ev.title, startsAt: new Date(ev.startsAt).toISOString(), location: ev.location, notes: ev.notes, nets: patch.nets ?? ev.nets, groupTo: patch.groupTo ?? ev.groupTo, finalTo: ev.finalTo }), msg);
  const sorted = [...entries].sort((a, b) => (people[a.playerId]?.name ?? "").localeCompare(people[b.playerId]?.name ?? ""));

  if (done) {
    return (
      <Section title="Organiser">
        <button disabled={pending} onClick={() => run(() => reopenEvent(ev.id), "Event reopened")} className={btnGhost}>Reopen</button>
      </Section>
    );
  }
  return (
    <Section title="Organiser">
      <div className={`${card} grid gap-3 p-4`}>
        <p className="text-[13.5px] leading-relaxed text-muted">
          {here.length} here → {used ? `${used} net${used === 1 ? "" : "s"} of 4` : "need 4 to start"}{used && here.length > used * 4 ? `, ${here.length - used * 4} sitting out each round (in turn)` : ""}.
          {current ? (unplayed ? ` ${unplayed} net${unplayed === 1 ? "" : "s"} still to score this round.` : " The next round draws itself when the last score goes in.") : " Check people in, then start."}
        </p>
        <div className="flex flex-wrap gap-2">
          {!current && <button disabled={pending || here.length < 4} onClick={() => run(() => startLadder(ev.id), "Ladder started")} className={btnPrimary}>Start the ladder</button>}
          {current && unplayed > 0 && <button disabled={pending} onClick={() => twice("next", () => run(() => nextLadderRound(ev.id), "Next round drawn"))} className={btnGhost}>{confirm === "next" ? "Tap again: skip unscored nets" : "Next round now"}</button>}
          {current && <button disabled={pending} onClick={() => twice("undo", () => run(() => undoStage(ev.id), "Round taken back"))} className={btnQuiet}>{confirm === "undo" ? "Tap again to undo" : "Undo last round"}</button>}
          {current && <button disabled={pending} onClick={() => twice("finish", () => run(() => finishEvent(ev.id), "Day finished"))} className={btnQuiet}>{confirm === "finish" ? "Tap again to finish" : "Finish the day"}</button>}
          {!current && <button disabled={pending} onClick={() => twice("delete", () => run(() => deleteEvent(ev.id), "Event deleted", (r) => { if (r.ok) location.href = "/?all=1"; }))} className={btnQuiet}>{confirm === "delete" ? "Tap again to delete" : "Delete event"}</button>}
        </div>
      </div>

      <div className="mt-2 grid gap-2">
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
            <p className="text-[12.5px] text-dim">Win by 2. Changes apply from the next game; scores already in stay.</p>
          </div>
        </Disclosure>

        <Disclosure title="Check-in" teaser={`${here.length} here`} defaultOpen={!current}>
          <p className="text-[13px] text-muted">Mark people <b className="text-fg">here</b> as they arrive: they join from the next round, on the net their rating puts them. Mark someone <b className="text-fg">out</b> when they leave.</p>
          <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) run(() => addWalkIn(ev.id, name), `${name.trim()} checked in`, (r) => r.ok && setName("")); }}>
            <input className={input} list="ladder-roster" value={name} onChange={(e) => setName(e.target.value)} placeholder="Add someone by name" aria-label="Add someone by name" />
            <datalist id="ladder-roster">{roster.map((r) => <option key={r.id} value={r.name} />)}</datalist>
            <button disabled={pending || !name.trim()} className={`${btnPrimary} shrink-0`}>Add</button>
          </form>
          <div className="mt-3 divide-y divide-white/[.04]">
            {sorted.map((e) => (
              <div key={e.playerId} className="flex items-center gap-2.5 py-2">
                <Avatar p={people[e.playerId]} size={26} dim={e.state === "out"} />
                <span className={`min-w-0 flex-1 truncate text-[14px] font-semibold ${e.state === "out" ? "text-dim" : ""}`}>{people[e.playerId]?.name}</span>
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
