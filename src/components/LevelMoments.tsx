"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { checkMoments, seenMoments, seenDraw } from "@/app/actions";
import { DrawReel } from "@/components/DrawSlides";
import { CountUp, Confetti } from "@/components/StoryReel";
import { Avatar } from "@/components/ui";
import type { Moments, DrawFeed } from "@/lib/data";
import type { MomentSlide } from "@/lib/moments";
import type { Level } from "@/lib/levels";
import { PROV_N } from "@/lib/standings";

// Pops up whenever one of your games has been scored (by you or anyone else): a short story of
// what it did to your rating. Checks every few seconds while the app is open, and straight away
// when this phone saves a score (the "cards:moments" event). Closing it marks it seen.

const SLIDE_MS = 4500;
const POLL_MS = 8000;

/** Ask for an immediate check, e.g. right after saving a score. */
export const pingMoments = () => { try { window.dispatchEvent(new Event("cards:moments")); } catch {} };

export function LevelMoments() {
  // What's waiting: your level updates first, then a draw story (src/components/DrawSlides.tsx).
  const [m, setM] = useState<Moments | null>(null);
  const [draw, setDraw] = useState<DrawFeed | null>(null);
  const busy = useRef(false);
  const showing = useRef(false);

  const again = useRef(false);
  const check = useCallback(async () => {
    if (showing.current || document.hidden) return;
    // A check already running might have started before the score landed: run once more after it.
    if (busy.current) { again.current = true; return; }
    busy.current = true;
    try {
      do {
        again.current = false;
        const r = await checkMoments();
        const levels = r?.levels?.slides.length ? r.levels : null;
        if (levels || r?.draw) { showing.current = true; setM(levels); setDraw(r?.draw ?? null); break; }
      } while (again.current);
    } catch {} finally { busy.current = false; }
  }, []);

  useEffect(() => {
    const first = setTimeout(check, 1200);
    const t = setInterval(check, POLL_MS);
    const now = () => setTimeout(check, 700); // let the save land first
    const vis = () => { if (!document.hidden) check(); };
    window.addEventListener("cards:moments", now);
    document.addEventListener("visibilitychange", vis);
    return () => { clearTimeout(first); clearInterval(t); window.removeEventListener("cards:moments", now); document.removeEventListener("visibilitychange", vis); };
  }, [check]);

  if (m) {
    const close = () => {
      const upTo = m.upTo;
      setM(null);
      if (!draw) showing.current = false;
      seenMoments(upTo).catch(() => {});
    };
    return <Reel m={m} onClose={close} done={draw ? "Next" : "Back to it"} />;
  }
  if (draw) {
    const close = () => {
      const at = draw.story.createdAt;
      setDraw(null);
      showing.current = false;
      seenDraw(at).catch(() => {});
    };
    return <DrawReel key={draw.story.createdAt} feed={draw} onClose={close} />;
  }
  return null;
}

