"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { setMyEntry, setEntry, addWalkIn, drawStage, undoStage, finishEvent, reopenEvent, deleteEvent, updateEvent, addDecider } from "@/app/actions";
import { useAction } from "@/components/useAction";
import { ScoreSheet } from "@/components/ScoreSheet";
import { EventPhotos } from "@/components/EventPhotos";
import { Avatar, PlayerLink, Section, card, btnPrimary, btnGhost, btnQuiet, input, tierColor, fmtDate } from "@/components/ui";
import { netQueues, needsSub, splitSizes, stageMinutes, gamesEachForSize, isDone, drawPool, gameLabel, deciderPoints, DECIDER_TO, type Game, type StageKind, finalWinTitle } from "@/lib/cards";
import { groupsOf, finalsOf, eventStandings, type GroupView } from "@/lib/views";
import type { EventView, PlayerLite, EntryState } from "@/lib/data";

const STAGE_TITLE: Record<StageKind, string> = { random: "Random groups", seeded: "Seeded groups", final: "Finals" };

export function EventScreen({ view, me, org, roster }: { view: EventView; me: string | null; org: boolean; roster: PlayerLite[] }) {
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

  const p = (id: string) => people[id];
  // Who's in the tournament right now: checked in, plus everyone from the last stage not marked
  // out (drawPool). The same list the next draw takes, so the page never disagrees with it.
  const here = useMemo(() => drawPool(entries, games), [entries, games]);
  const inPool = new Set(here);
  const rawEntry = entries.find((e) => e.playerId === me)?.state ?? null;
  const myEntry = me && rawEntry !== "out" && inPool.has(me) ? "here" : rawEntry;
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
  const standings = useMemo(() => eventStandings(view), [view]);
  const openGame = games.find((g) => g.id === open) ?? null;
  const live = ev.status === "live";
  const done = ev.status === "done";

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
          <Link href="/" className="spk-press text-[13px] font-bold text-muted">← Events</Link>
          <button onClick={share} className="spk-press rounded-full border border-white/[.08] bg-raised px-3.5 py-1.5 text-[13px] font-bold">Share link</button>
        </div>
        <div className="mt-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.14em]">
          {live ? <><span className="spk-live h-2 w-2 rounded-full bg-accent" /><span className="text-accent">Live</span></> : done ? <span className="text-gold">Finished</span> : <span className="text-accent">Coming up</span>}
        </div>
        <h1 className="mt-1 text-[28px] font-black leading-[1.05] tracking-[-.02em] text-balance">{ev.title}</h1>
        <p className="mt-1.5 text-[14px] text-muted">{fmtDate(ev.startsAt)}{ev.location ? ` · ${ev.location}` : ""}</p>
        {ev.notes && <p className="mt-2 whitespace-pre-line text-[14px] leading-relaxed text-fg/80">{ev.notes}</p>}
      </header>

      {!done && <YouBar me={me} state={myEntry} eventId={ev.id} started={!!current} run={run} pending={pending} />}

      {crown && (
        <button onClick={() => setCrown(null)} className="spk-crown fixed inset-x-4 top-[calc(16px+env(safe-area-inset-top))] z-40 mx-auto flex max-w-[448px] items-center gap-3 rounded-3xl p-4 text-left shadow-2xl" style={{ background: tierColor(crown.tier), color: "#0c0e10" }} aria-live="polite">
          <span className="text-[34px]" aria-hidden="true">🏆</span>
          <span className="min-w-0">
            <span className="block text-[12px] font-black uppercase tracking-[.16em] opacity-70">{crown.tier} final</span>
            <span className="block truncate text-[20px] font-black">{crown.id === me ? `You win the ${crown.tier} final!` : `${p(crown.id)?.name ?? "Someone"} wins the ${crown.tier} final!`}</span>
          </span>
        </button>
      )}

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
          {iPlayed && (
            <Link href={`/e/${ev.id}/recap?p=${me}`} className="spk-press mt-2 flex items-center justify-between rounded-2xl border border-white/[.08] bg-surface px-4 py-3">
              <span className="text-[14.5px] font-bold">Your review of the day</span>
              <span className="text-[13px] font-bold text-accent">▶ Watch</span>
            </Link>
          )}
        </div>
      )}

      {done && finals && <Podium groups={finals.groups} people={people} />}

      {(live || done) && <EventPhotos eventId={ev.id} photos={view.photos} me={me} org={org} />}

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

      {live && queues.some((q) => q.length) && (
        <Section title="On the nets" aside="Tap a game to enter the score">
          <div className="grid gap-2.5">
            {queues.map((q, i) => (
              <NetCard key={i} net={i + 1} now={q[0]} next={q[1]} people={people} out={out} onOpen={setOpen} />
            ))}
          </div>
        </Section>
      )}

      {current && (
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

      {!current && <WhoIsIn view={view} />}

      {org && !done && <OrganiserPanel view={view} roster={roster} run={run} pending={pending} waiting={waiting} pool={inPool} />}

      {current && standings.some((r) => r.gp) && (
        <Section title="Standings" aside="Group stages · win % then +/−">
          <Standings rows={standings} people={people} me={me} />
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

      {openGame && (
        <ScoreSheet
          game={openGame} people={people} to={openGame.decider ? DECIDER_TO : openGame.kind === "final" ? ev.finalTo : ev.groupTo} canScore={!!me} org={org}
          candidates={here.filter((id) => ![...openGame.a, ...openGame.b].includes(id) && !out.has(id))} out={out}
          onClose={() => setOpen(null)}
        />
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------------------------

type Run = ReturnType<typeof useAction>["run"];

function YouBar({ me, state, eventId, started, run, pending }: { me: string | null; state: EntryState | null; eventId: string; started: boolean; run: Run; pending: boolean }) {
  if (!me) {
    return (
      <div className="px-4 pb-6">
        <div className={`${card} flex items-center justify-between gap-3 p-4`}>
          <p className="text-[14px] text-muted">Make a profile to add yourself and enter scores. It&apos;s just your name and a 4-digit code.</p>
          <Link href={`/me?next=/e/${eventId}`} className={`${btnPrimary} shrink-0`}>Join</Link>
        </div>
      </div>
    );
  }
  const set = (s: EntryState, msg: string) => run(() => setMyEntry(eventId, s), msg);
  const label = state === "here" ? "You're checked in" : state === "going" ? "You're in" : state === "out" ? "You're out" : "Are you coming?";
  return (
    <div className="px-4 pb-6">
      <div className={`${card} p-4`}>
        <div className="text-[15px] font-extrabold">{label}</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {state !== "going" && state !== "here" && <button disabled={pending} onClick={() => set("going", "You're in. See you there!")} className={btnPrimary}>I&apos;m in</button>}
          {state !== "here" && <button disabled={pending} onClick={() => set("here", started ? "Checked in. You'll join the next stage" : "Checked in")} className={state === "going" ? btnPrimary : btnGhost}>I&apos;m here</button>}
          {state !== "out" && <button disabled={pending} onClick={() => set("out", started ? "Marked as left. Your remaining games will get a sub" : "No worries, you're off the list")} className={btnQuiet}>{started && state === "here" ? "I have to leave" : "Can't make it"}</button>}
        </div>
      </div>
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

function NetCard({ net, now, next, people, out, onOpen }: { net: number; now?: Game; next?: Game; people: Record<string, PlayerLite>; out: Set<string>; onOpen: (id: string) => void }) {
  if (!now) return (
    <div className={`${card} p-4 text-[14px] text-muted`}><b className="text-fg">Net {net}</b> · free</div>
  );
  return (
    <div className={`${card} overflow-hidden`}>
      <button onClick={() => onOpen(now.id)} className="spk-press block w-full p-4 text-left">
        <div className="flex items-center justify-between text-[12px] font-bold uppercase tracking-[.1em]">
          <span className="text-accent">Net {net} · on now</span>
          <span className="text-dim">{gameLabel(now)} · game {now.seq}</span>
        </div>
        <div className="mt-2.5 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-[16px] font-extrabold leading-tight">
          <span>{teamLine(now.a, people, now.subs, out)}</span>
          <span className="text-[12px] font-bold text-dim">vs</span>
          <span className="text-right">{teamLine(now.b, people, now.subs, out)}</span>
        </div>
        <div className="mt-3 rounded-xl bg-accent py-2.5 text-center text-[14px] font-black text-ink">Enter score</div>
      </button>
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
            ? `★ ${name(g.winner)} ${final ? `wins the ${g.name} final` : "tops the group"}${g.decider === "decided" ? ` on the decider, ${Math.max(...pts)}–${Math.min(...pts)} on points` : ""}`
            : g.decider === "playing"
              ? `Decider: ${tiedNames} play two games to ${DECIDER_TO}, swapping partners. Most points across both wins.`
              : g.decider === "level"
                ? `Still level after the decider (${pts[0]}–${pts[1]}). Play it again, or toss a coin.`
                : `Tied at the top: ${tiedNames}.${org ? "" : " The organiser can set up a decider."}`}
          {org && g.tied.length === 2 && (g.decider === "none" || g.decider === "level") && (
            <button disabled={pending} onClick={() => run(() => addDecider(eventId, g.stageNo, g.groupNo), "Decider added. It's next on the net")} className={`${btnPrimary} mt-2 w-full`}>
              {g.decider === "level" ? "Play the decider again" : "Play decider"}
            </button>
          )}
        </div>
      )}
      <table className="tnum w-full text-[14px]">
        <thead>
          <tr className="text-[10.5px] font-bold uppercase tracking-[.1em] text-dim">
            <th className="w-8 py-1 pl-4 text-left font-bold">#</th><th className="text-left font-bold">Player</th><th className="px-2 text-right font-bold">Pts</th><th className="px-2 text-right font-bold">W–L</th><th className="pr-4 pl-2 text-right font-bold">+/−</th>
          </tr>
        </thead>
        <tbody>
          {g.table.map((r, i) => {
            const pd = r.pf - r.pa;
            return (
              <tr key={r.id} className={`border-t border-white/[.04] ${r.id === me ? "bg-accent/[.06]" : ""}`}>
                <td className="py-2 pl-4 font-mono text-[12.5px] text-dim">{i + 1}</td>
                <td className="py-2"><span className="flex items-center gap-2"><Avatar p={people[r.id]} size={22} dim={out.has(r.id)} /><PlayerLink p={people[r.id]} className={`font-semibold ${out.has(r.id) ? "text-dim" : ""}`} />{out.has(r.id) && <span className="text-[11px] text-dim">left</span>}</span></td>
                <td className="px-2 text-right font-black">{r.w}</td>
                <td className="px-2 text-right text-num">{r.w}–{r.l}</td>
                <td className={`pr-4 pl-2 text-right font-mono text-[12.5px] ${pd > 0 ? "text-win" : pd < 0 ? "text-loss" : "text-dim"}`}>{r.gp ? (pd > 0 ? "+" : "") + pd : "–"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="mt-1 border-t border-white/[.05]">
        {g.games.map((x) => <GameRow key={x.id} g={x} people={people} out={out} onOpen={onOpen} />)}
      </div>
    </div>
  );
}

function GameRow({ g, people, out, onOpen }: { g: Game; people: Record<string, PlayerLite>; out: Set<string>; onOpen: (id: string) => void }) {
  const fin = isDone(g);
  const aWon = fin && g.scoreA! > g.scoreB!;
  return (
    <button onClick={() => onOpen(g.id)} className={`spk-press grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-white/[.03] px-4 py-2.5 text-left text-[13.5px] last:border-0 ${g.status === "void" ? "opacity-40" : ""}`}>
      <span className={aWon ? "font-bold" : "text-fg/85"}>{g.decider && <span className="mr-1.5 rounded bg-accent/15 px-1 py-0.5 text-[10px] font-bold uppercase tracking-[.08em] text-accent">Decider</span>}{teamLine(g.a, people, g.subs, out)}</span>
      <span className={`tnum min-w-[58px] rounded-lg px-2 py-1 text-center font-mono text-[13px] font-bold ${fin ? "bg-raised" : g.status === "void" ? "text-dim" : "border border-dashed border-white/15 text-dim"}`}>
        {fin ? `${g.scoreA}–${g.scoreB}` : g.status === "void" ? "skipped" : "score"}
      </span>
      <span className={`text-right ${fin && !aWon ? "font-bold" : "text-fg/85"}`}>{teamLine(g.b, people, g.subs, out)}</span>
    </button>
  );
}

function Standings({ rows, people, me }: { rows: ReturnType<typeof eventStandings>; people: Record<string, PlayerLite>; me: string | null }) {
  return (
    <div className={`${card} overflow-hidden`}>
      <table className="tnum w-full text-[14px]">
        <thead>
          <tr className="text-[10.5px] font-bold uppercase tracking-[.1em] text-dim">
            <th className="w-8 py-2 pl-4 text-left font-bold">#</th><th className="text-left font-bold">Player</th><th className="px-2 text-right font-bold">W–L</th><th className="px-2 text-right font-bold">Win</th><th className="pr-4 pl-2 text-right font-bold">+/− pg</th>
          </tr>
        </thead>
        <tbody>
          {rows.filter((r) => r.gp).map((r, i) => {
            const pdg = (r.pf - r.pa) / r.gp;
            return (
              <tr key={r.id} className={`border-t border-white/[.04] ${r.id === me ? "bg-accent/[.06]" : ""}`}>
                <td className="py-2 pl-4 font-mono text-[12.5px] text-dim">{i + 1}</td>
                <td className="py-2"><span className="flex items-center gap-2"><Avatar p={people[r.id]} size={22} /><PlayerLink p={people[r.id]} className="font-semibold" /></span></td>
                <td className="px-2 text-right text-num">{r.w}–{r.l}</td>
                <td className="px-2 text-right font-bold">{Math.round((100 * r.w) / r.gp)}%</td>
                <td className={`pr-4 pl-2 text-right font-mono text-[12.5px] ${pdg > 0 ? "text-win" : pdg < 0 ? "text-loss" : "text-dim"}`}>{(pdg > 0 ? "+" : "") + pdg.toFixed(1)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Podium({ groups, people }: { groups: GroupView[]; people: Record<string, PlayerLite> }) {
  return (
    <Section title="Results">
      <div className="grid gap-2.5">
        {groups.map((g) => {
          const c = tierColor(g.name);
          return (
            <div key={g.groupNo} className="spk-up flex items-center gap-3 rounded-2xl p-4" style={{ background: `${c}18`, border: `1px solid ${c}40` }}>
              <span className="text-[26px]" aria-hidden="true">{g.groupNo === 0 ? "🏆" : "★"}</span>
              <div className="min-w-0">
                <div className="text-[11px] font-bold uppercase tracking-[.14em]" style={{ color: c }}>{finalWinTitle(g.name)}</div>
                <div className="truncate text-[20px] font-black">{g.winner ? people[g.winner]?.name : g.tied.length ? `Tie: ${g.tied.map((id) => people[id]?.name).join(" / ")}` : "Not finished"}</div>
              </div>
            </div>
          );
        })}
      </div>
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

        <div className="border-t border-white/[.05] pt-4">
          <div className="text-[15px] font-extrabold">Check-in</div>
          <p className="mt-1 text-[13px] text-muted">Mark people <b className="text-fg">here</b> as they arrive. After the first stage everyone who played stays in, so only mark someone <b className="text-fg">out</b> if they leave: their games get flagged for a sub.</p>
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
        </div>

        <div className="border-t border-white/[.05] pt-4">
          {!edit ? (
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setEdit(true)} className={btnGhost}>Edit event details</button>
              {!current && <button disabled={pending} onClick={() => twice("delete", () => run(() => deleteEvent(ev.id), "Event deleted", (r) => { if (r.ok) location.href = "/"; }))} className={btnQuiet}>{confirm === "delete" ? "Tap again to delete" : "Delete event"}</button>}
            </div>
          ) : (
            <EditEvent view={view} run={run} pending={pending} onDone={() => setEdit(false)} />
          )}
        </div>
      </div>
    </Section>
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
