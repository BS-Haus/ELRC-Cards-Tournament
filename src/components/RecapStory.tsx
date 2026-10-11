"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, tierColor, fmtDate, LevelPill } from "@/components/ui";
import { levelFor } from "@/lib/levels";
import type { Recap, Moment, Finish } from "@/lib/recap";
import type { PlayerLite } from "@/lib/data";

const SLIDE_MS = 6000;
const ordinal = (n: number) => `${n}${["th", "st", "nd", "rd"][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10 < 4 ? n % 10 : 0]}`;
const signed = (n: number, digits = 0) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(digits)}`;

/** Counts a number up from 0 when its slide appears. */
function CountUp({ to, digits = 0, prefix = "" }: { to: number; digits?: number; prefix?: string }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setV(to); return; }
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 900);
      setV(to * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return <>{prefix}{v.toFixed(digits)}</>;
}

function Confetti() {
  const colors = ["#CBFB4F", "#FFCF5C", "#5EEAD4", "#F9A8D4", "#93C5FD"];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {Array.from({ length: 36 }, (_, i) => (
        <span key={i} className="spk-confetti absolute top-[-12px] h-3 w-1.5 rounded-sm"
          style={{ left: `${(i * 37) % 100}%`, background: colors[i % colors.length], animationDelay: `${(i % 9) * 0.12}s`, animationDuration: `${2.2 + (i % 5) * 0.3}s` }} />
      ))}
    </div>
  );
}

type Slide = { key: string; bg: string; body: React.ReactNode; confetti?: boolean };

export function RecapStory({ recap, names, viewer, backHref }: { recap: Recap; names: Record<string, PlayerLite>; viewer: string | null; backHref: string }) {
  const router = useRouter();
  const n = (id: string) => names[id]?.name ?? "Someone";
  const me = recap.me;
  const mine = me && me.id === viewer;
  const you = mine ? "You" : me ? n(me.id) : "";
  const your = mine ? "Your" : me ? `${n(me.id)}'s` : "";
  const pair = (ids: string[]) => ids.map(n).join(" & ");
  const momentLine = (m: Moment) => <><b>{pair(m.winners)}</b> beat {pair(m.losers)} <span className="tnum font-mono font-black text-accent">{m.score[0]}–{m.score[1]}</span><span className="block text-[13px] text-white/50">{m.label}</span></>;
  const finishText = (f: Finish) => (f.won ? `${f.tier} champion` : `${ordinal(f.position)} of ${f.of} in ${f.tier}`);

  const slides: Slide[] = [];
  slides.push({
    key: "intro", bg: "from-[#1b2410] to-[#0c0e10]",
    body: (
      <div className="flex flex-col items-start gap-3">
        <div className="text-[13px] font-bold uppercase tracking-[.2em] text-accent">{fmtDate(recap.event.startsAt, false)}</div>
        <div className="text-[40px] font-black leading-[1.02] tracking-[-.02em]">{recap.event.title}</div>
        <div className="text-[19px] font-semibold text-white/70">{me ? `${your} day at the nets.` : "The day at the nets."}</div>
        {me && <div className="mt-4"><Avatar p={names[me.id]} size={72} /></div>}
      </div>
    ),
  });

  if (me) {
    const l = me.line;
    slides.push({
      key: "record", bg: "from-[#10202a] to-[#0c0e10]",
      body: (
        <div className="grid gap-6">
          <div className="text-[22px] font-extrabold">{you} played {l.gp} game{l.gp === 1 ? "" : "s"}.</div>
          <div className="flex items-center gap-6">
            <WinRing pct={l.gp ? l.w / l.gp : 0} />
            <div className="tnum text-[84px] font-black leading-none tracking-[-.04em]"><CountUp to={l.w} /><span className="text-white/30">–</span><CountUp to={l.l} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <Stat label="Points for" value={<CountUp to={l.pf} />} />
            <Stat label="Against" value={<CountUp to={l.pa} />} />
            <Stat label="+/−" value={signed(l.pf - l.pa)} />
          </div>
          {me.streak >= 3 && <div className="text-[17px] font-bold text-accent">🔥 {me.streak} wins in a row</div>}
        </div>
      ),
    });

    if (me.timeline.length > 1) {
      slides.push({
        key: "games", bg: "from-[#0f1a2a] to-[#0c0e10]",
        body: (
          <div className="grid gap-5">
            <div className="text-[13px] font-bold uppercase tracking-[.2em] text-white/50">Game by game</div>
            <div className="text-[24px] font-extrabold leading-tight">
              {me.timeline.filter((g) => g.won).length > me.timeline.length / 2 ? "Mostly up." : me.timeline.filter((g) => g.won).length === me.timeline.length / 2 ? "Even all day." : "A tough one."}{" "}
              <span className="text-white/60">Biggest swing {Math.max(...me.timeline.map((g) => Math.abs(g.mine - g.theirs)))} points.</span>
            </div>
            <GameBars games={me.timeline} names={names} />
          </div>
        ),
      });
    }

    if (me.finish || me.dayRank) {
      const f = me.finish;
      const c = f ? tierColor(f.tier) : "#CBFB4F";
      slides.push({
        key: "finish", bg: f?.won ? "from-[#3a2c06] to-[#0c0e10]" : "from-[#1a1d20] to-[#0c0e10]", confetti: !!f?.won,
        body: (
          <div className="flex flex-col items-start gap-4">
            <div className="text-[13px] font-bold uppercase tracking-[.2em]" style={{ color: c }}>{f ? `${f.tier} final` : "After the groups"}</div>
            {f?.won && <div className="text-[64px] leading-none" aria-hidden="true">🏆</div>}
            <div className="text-[44px] font-black leading-[1.02] tracking-[-.02em]" style={{ color: f?.won ? c : undefined }}>
              {f ? finishText(f) : `${ordinal(me.dayRank!.position)} of ${me.dayRank!.of}`}
            </div>
            {f && me.dayRank && <div className="text-[16px] text-white/60">{ordinal(me.dayRank.position)} of {me.dayRank.of} after the group stage.</div>}
          </div>
        ),
      });
    }

    if (recap.progress && recap.progress.earned.total > 0) {
      const pr = recap.progress;
      const from = levelFor(pr.before), to = levelFor(pr.after);
      const levelledUp = to.level.name !== from.level.name;
      slides.push({
        key: "points", bg: levelledUp ? "from-[#2a2208] to-[#0c0e10]" : "from-[#14201a] to-[#0c0e10]", confetti: levelledUp,
        body: (
          <div className="grid gap-5">
            <div className="text-[13px] font-bold uppercase tracking-[.2em] text-white/50">Points earned</div>
            <div className="tnum text-[88px] font-black leading-none tracking-[-.03em] text-accent"><CountUp to={pr.earned.total} prefix="+" /></div>
            <div className="grid gap-1.5">
              {pr.earned.parts.map((p, i) => (
                <div key={p.label} className="spk-up flex justify-between text-[16px]" style={{ animationDelay: `${0.25 + i * 0.15}s` }}>
                  <span className="text-white/70">{p.label}</span><span className="tnum font-bold">+{p.points}</span>
                </div>
              ))}
            </div>
            {levelledUp && <div className="spk-crown text-[26px] font-black" style={{ color: to.level.color }}>Level up! {to.level.emoji} {to.level.name}</div>}
            <LevelBar before={pr.before} after={pr.after} />
          </div>
        ),
      });
    }

    if (me.partners.length) {
      slides.push({
        key: "people", bg: "from-[#251626] to-[#0c0e10]",
        body: (
          <div className="grid gap-6">
            {me.bestPartner && <Person label="Best partner" p={names[me.bestPartner.id]} line={`Won ${me.bestPartner.w} of ${me.bestPartner.gp} together`} />}
            <div>
              <div className="mb-2.5 text-[12px] font-bold uppercase tracking-[.18em] text-white/50">Points +/− with each partner</div>
              <PartnerBars partners={me.partners.slice(0, 6)} names={names} />
            </div>
            {me.toughest && (
              <div className="flex items-center gap-3 text-[15px] text-white/75">
                <Avatar p={names[me.toughest.id]} size={30} />
                <span><b className="text-fg">{n(me.toughest.id)}</b> was the toughest: beat {mine ? "you" : n(me.id)} {me.toughest.l} time{me.toughest.l === 1 ? "" : "s"} in {me.toughest.gp}.</span>
              </div>
            )}
          </div>
        ),
      });
    }

    if (me.field) {
      const f = me.field;
      slides.push({
        key: "field", bg: "from-[#1c1a0b] to-[#0c0e10]",
        body: (
          <div className="grid gap-7">
            <div className="text-[13px] font-bold uppercase tracking-[.2em] text-white/50">{mine ? "You" : n(me.id)} vs the field</div>
            <div className="text-[34px] font-black leading-[1.05]">
              Ahead of <span className="text-accent"><CountUp to={Math.round(100 * f.aheadOf)} />%</span> of the {f.players - 1} others today.
            </div>
            <FieldBar label="Win rate" s={f.win} fmt={(v) => `${Math.round(100 * v)}%`} />
            <FieldBar label="Points +/− per game" s={f.diffPerGame} fmt={(v) => signed(v, 1)} />
          </div>
        ),
      });
    }

    if (me.biggestWin || me.closest) {
      slides.push({
        key: "moments", bg: "from-[#0f2420] to-[#0c0e10]",
        body: (
          <div className="grid gap-8 text-[19px] leading-snug">
            {me.biggestWin && <div><div className="mb-1.5 text-[12px] font-bold uppercase tracking-[.18em] text-white/50">{your} biggest win</div>{momentLine(me.biggestWin)}</div>}
            {me.closest && me.closest !== me.biggestWin && <div><div className="mb-1.5 text-[12px] font-bold uppercase tracking-[.18em] text-white/50">{your} closest game</div>{momentLine(me.closest)}</div>}
          </div>
        ),
      });
    }

    if (me.vsLast) {
      const v = me.vsLast;
      const pts = Math.round(100 * v.winPctDelta);
      const max = Math.max(...me.trend.map((t) => t.winPct), 0.01);
      slides.push({
        key: "trend", bg: pts >= 0 ? "from-[#16260c] to-[#0c0e10]" : "from-[#2a1212] to-[#0c0e10]",
        body: (
          <div className="grid gap-5">
            <div className="text-[13px] font-bold uppercase tracking-[.2em] text-white/50">Since {v.title}</div>
            <div className={`text-[56px] font-black leading-none ${pts > 0 ? "text-win" : pts < 0 ? "text-loss" : ""}`}>{pts > 0 ? "▲" : pts < 0 ? "▼" : "="} {Math.abs(pts)} pts</div>
            <div className="text-[18px] text-white/75">
              Win rate {Math.round(100 * v.winPct)}% → {Math.round(100 * (v.winPct + v.winPctDelta))}%. Points per game {signed(v.diffPerGame, 1)} → {signed(v.diffPerGame + v.diffDelta, 1)}.
            </div>
            {v.finishMove && v.finish && me.finish && (
              <div className="text-[18px] font-bold">
                {v.finishMove === "up" ? "Moved up: " : v.finishMove === "down" ? "Dropped: " : "Held steady: "}
                {finishText(v.finish)} → {finishText(me.finish)}
              </div>
            )}
            {me.trend.length > 1 && (
              <div className="mt-2 flex h-28 items-end gap-2" aria-label="Win rate each weekend">
                {me.trend.map((t, i) => (
                  <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                    <span className="tnum text-[11px] font-bold text-white/60">{Math.round(100 * t.winPct)}%</span>
                    <div className={`w-full rounded-t-md ${i === me.trend.length - 1 ? "bg-accent" : "bg-white/25"}`} style={{ height: Math.max(6, (t.winPct / max) * 72) }} />
                    <span className="text-[10px] text-white/45">{fmtDate(t.startsAt, false).split(" ").slice(1).join(" ")}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ),
      });
    }
  }

  if (!me && (recap.moments.biggestWin || recap.moments.longestGame || recap.moments.unbeaten.length)) {
    slides.push({
      key: "day", bg: "from-[#0f2420] to-[#0c0e10]",
      body: (
        <div className="grid gap-7 text-[19px] leading-snug">
          {recap.moments.biggestWin && <div><div className="mb-1.5 text-[12px] font-bold uppercase tracking-[.18em] text-white/50">Biggest win</div>{momentLine(recap.moments.biggestWin)}</div>}
          {recap.moments.longestGame && <div><div className="mb-1.5 text-[12px] font-bold uppercase tracking-[.18em] text-white/50">Longest deuce</div>{momentLine(recap.moments.longestGame)}</div>}
          {recap.moments.unbeaten.length > 0 && <div><div className="mb-1.5 text-[12px] font-bold uppercase tracking-[.18em] text-white/50">Unbeaten in the groups</div><b>{recap.moments.unbeaten.map(n).join(", ")}</b></div>}
        </div>
      ),
    });
  }

  if (recap.winners.length) {
    slides.push({
      key: "winners", bg: "from-[#2e2408] to-[#0c0e10]", confetti: true,
      body: (
        <div className="grid gap-4">
          <div className="text-[13px] font-bold uppercase tracking-[.2em] text-gold">{recap.event.done ? "Today's winners" : "Winners so far"}</div>
          {recap.winners.map((w) => {
            const c = tierColor(w.name);
            const isMine = me?.finish?.tier === w.name;
            return (
              <div key={w.name} className="flex items-center gap-3 rounded-2xl p-4" style={{ background: `${c}${isMine ? "30" : "18"}`, border: `1px solid ${c}${isMine ? "90" : "40"}` }}>
                {w.winner ? <Avatar p={names[w.winner]} size={44} /> : <span className="text-[28px]">🤝</span>}
                <div className="min-w-0">
                  <div className="text-[12px] font-bold uppercase tracking-[.14em]" style={{ color: c }}>{w.name}{isMine ? ` · ${mine ? "your" : "their"} final` : ""}</div>
                  <div className="truncate text-[22px] font-black">{w.winner ? n(w.winner) : w.tied.length ? `Tie: ${w.tied.map(n).join(" / ")}` : "Still playing"}</div>
                </div>
              </div>
            );
          })}
        </div>
      ),
    });
  }

  const [at, setAt] = useState(0);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const done = at >= slides.length;
  const go = useCallback((i: number) => { setAt(Math.max(0, Math.min(slides.length, i))); setElapsed(0); }, [slides.length]);

  // Advance on a timer, paused while held.
  useEffect(() => {
    if (paused || done) return;
    const t0 = performance.now() - elapsed;
    let raf = 0;
    const tick = (t: number) => {
      const e = t - t0;
      if (e >= SLIDE_MS) { go(at + 1); return; }
      setElapsed(e);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at, paused, done]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") go(at + 1);
      if (e.key === "ArrowLeft") go(at - 1);
      if (e.key === "Escape") router.push(backHref);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [at, go, router, backHref]);

  const down = useRef(0);
  const onDown = () => { down.current = performance.now(); setPaused(true); };
  const onUp = (e: React.PointerEvent) => {
    setPaused(false);
    if (performance.now() - down.current > 300) return; // a hold, not a tap
    const x = e.clientX / (e.currentTarget as HTMLElement).clientWidth;
    go(x < 0.33 ? at - 1 : at + 1);
  };

  const imageUrl = `/e/${recap.event.id}/recap/image${me ? `?p=${me.id}` : ""}`;
  const save = async () => {
    try {
      const blob = await (await fetch(imageUrl)).blob();
      const file = new File([blob], `${recap.event.title.replace(/[^\w]+/g, "-").toLowerCase()}-recap.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: recap.event.title }); return; }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch { window.open(imageUrl, "_blank"); }
  };
  const share = async () => {
    const url = `${location.origin}/e/${recap.event.id}/recap${me ? `?p=${me.id}` : ""}`;
    try {
      if (navigator.share) await navigator.share({ title: `${recap.event.title} recap`, url });
      else await navigator.clipboard.writeText(url);
    } catch {}
  };

  const s = slides[Math.min(at, slides.length - 1)];
  return (
    <div className="fixed inset-0 z-50 mx-auto flex max-w-[480px] flex-col bg-[#0c0e10] text-fg">
      <div className={`absolute inset-0 bg-gradient-to-b ${done ? "from-[#1b2410] to-[#0c0e10]" : s.bg}`} />
      {!done && s.confetti && <Confetti key={s.key} />}
      <div className="relative z-10 flex gap-1 px-3 pt-[calc(10px+env(safe-area-inset-top))]">
        {slides.map((x, i) => (
          <div key={x.key} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/20">
            <div className="h-full bg-white" style={{ width: i < at ? "100%" : i === at ? `${(elapsed / SLIDE_MS) * 100}%` : "0%" }} />
          </div>
        ))}
      </div>
      <div className="relative z-10 flex items-center justify-between px-4 pt-3">
        <span className="text-[12px] font-bold uppercase tracking-[.16em] text-white/50">Recap</span>
        <button onClick={() => router.push(backHref)} className="spk-press -mr-2 p-2 text-white/70" aria-label="Close recap">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </div>

      {done ? (
        <div className="relative z-10 flex flex-1 flex-col justify-center gap-3 px-7 pb-[calc(32px+env(safe-area-inset-bottom))]">
          <div className="text-[34px] font-black leading-tight">That&apos;s {mine ? "your" : "the"} day.</div>
          <p className="mb-4 text-[16px] text-white/60">{mine ? "It stays on your profile. Save the card or send it to the group." : "Save the card or send it to the group."}</p>
          <button onClick={save} className="spk-press h-14 rounded-2xl bg-accent text-[16px] font-black text-ink">Save as image</button>
          <button onClick={share} className="spk-press h-14 rounded-2xl border border-white/15 bg-white/5 text-[16px] font-bold">Share link</button>
          <button onClick={() => go(0)} className="spk-press h-12 text-[15px] font-bold text-white/60">Watch again</button>
        </div>
      ) : (
        <div
          className="spk-noselect relative z-10 flex flex-1 touch-manipulation select-none items-center px-7 pb-[calc(40px+env(safe-area-inset-bottom))]"
          onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={() => setPaused(false)} onContextMenu={(e) => e.preventDefault()}
        >
          <div key={s.key} className="spk-up w-full">{s.body}</div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white/[.06] p-3">
      <div className="tnum text-[26px] font-black leading-none">{value}</div>
      <div className="mt-1.5 text-[11px] font-bold uppercase tracking-[.1em] text-white/50">{label}</div>
    </div>
  );
}

function Person({ label, p, line }: { label: string; p?: PlayerLite; line: string }) {
  return (
    <div className="flex items-center gap-4">
      <Avatar p={p} size={64} />
      <div className="min-w-0">
        <div className="text-[12px] font-bold uppercase tracking-[.18em] text-white/50">{label}</div>
        <div className="truncate text-[28px] font-black leading-tight">{p?.name ?? "Someone"}</div>
        <div className="text-[15px] text-white/65">{line}</div>
      </div>
    </div>
  );
}

/** Win rate as a ring that fills when the slide appears. */
function WinRing({ pct }: { pct: number }) {
  const r = 34, c = 2 * Math.PI * r;
  const [shown, setShown] = useState(0);
  useEffect(() => { const t = setTimeout(() => setShown(pct), 80); return () => clearTimeout(t); }, [pct]);
  return (
    <div className="relative h-[92px] w-[92px] shrink-0">
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="9" />
        <circle cx="40" cy="40" r={r} fill="none" stroke="#CBFB4F" strokeWidth="9" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - shown)} style={{ transition: "stroke-dashoffset 1s cubic-bezier(.2,.8,.2,1)" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tnum text-[20px] font-black leading-none"><CountUp to={100 * pct} />%</span>
        <span className="mt-0.5 text-[9px] font-bold uppercase tracking-[.12em] text-white/50">wins</span>
      </div>
    </div>
  );
}

/** One bar per game: up and green for a win, down and red for a loss, height by margin. */
function GameBars({ games, names }: { games: { label: string; mine: number; theirs: number; won: boolean; partner: string }[]; names: Record<string, PlayerLite> }) {
  const max = Math.max(...games.map((g) => Math.abs(g.mine - g.theirs)), 1);
  const [grown, setGrown] = useState(false);
  useEffect(() => { const t = setTimeout(() => setGrown(true), 80); return () => clearTimeout(t); }, []);
  return (
    <div>
      <div className="relative flex h-56 items-stretch gap-1.5">
        <div className="absolute inset-x-0 top-1/2 h-px bg-white/25" />
        {games.map((g, i) => {
          const h = (Math.abs(g.mine - g.theirs) / max) * 46;
          return (
            <div key={i} className="relative flex-1">
              <div
                className={`absolute inset-x-0 rounded-sm ${g.won ? "bg-win" : "bg-loss"}`}
                style={{ height: `${grown ? h : 0}%`, [g.won ? "bottom" : "top"]: "50%", transition: `height .6s cubic-bezier(.2,.8,.2,1) ${i * 70}ms` }}
              />
              <span className={`tnum absolute inset-x-0 text-center text-[10px] font-bold text-white/70 ${g.won ? "top-[calc(50%+6px)]" : "bottom-[calc(50%+6px)]"}`}>{g.mine}–{g.theirs}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-1.5">
        {games.map((g, i) => <div key={i} className="flex flex-1 justify-center"><Avatar p={names[g.partner]} size={Math.min(22, 220 / games.length)} /></div>)}
      </div>
      <div className="mt-1.5 text-[11px] text-white/45">Each bar is a game, in order. Underneath: who you played with.</div>
    </div>
  );
}

/** Points +/− with each partner, as a diverging bar from the middle. */
function PartnerBars({ partners, names }: { partners: { id: string; w: number; gp: number; diff: number }[]; names: Record<string, PlayerLite> }) {
  const max = Math.max(...partners.map((p) => Math.abs(p.diff)), 1);
  return (
    <div className="grid gap-2">
      {partners.map((p) => (
        <div key={p.id} className="flex items-center gap-2.5">
          <Avatar p={names[p.id]} size={26} />
          <span className="w-16 truncate text-[13px] font-semibold">{names[p.id]?.name}</span>
          <div className="relative h-4 flex-1">
            <div className="absolute inset-y-0 left-1/2 w-px bg-white/25" />
            <div className={`absolute inset-y-0 rounded-sm ${p.diff >= 0 ? "left-1/2 bg-win" : "right-1/2 bg-loss"}`} style={{ width: `${(Math.abs(p.diff) / max) * 50}%` }} />
          </div>
          <span className="tnum w-[4.5rem] shrink-0 whitespace-nowrap text-right font-mono text-[12px] text-white/70">{signed(p.diff)} · {p.w}/{p.gp}</span>
        </div>
      ))}
    </div>
  );
}

/** The day's range on one measure, the field's average, and where you are. */
function FieldBar({ label, s, fmt }: { label: string; s: { you: number; min: number; max: number; avg: number }; fmt: (v: number) => string }) {
  const span = s.max - s.min || 1;
  const at = (v: number) => `${((v - s.min) / span) * 100}%`;
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between text-[13px]">
        <span className="font-bold uppercase tracking-[.12em] text-white/50">{label}</span>
        <span className="tnum font-black text-accent">{fmt(s.you)}</span>
      </div>
      <div className="relative h-3 rounded-full bg-gradient-to-r from-loss/50 via-white/15 to-win/50">
        <div className="absolute top-1/2 h-5 w-0.5 -translate-y-1/2 bg-white/60" style={{ left: at(s.avg) }} title="Average" />
        <div className="absolute top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-ink bg-accent shadow-lg" style={{ left: at(s.you), transition: "left .8s" }} />
      </div>
      <div className="tnum mt-1.5 flex justify-between text-[11px] text-white/45">
        <span>{fmt(s.min)}</span><span>avg {fmt(s.avg)}</span><span>{fmt(s.max)}</span>
      </div>
    </div>
  );
}

/** Progress through your level, sliding from where you started the day to where you ended it. */
function LevelBar({ before, after }: { before: number; after: number }) {
  const end = levelFor(after);
  const start = levelFor(before);
  const fromPct = start.level.name === end.level.name ? start.progress : 0;
  const [pct, setPct] = useState(fromPct);
  useEffect(() => { const t = setTimeout(() => setPct(end.progress), 500); return () => clearTimeout(t); }, [end.progress]);
  return (
    <div className="mt-2">
      <div className="mb-2 flex items-center justify-between">
        <LevelPill level={end.level} size="md" />
        <span className="tnum text-[13px] text-white/60">{after} pts{end.next ? ` · ${end.next.min - after} to ${end.next.emoji} ${end.next.name}` : " · top level"}</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full" style={{ width: `${pct * 100}%`, background: end.level.color, transition: "width 1.1s cubic-bezier(.2,.8,.2,1)" }} />
      </div>
    </div>
  );
}