/** The story itself, also used to replay a past game from a profile (`title`, `done`). */
export function Reel({ m, onClose, title = "Your results", done = "Back to it", self = true }: { m: Moments; onClose: () => void; title?: string; done?: string; self?: boolean }) {
  const slides = m.slides;
  const [at, setAt] = useState(0);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const last = at === slides.length - 1;
  const go = useCallback((i: number) => { if (i >= slides.length) return; setAt(Math.max(0, i)); setElapsed(0); }, [slides.length]);

  useEffect(() => {
    if (paused || last) return; // the last slide waits for "Back to it"
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
  }, [at, paused, last]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" || e.key === " ") (last ? onClose() : go(at + 1));
      if (e.key === "ArrowLeft") go(at - 1);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [at, last, go, onClose]);

  const down = useRef(0);
  const onDown = () => { down.current = performance.now(); setPaused(true); };
  const onUp = (e: React.PointerEvent) => {
    setPaused(false);
    if (performance.now() - down.current > 300) return;
    const x = e.clientX / (e.currentTarget as HTMLElement).clientWidth;
    if (x < 0.33) go(at - 1); else if (!last) go(at + 1);
  };

  const s = slides[at];
  const bg = s.kind === "levelUp" || s.kind === "placed" ? "from-[#24300f] to-[#0c0e10]"
    : s.kind === "levelDown" ? "from-[#1c1f2a] to-[#0c0e10]"
    : s.kind === "game" && s.won ? "from-[#16260f] to-[#0c0e10]"
    : s.kind === "game" ? "from-[#1d1b22] to-[#0c0e10]" : "from-[#10202a] to-[#0c0e10]";
  const party = s.kind === "levelUp" || s.kind === "placed";

  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-[60] mx-auto flex max-w-[480px] flex-col bg-[#0c0e10] text-fg">
      <div className={`absolute inset-0 bg-gradient-to-b ${bg}`} />
      {party && <Confetti key={at} />}
      <div className="relative z-10 flex gap-1 px-3 pt-[calc(10px+env(safe-area-inset-top))]">
        {slides.map((_, i) => (
          <div key={i} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/20">
            <div className="h-full bg-white" style={{ width: i < at ? "100%" : i === at ? (last ? "100%" : `${(elapsed / SLIDE_MS) * 100}%`) : "0%" }} />
          </div>
        ))}
      </div>
      <div className="relative z-10 flex items-center justify-between px-4 pt-3">
        <span className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[.16em] text-white/50"><Avatar p={m.me} size={20} />{title}</span>
        <button onClick={onClose} className="spk-press -mr-2 p-2 text-white/70" aria-label="Close">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </div>
      <div
        className="spk-noselect relative z-10 flex min-h-0 flex-1 touch-manipulation select-none flex-col px-6"
        onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={() => setPaused(false)} onContextMenu={(e) => e.preventDefault()}
      >
        <div key={at} className="flex min-h-0 w-full flex-1 flex-col"><Body s={s} m={m} self={self} /></div>
      </div>
      <div className="relative z-10 px-6 pb-[calc(28px+env(safe-area-inset-bottom))]">
        {last
          ? <button onClick={onClose} className="spk-press h-14 w-full rounded-2xl bg-accent text-[16px] font-black text-ink">{done}</button>
          : <p className="text-center text-[12.5px] text-white/40">Tap to continue</p>}
      </div>
    </div>
  );
}

