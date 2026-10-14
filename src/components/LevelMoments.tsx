"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { checkMoments, seenMoments } from "@/app/actions";
import { CountUp, Confetti } from "@/components/StoryReel";
import { Avatar } from "@/components/ui";
import type { Moments } from "@/lib/data";
import type { MomentSlide } from "@/lib/moments";
import type { Level } from "@/lib/levels";

// Pops up whenever one of your games has been scored (by you or anyone else): a short story of
// what it did to your level. Checks every few seconds while the app is open, and straight away
// when this phone saves a score (the "cards:moments" event). Closing it marks it seen.

const SLIDE_MS = 4500;
const POLL_MS = 8000;

/** Ask for an immediate check, e.g. right after saving a score. */
export const pingMoments = () => { try { window.dispatchEvent(new Event("cards:moments")); } catch {} };

export function LevelMoments() {
  const [m, setM] = useState<Moments | null>(null);
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
        if (r && r.slides.length) { showing.current = true; setM(r); break; }
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

  if (!m) return null;
  const close = () => {
    const upTo = m.upTo;
    setM(null);
    showing.current = false;
    seenMoments(upTo).catch(() => {});
  };
  return <Reel m={m} onClose={close} />;
}

/** The story itself, also used to replay a past game from a profile (`title`, `done`). */
export function Reel({ m, onClose, title = "Your results", done = "Back to it" }: { m: Moments; onClose: () => void; title?: string; done?: string }) {
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
  const bg = s.kind === "levelUp" || s.kind === "finish" ? "from-[#24300f] to-[#0c0e10]"
    : s.kind === "levelDown" ? "from-[#1c1f2a] to-[#0c0e10]"
    : s.kind === "game" && s.won ? "from-[#16260f] to-[#0c0e10]"
    : s.kind === "game" ? "from-[#1d1b22] to-[#0c0e10]" : "from-[#10202a] to-[#0c0e10]";
  const party = s.kind === "levelUp" || s.kind === "finish";

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
        className="spk-noselect relative z-10 flex flex-1 touch-manipulation select-none items-center px-7"
        onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={() => setPaused(false)} onContextMenu={(e) => e.preventDefault()}
      >
        <div key={at} className="spk-up w-full"><Body s={s} m={m} /></div>
      </div>
      <div className="relative z-10 px-7 pb-[calc(28px+env(safe-area-inset-bottom))]">
        {last
          ? <button onClick={onClose} className="spk-press h-14 w-full rounded-2xl bg-accent text-[16px] font-black text-ink">{done}</button>
          : <p className="text-center text-[12.5px] text-white/40">Tap to continue</p>}
      </div>
    </div>
  );
}