const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n)}`;

/** Arrives `n` beats into the slide. */
const beat = (n: number) => ({ animationDelay: `${n * 140}ms` });

function LevelBar({ bar, delta }: { bar: { from: number; to: number; level: Level; next: Level | null; toNext: number; placing: boolean }; delta?: number }) {
  const [w, setW] = useState(bar.from);
  useEffect(() => { const t = setTimeout(() => setW(bar.to), 450); return () => clearTimeout(t); }, [bar.to]);
  const { level, next, toNext, placing } = bar;
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between text-[13.5px] font-bold">
        <span className="flex items-center gap-2"><span className="text-[18px]">{level.icon}</span>{level.name}</span>
        <span className="text-white/45">{placing ? "Placing" : next ? `${next.icon} next` : "Top tier"}</span>
      </div>
      {placing ? (
        <div className="flex gap-1.5">
          {Array.from({ length: PROV_N }, (_, i) => <span key={i} className={`h-2.5 flex-1 rounded-full transition-colors duration-700 ${i < Math.round(w * PROV_N) ? "bg-accent" : "bg-white/10"}`} />)}
        </div>
      ) : (
        <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full transition-[width] duration-1000 ease-out" style={{ width: `${Math.max(2, w * 100)}%`, background: delta !== undefined && delta < 0 ? "#8A9196" : level.color }} />
        </div>
      )}
      <div className="text-[12.5px] text-white/50">
        {placing ? (toNext ? `${toNext} more ${toNext === 1 ? "game" : "games"} and your rating is revealed` : "Placed!") : next ? `${toNext} to ${next.icon} ${next.name}` : "Top tier. Legend status."}
      </div>
    </div>
  );
}

/** One side of the net: two faces overlapping, two names, and their score underneath. */
function Side({ ids, score, lead, m, align, self = false }: { ids: string[]; score: number; lead: boolean; m: Moments; align: "left" | "right"; self?: boolean }) {
  const right = align === "right";
  return (
    <div className={`flex min-w-0 flex-1 flex-col ${right ? "items-end text-right" : "items-start"}`}>
      <div className={`flex ${right ? "flex-row-reverse" : ""}`}>
        {ids.map((id, i) => (
          <span key={id} className={`rounded-full ring-[3px] ring-[#0c0e10] ${i ? (right ? "-mr-3" : "-ml-3") : ""}`}><Avatar p={id === m.me.id ? m.me : m.names[id]} size={46} dim={!lead} /></span>
        ))}
      </div>
      <div className={`mt-2 w-full truncate text-[13.5px] font-bold ${lead ? "text-fg" : "text-white/50"}`}>{ids.map((id) => (id === m.me.id && self ? "You" : (id === m.me.id ? m.me : m.names[id])?.name ?? "?")).join(" & ")}</div>
      <div className={`tnum mt-1 font-mono text-[76px] font-black leading-[.9] tracking-[-.05em] ${lead ? "text-fg" : "text-white/30"}`}><CountUp to={score} /></div>
    </div>
  );
}