const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n)}`;

function LevelBar({ from, to, level, next, toNext, delta }: { from: number; to: number; level: Level; next: Level | null; toNext: number; delta?: number }) {
  const [w, setW] = useState(from);
  useEffect(() => { const t = setTimeout(() => setW(to), 250); return () => clearTimeout(t); }, [to]);
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between text-[14px] font-bold">
        <span className="flex items-center gap-2"><span className="text-[20px]">{level.icon}</span>{level.name}</span>
        <span className="text-white/50">Level {level.level}</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full transition-[width] duration-1000 ease-out" style={{ width: `${Math.max(2, w * 100)}%`, background: delta !== undefined && delta < 0 ? "#8A9196" : level.color === "#8A9196" ? "#CBFB4F" : level.color }} />
      </div>
      <div className="text-[13px] text-white/55">{next ? `${toNext} XP to ${next.icon} ${next.name}` : "Top level. Legend status."}</div>
    </div>
  );
}

function Body({ s, m }: { s: MomentSlide; m: Moments }) {
  const name = (id: string) => m.names[id]?.name ?? "someone";
  if (s.kind === "game") {
    return (
      <div className="grid gap-6">
        <div>
          <div className="text-[12.5px] font-bold uppercase tracking-[.18em] text-white/45">{s.eventTitle} · {s.label}</div>
          <div className={`mt-2 text-[44px] font-black leading-none tracking-[-.02em] ${s.won ? "text-accent" : "text-fg"}`}>{s.won ? "Win" : "Loss"}</div>
          <div className="tnum mt-1 font-mono text-[64px] font-black leading-none tracking-[-.04em]">{s.mine}<span className="text-white/30">–</span>{s.theirs}</div>
          <div className="mt-3 flex items-center gap-2 text-[16px] text-white/70">
            <Avatar p={m.names[s.partner]} size={26} />with <b className="text-fg">{name(s.partner)}</b> vs {name(s.opponents[0])} &amp; {name(s.opponents[1])}
          </div>
        </div>
        <div className="flex items-baseline gap-3">
          <span className={`tnum text-[40px] font-black leading-none ${s.xp >= 0 ? "text-accent" : "text-white/70"}`}>{s.xp >= 0 ? "+" : "−"}<CountUp to={Math.abs(s.xp)} /> XP</span>
          {s.turnedUp && <span className="text-[13px] font-semibold text-white/55">incl. +10 for turning up 👋</span>}
        </div>
        <LevelBar from={s.progressFrom} to={s.progressTo} level={s.to} next={s.next} toNext={s.toNext} delta={s.xp} />
        <p className="text-[19px] font-bold leading-snug">{s.cheer}</p>
      </div>
    );
  }
  if (s.kind === "finish") {
    return (
      <div className="grid gap-6 text-center">
        <div className="spk-crown text-[88px] leading-none">{s.label === "Champion" ? "🏆" : "🎉"}</div>
        <div className="text-[34px] font-black leading-tight">{s.label}</div>
        <div className="tnum text-[40px] font-black text-accent">+<CountUp to={s.xp} /> XP</div>
        <p className="text-[19px] font-bold">{s.cheer}</p>
      </div>
    );
  }
  if (s.kind === "levelUp") {
    return (
      <div className="grid justify-items-center gap-5 text-center">
        <div className="text-[13px] font-black uppercase tracking-[.24em] text-accent">Level up!</div>
        <div className="spk-crown text-[104px] leading-none">{s.level.icon}</div>
        <div>
          <div className="text-[38px] font-black leading-tight" style={{ color: s.level.color === "#8A9196" ? undefined : s.level.color }}>{s.level.name}</div>
          <div className="mt-1 text-[16px] font-bold text-white/60">Level {s.level.level}</div>
        </div>
        <p className="max-w-[300px] text-[19px] font-bold leading-snug">{s.cheer}</p>
        {s.next && <p className="text-[13.5px] text-white/50">Next up: {s.next.icon} {s.next.name}, {s.toNext} XP away</p>}
      </div>
    );
  }
  if (s.kind === "levelDown") {
    return (
      <div className="grid justify-items-center gap-5 text-center">
        <div className="text-[13px] font-black uppercase tracking-[.24em] text-white/55">Rank change</div>
        <div className="text-[88px] leading-none opacity-90">{s.level.icon}</div>
        <div>
          <div className="text-[32px] font-black leading-tight">Back to {s.level.name}</div>
          <div className="mt-1 text-[15px] font-bold text-white/55">Level {s.level.level}{s.next ? ` · ${s.toNext} XP to climb back` : ""}</div>
        </div>
        <p className="max-w-[300px] text-[19px] font-bold leading-snug">{s.cheer}</p>
      </div>
    );
  }
  // summary
  return (
    <div className="grid gap-6">
      <div className="text-[13px] font-bold uppercase tracking-[.2em] text-accent">Since you last looked</div>
      <div className="flex items-end gap-5">
        <div className="tnum text-[72px] font-black leading-none tracking-[-.04em]"><CountUp to={s.wins} /><span className="text-white/30">–</span><CountUp to={s.games - s.wins} /></div>
        <div className={`tnum pb-2 text-[30px] font-black ${s.xp >= 0 ? "text-accent" : "text-white/70"}`}>{signed(s.xp)} XP</div>
      </div>
      <LevelBar from={s.progress} to={s.progress} level={s.level} next={s.next} toNext={s.toNext} />
      <p className="text-[20px] font-bold leading-snug">{s.cheer}</p>
    </div>
  );
}