function Body({ s, m, self }: { s: MomentSlide; m: Moments; self: boolean }) {
  if (s.kind === "game") {
    return (
      <div className="relative flex flex-1 flex-col justify-between py-5">
        {/* The result as a word bigger than the screen, behind everything. */}
        <div aria-hidden="true" className={`spk-fade pointer-events-none absolute -right-8 top-6 select-none text-[150px] font-black uppercase leading-none tracking-[-.06em] ${s.won ? "text-accent/[.10]" : "text-white/[.05]"}`}>{s.won ? "Win" : "Loss"}</div>

        <div className="spk-rise relative flex items-center gap-2" style={beat(0)}>
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-[.14em] ${s.won ? "bg-accent text-ink" : "bg-white/12 text-fg"}`}>{s.won ? "Win" : "Loss"}</span>
          <span className="truncate text-[12px] font-bold uppercase tracking-[.14em] text-white/45">{s.eventTitle} · {s.label}</span>
        </div>

        <div className="spk-rise relative" style={beat(1)}>
          <div className="flex items-end gap-3">
            <Side ids={[m.me.id, s.partner]} score={s.mine} lead={s.won} m={m} align="left" self={self} />
            <span className="pb-4 text-[13px] font-black uppercase tracking-[.2em] text-white/30">vs</span>
            <Side ids={s.opponents} score={s.theirs} lead={!s.won} m={m} align="right" />
          </div>
        </div>

        <p className="spk-rise relative text-[24px] font-black leading-[1.15] tracking-[-.01em]" style={beat(3)}>{s.cheer}</p>

        <div className="spk-rise relative rounded-3xl border border-white/10 bg-white/[.05] p-4" style={beat(4)}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5 text-[12px] font-bold">
              <span className="rounded-full bg-white/[.08] px-2.5 py-1 text-white/70">{Math.round(s.winProb * 100)}% to win going in</span>
            </div>
            {s.placingGame == null ? (
              <span className={`spk-stamp tnum shrink-0 rounded-2xl px-3 py-1.5 text-[30px] font-black leading-none ${s.delta >= 0 ? "bg-accent text-ink" : "bg-white/15 text-fg"}`} style={beat(5)}>
                {s.delta >= 0 ? "+" : "−"}<CountUp to={Math.abs(s.delta)} />
              </span>
            ) : (
              <span className="spk-stamp tnum shrink-0 rounded-2xl bg-white/15 px-3 py-1.5 text-[18px] font-black leading-none" style={beat(5)}>{s.placingGame}/{PROV_N}</span>
            )}
          </div>
          <LevelBar bar={s.bar} delta={s.delta} />
        </div>
      </div>
    );
  }
  if (s.kind === "placed") {
    const c = s.level.color;
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <div className="spk-rise text-[13px] font-black uppercase tracking-[.24em] text-accent" style={beat(0)}>Placement complete</div>
        <div className="relative grid place-items-center">
          <span aria-hidden="true" className="spk-spin absolute h-[210px] w-[210px] rounded-full" style={{ background: `conic-gradient(from 0deg, ${c}, transparent 25%, ${c}88 50%, transparent 75%, ${c})`, mask: "radial-gradient(circle, transparent 62%, #000 63%)", WebkitMask: "radial-gradient(circle, transparent 62%, #000 63%)" }} />
          <span className="grid h-[170px] w-[170px] place-items-center rounded-full" style={{ background: `radial-gradient(circle, ${c}30, transparent 70%)` }}>
            <span className="spk-crown text-[96px] leading-none">{s.level.icon}</span>
          </span>
        </div>
        <div className="spk-rise" style={beat(2)}>
          <div className="text-[40px] font-black leading-none tracking-[-.02em]" style={{ color: c }}>{s.level.name}</div>
          <div className="tnum mt-3 font-mono text-[56px] font-black leading-none"><CountUp to={s.rating} /></div>
          <div className="mt-1 text-[11px] font-black uppercase tracking-[.2em] text-white/45">Your rating</div>
        </div>
        <p className="spk-rise max-w-[300px] text-[18px] font-bold leading-snug text-white/80" style={beat(4)}>{s.cheer}</p>
      </div>
    );
  }
  if (s.kind === "levelUp") {
    const c = s.level.color === "#8A9196" ? "#CBFB4F" : s.level.color;
    return (
      <div className="flex flex-1 flex-col justify-between py-5">
        <div className="spk-rise flex items-center gap-3 text-[13px] font-black uppercase tracking-[.24em]" style={{ color: c, ...beat(0) }}>
          <span className="h-px flex-1" style={{ background: `${c}55` }} />Level up<span className="h-px flex-1" style={{ background: `${c}55` }} />
        </div>
        <div className="flex flex-col items-center text-center">
          <div className="relative grid place-items-center">
            <span aria-hidden="true" className="spk-spin absolute h-[210px] w-[210px] rounded-full" style={{ background: `conic-gradient(from 0deg, ${c}, transparent 25%, ${c}88 50%, transparent 75%, ${c})`, mask: "radial-gradient(circle, transparent 62%, #000 63%)", WebkitMask: "radial-gradient(circle, transparent 62%, #000 63%)" }} />
            <span className="grid h-[170px] w-[170px] place-items-center rounded-full" style={{ background: `radial-gradient(circle, ${c}30, transparent 70%)` }}>
              <span className="spk-crown text-[96px] leading-none">{s.level.icon}</span>
            </span>
          </div>
          <div className="spk-rise mt-6 text-[44px] font-black leading-none tracking-[-.02em]" style={{ color: c, ...beat(2) }}>{s.level.name}</div>
          <div className="spk-rise tnum mt-3 flex items-center gap-2 text-[15px] font-black" style={beat(3)}>
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-white/50">Tier up</span>
            <span className="text-white/40">→</span>
            <span className="rounded-full px-2.5 py-1 text-ink" style={{ background: c }}>{s.rating}</span>
          </div>
        </div>
        <div className="spk-rise grid gap-2 text-center" style={beat(5)}>
          <p className="text-[20px] font-bold leading-snug">{s.cheer}</p>
          {s.next && <p className="text-[13px] text-white/50">Rating {s.rating}. Next: {s.next.icon} {s.next.name}, {s.toNext} away</p>}
        </div>
      </div>
    );
  }
  if (s.kind === "levelDown") {
    return (
      <div className="flex flex-1 flex-col justify-center gap-8 py-5">
        <div className="spk-rise text-[12px] font-black uppercase tracking-[.24em] text-white/45" style={beat(0)}>Rank change</div>
        <div className="flex items-center gap-5">
          <span className="spk-sink grid h-[104px] w-[104px] shrink-0 place-items-center rounded-[28px] bg-white/[.06] text-[64px] leading-none">{s.level.icon}</span>
          <div className="spk-rise min-w-0" style={beat(2)}>
            <div className="tnum flex items-center gap-1.5 text-[14px] font-black text-white/45">Rating {s.rating}</div>
            <div className="mt-1 text-[32px] font-black leading-[1.05]">Back to {s.level.name}</div>
          </div>
        </div>
        {s.next && (
          <div className="spk-rise flex items-baseline gap-3 border-l-2 border-accent/60 pl-4" style={beat(3)}>
            <span className="tnum text-[38px] font-black leading-none text-accent">{s.toNext}</span>
            <span className="text-[15px] font-bold text-white/60">to climb back to {s.next.icon} {s.next.name}</span>
          </div>
        )}
        <p className="spk-rise text-[19px] font-bold leading-snug text-white/80" style={beat(4)}>{s.cheer}</p>
      </div>
    );
  }
  // summary: the session as tiles
  const losses = s.games - s.wins;
  return (
    <div className="flex flex-1 flex-col justify-center gap-4 py-5">
      <div className="spk-rise mb-1 text-[13px] font-black uppercase tracking-[.2em] text-accent" style={beat(0)}>Since you last looked</div>
      <div className="grid grid-cols-2 gap-3">
        <div className="spk-rise rounded-3xl bg-accent p-4 text-ink" style={beat(1)}>
          <div className="tnum text-[64px] font-black leading-none tracking-[-.04em]"><CountUp to={s.wins} /></div>
          <div className="mt-1 text-[12px] font-black uppercase tracking-[.14em]">{s.wins === 1 ? "Win" : "Wins"}</div>
        </div>
        <div className="spk-rise rounded-3xl bg-white/[.07] p-4" style={beat(2)}>
          <div className="tnum text-[64px] font-black leading-none tracking-[-.04em] text-white/70"><CountUp to={losses} /></div>
          <div className="mt-1 text-[12px] font-black uppercase tracking-[.14em] text-white/50">{losses === 1 ? "Loss" : "Losses"}</div>
        </div>
        <div className="spk-rise col-span-2 flex items-center justify-between rounded-3xl border border-white/10 p-4" style={beat(3)}>
          <div className="flex gap-1.5" aria-label={`${s.wins} wins, ${losses} losses`}>
            {Array.from({ length: s.games }, (_, i) => <span key={i} className={`h-3 w-3 rounded-full ${i < s.wins ? "bg-accent" : "bg-white/20"}`} />)}
          </div>
          <span className={`tnum text-[30px] font-black leading-none ${s.delta == null || s.delta >= 0 ? "text-accent" : "text-white/70"}`}>{s.delta == null ? (s.tier.placing ? `${PROV_N - s.tier.toNext}/${PROV_N}` : s.after) : signed(s.delta)}</span>
        </div>
        <div className="spk-rise col-span-2 rounded-3xl bg-white/[.04] p-4" style={beat(4)}>
          <LevelBar bar={{ from: s.tier.progress, to: s.tier.progress, level: s.tier.level, next: s.tier.next, toNext: s.tier.toNext, placing: s.tier.placing }} />
        </div>
      </div>
      <p className="spk-rise mt-2 text-[21px] font-black leading-snug" style={beat(5)}>{s.cheer}</p>
    </div>
  );
}
